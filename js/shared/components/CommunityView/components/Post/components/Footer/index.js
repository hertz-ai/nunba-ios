import React, { useState, useEffect, useRef } from 'react';
import { Text, View, TouchableOpacity, NativeModules, Animated, DeviceEventEmitter } from 'react-native';
import styles from './styles';
import ADIcon from 'react-native-vector-icons/AntDesign';
import OCIcon from 'react-native-vector-icons/Octicons';
import FIcon from 'react-native-vector-icons/Feather';
import FAIcon from 'react-native-vector-icons/FontAwesome';
import useThemeStore from '../../../../../../colorThemeZustand';
import { useNavigation } from '@react-navigation/native';
import { RectButton, GestureHandlerRootView } from 'react-native-gesture-handler';
import { postsApi, commentsApi } from '../../../../../../services/socialApi';
import BookmarkButton from './BookmarkButton';
import { optimistic } from '../../../../../../services/optimistic';

const { OnboardingModule, ActivityStarterModule } = NativeModules;

const ANIM_DURATION = 400;

const Footer = ({
  likesCount: likesCountProp,
  commentsCount,
  shareCount,
  viewsCount,
  userData,
  userComment,
  openCommentBottomSheet
}) => {
  const navigation = useNavigation();
  const { theme } = useThemeStore();
  const [voteState, setVoteState] = useState(null); // 'up' | 'down' | null
  const [voteScore, setVoteScore] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [userId, setUserId] = useState();
  // UX-AUDIT 2026-05-18 Pass X.P2: BookmarkButton state.  Server-side
  // /api/social/saved endpoint + savedPostsStore are deferred per the
  // plan (additive, lands in a follow-up).  Until then this is a
  // local-only toggle so the visual+haptic experience ships now.
  const [isSaved, setIsSaved] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isAnimating = React.useRef(false);

  useEffect(() => {
    try {
      OnboardingModule.getUser_id((id) => setUserId(id));
    } catch (_) {}
  }, []);

  useEffect(() => {
    const upvotes = userData?.upvotes || likesCountProp || 0;
    const downvotes = userData?.downvotes || 0;
    setVoteScore(upvotes - downvotes);
    setVoteState(userData?.user_vote || null);
    setCommentCount(userData?.comment_count || commentsCount || 0);
  }, [userData, likesCountProp, commentsCount]);

  // Fetch comment count from API
  useEffect(() => {
    if (!userData?.id) return;
    commentsApi.getByPost(userData.id, { limit: 0 })
      .then((res) => {
        const count = res?.count ?? res?.data?.length ?? commentCount;
        if (typeof count === 'number') setCommentCount(count);
      })
      .catch(() => {});
  }, [userData?.id]);

  const animateBounce = () => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: ANIM_DURATION / 2, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: ANIM_DURATION / 2, useNativeDriver: true }),
    ]).start(() => { isAnimating.current = false; });
  };

  // UX-AUDIT 2026-05-18 Pass X.P2: route the vote action through
  // services/optimistic so apply→request→rollback is one named
  // contract.  Same observable behaviour as before (UI flips
  // immediately, network is fire-and-forget) — but failures now
  // surface a friendly toast via the centralised helper instead of
  // being swallowed.
  const handleVote = (direction) => {
    const postId = userData?.id;
    if (!postId) return;

    animateBounce();

    const prevState = voteState;
    const prevScore = voteScore;

    if (prevState === direction) {
      // Remove vote
      optimistic({
        apply: () => {
          setVoteState(null);
          setVoteScore(prevScore + (direction === 'up' ? -1 : 1));
        },
        request: () => postsApi.removeVote(postId),
        rollback: () => {
          setVoteState(prevState);
          setVoteScore(prevScore);
        },
        errorToast: "Couldn't remove vote — try again",
      });
    } else {
      // New vote or switch
      const delta = direction === 'up'
        ? (prevState === 'down' ? 2 : 1)
        : (prevState === 'up' ? -2 : -1);
      optimistic({
        apply: () => {
          setVoteState(direction);
          setVoteScore(prevScore + delta);
        },
        request: () => (direction === 'up' ? postsApi.upvote(postId) : postsApi.downvote(postId)),
        rollback: () => {
          setVoteState(prevState);
          setVoteScore(prevScore);
        },
        errorToast: direction === 'up' ? "Couldn't upvote — try again" : "Couldn't downvote — try again",
        successHaptic: direction === 'up' ? 'light' : null,
      });
    }
  };

  // UX-AUDIT 2026-05-18 Pass X.P2: subscribe to double-tap events
  // emitted by Body so a double-tap on the image registers an
  // upvote.  Idempotent: if voteState is already 'up', the existing
  // handleVote short-circuit (prevState === direction) toggles OFF
  // — which is wrong for double-tap semantics.  Override here: only
  // fire handleVote if not already upvoted.
  useEffect(() => {
    const postId = userData?.id;
    if (!postId) return undefined;
    const sub = DeviceEventEmitter.addListener('PostDoubleTapLike', (payload) => {
      if (payload?.postId !== postId) return;
      if (voteState === 'up') return; // already liked — visual burst already played, no-op on state
      handleVote('up');
    });
    return () => sub.remove();
    // voteState in deps so the listener captures the latest state
    // — without it, the closure would always see voteState=null
    // from first render and double-tap on a liked post would
    // toggle it OFF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.id, voteState]);

  // UX-AUDIT 2026-05-18 Pass X.P2: bookmark toggle.  Server-side
  // /api/social/saved endpoint deferred — for now persist locally
  // via setIsSaved.  The optimistic helper handles the no-op request
  // gracefully (success path runs, no error toast fires).
  const handleBookmarkToggle = (next) => {
    // Local-only for now — when /api/social/saved lands, swap this
    // with savedPostsApi.save(postId) / .unsave(postId).
    return Promise.resolve(next);
  };

  const onComment = () => {
    // Navigate to PostDetail for full comment experience
    navigation.navigate('PostDetail', { postId: userData?.id, post: userData });
  };

  const onShare = () => {
    const postId = userData?.id;
    if (!postId) return;
    postsApi.create({
      content: userData.caption || userData.content || '',
      repost_id: postId,
    }).catch(() => {});
  };

  const onChat = () => {
    try { ActivityStarterModule.navigateToCustomActivity(); } catch (_) {}
  };

  // Theme styles
  const isDark = theme === 'dark';
  const iconText = { ...styles.iconText, color: isDark ? '#fff' : 'grey' };
  const info = { ...styles.info, color: isDark ? 'grey' : 'black' };
  const foricon = { color: isDark ? '#FFF' : 'black' };
  const verticalline = { ...styles.hr, borderBottomColor: isDark ? '#0E1114' : '#dadada' };
  const iconsleft = { ...styles.icons, marginLeft: 5 };

  return (
    <View style={styles.container}>
      <View style={styles.topContainer}>
        <TouchableOpacity style={styles.likes}>
          <ADIcon
            name={voteState === 'up' ? 'like1' : 'like2'}
            size={18}
            color={voteState === 'up' ? '#2ECC71' : (isDark ? '#fff' : '#666')}
          />
          <Text style={[iconText, voteScore > 0 && { color: '#2ECC71' }, voteScore < 0 && { color: '#e74c3c' }]}>
            {' '}{voteScore}
          </Text>
        </TouchableOpacity>
        <Text style={info}>
          {commentCount} Comments | {shareCount || 0} Share
        </Text>
      </View>
      <View style={verticalline} />
      <View style={styles.bottomContainer}>
        {/* Upvote */}
        <GestureHandlerRootView>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <RectButton style={iconsleft} onPress={() => handleVote('up')} rippleColor="lightgrey">
              <ADIcon
                name={voteState === 'up' ? 'like1' : 'like2'}
                size={18}
                color={voteState === 'up' ? '#2ECC71' : (isDark ? '#FFF' : 'black')}
              />
              <Text style={iconText}> Lit</Text>
            </RectButton>
          </Animated.View>
        </GestureHandlerRootView>

        {/* Downvote */}
        <GestureHandlerRootView>
          <RectButton style={styles.iconContainer} onPress={() => handleVote('down')} rippleColor="lightgrey">
            <View style={styles.icons}>
              <ADIcon
                name={voteState === 'down' ? 'dislike1' : 'dislike2'}
                size={18}
                color={voteState === 'down' ? '#e74c3c' : (isDark ? '#FFF' : 'black')}
              />
            </View>
          </RectButton>
        </GestureHandlerRootView>

        {/* Comment */}
        <GestureHandlerRootView>
          <RectButton onPress={onComment} style={styles.iconContainer} rippleColor="lightgrey">
            <View style={styles.icons}>
              <OCIcon name="comment" size={18} style={foricon} />
              <Text style={iconText}> Comment</Text>
            </View>
          </RectButton>
        </GestureHandlerRootView>

        {/* Bookmark — UX-AUDIT 2026-05-18 Pass X.P2 — saves the post
            for later review.  Caller-controlled state lets a future
            P-pass wire it to savedPostsStore + /api/social/saved
            without re-shipping the primitive. */}
        <View style={styles.iconContainer}>
          <BookmarkButton
            postId={userData?.id}
            isSaved={isSaved}
            applyLocal={setIsSaved}
            onToggle={handleBookmarkToggle}
          />
        </View>

        {/* Chat */}
        <GestureHandlerRootView>
          <RectButton onPress={onChat} style={styles.iconContainer} rippleColor="lightgrey">
            <View style={styles.icons}>
              <FIcon name="send" size={18} style={foricon} />
              <Text style={iconText}> Chat</Text>
            </View>
          </RectButton>
        </GestureHandlerRootView>

        {/* Share */}
        <GestureHandlerRootView>
          <RectButton onPress={onShare} style={styles.iconContainer} rippleColor="lightgrey">
            <View style={styles.icons}>
              <FAIcon name="share" size={18} style={foricon} />
            </View>
          </RectButton>
        </GestureHandlerRootView>
      </View>
    </View>
  );
};

export default Footer;
