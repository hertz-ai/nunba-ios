import React, { useState, useEffect, useRef } from 'react';
import { Text, View, TouchableOpacity, NativeModules, Animated, DeviceEventEmitter } from 'react-native';
import styles from './styles';
import ADIcon from 'react-native-vector-icons/AntDesign';
import OCIcon from 'react-native-vector-icons/Octicons';
import FIcon from 'react-native-vector-icons/Feather';
import FAIcon from 'react-native-vector-icons/FontAwesome';
import useThemeStore from '../../../../../../colorThemeZustand';
import { useNavigation } from '@react-navigation/native';
// RectButton from react-native-gesture-handler intermittently swallows
// onPress on RN 0.81 + Hermes (live drive 2026-06-03 task #378). Swapping
// to TouchableOpacity matches the NunbaFab pattern that fires reliably
// in the same render tree (Feed FlatList row).
// import { RectButton } from 'react-native-gesture-handler';
import { postsApi, commentsApi } from '../../../../../../services/socialApi';
import BookmarkButton from './BookmarkButton';
import { optimistic } from '../../../../../../services/optimistic';
import useSavedPostsStore from '../../../../../../savedPostsStore';

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
  // UX-AUDIT 2026-05-19 reviewer-fix #2: BookmarkButton now reads/writes
  // through savedPostsStore (AsyncStorage-backed Zustand).  Saves survive
  // app launches.  Server-side /api/social/saved is still deferred but
  // the in-memory + on-disk persistence means the user-visible bookmark
  // is no longer a flicker-and-forget no-op.
  const savedPostsHydrate = useSavedPostsStore((s) => s.hydrate);
  const isSaved = useSavedPostsStore((s) => userData?.id ? s.has(userData.id) : false);
  const savedPostsAdd = useSavedPostsStore((s) => s.add);
  const savedPostsRemove = useSavedPostsStore((s) => s.remove);
  useEffect(() => { savedPostsHydrate(); }, [savedPostsHydrate]);
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

  // UX-AUDIT 2026-05-19 reviewer-fix #2: bookmark toggle now persists
  // via savedPostsStore (AsyncStorage).  Server-side /api/social/saved
  // is deferred — when it lands, swap the Promise.resolve below with
  // savedPostsApi.save(postId) / .unsave(postId).  Local persistence
  // makes the bookmark survive app launches RIGHT NOW.
  const handleBookmarkToggle = (next) => {
    // Note: applyLocal in BookmarkButton already optimistically flips
    // the visual via setIsSaved; we just have to mirror that into the
    // store so the next render of this Footer (or a sibling viewing
    // the same post) reads the same state.
    return Promise.resolve(next);
  };
  const applyBookmark = (next) => {
    const id = userData?.id;
    if (!id) return;
    if (next) savedPostsAdd(id);
    else savedPostsRemove(id);
  };

  const onComment = () => {
    // Guard against undefined postId — TouchableOpacity onPress now fires
    // reliably (vs RectButton silent path), so a stale FlatList row with
    // userData.id=undefined would crash navigation.navigate(...) and
    // bounce Hevolve back to the launcher (live observation 2026-06-03
    // 02:26, task #379). Silent return is the right semantic — the user
    // will just not navigate; there's no meaningful destination for an
    // id-less post.
    if (!userData?.id) return;
    navigation.navigate('PostDetail', { postId: userData.id, post: userData });
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
        {/* Per-button GestureHandlerRootView wrappers were nested inside
            the app-root GestureHandlerRootView (App.js:97). Nested
            roots break touch propagation — taps on RectButton children
            silently ignored on RN 0.81 + react-native-gesture-handler
            2.x. Wrappers removed; RectButton works directly inside the
            app-root GestureHandlerRootView. */}
        {/* Upvote */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity style={iconsleft} onPress={() => handleVote('up')} activeOpacity={0.7}>
            <ADIcon
              name={voteState === 'up' ? 'like1' : 'like2'}
              size={18}
              color={voteState === 'up' ? '#2ECC71' : (isDark ? '#FFF' : 'black')}
            />
            <Text style={iconText}> Lit</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Downvote */}
        <TouchableOpacity style={styles.iconContainer} onPress={() => handleVote('down')} activeOpacity={0.7}>
          <View style={styles.icons}>
            <ADIcon
              name={voteState === 'down' ? 'dislike1' : 'dislike2'}
              size={18}
              color={voteState === 'down' ? '#e74c3c' : (isDark ? '#FFF' : 'black')}
            />
          </View>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity onPress={onComment} style={styles.iconContainer} activeOpacity={0.7}>
          <View style={styles.icons}>
            <OCIcon name="comment" size={18} style={foricon} />
            <Text style={iconText}> Comment</Text>
          </View>
        </TouchableOpacity>

        {/* Bookmark — UX-AUDIT 2026-05-18 Pass X.P2 — saves the post
            for later review.  Caller-controlled state lets a future
            P-pass wire it to savedPostsStore + /api/social/saved
            without re-shipping the primitive. */}
        <View style={styles.iconContainer}>
          <BookmarkButton
            postId={userData?.id}
            isSaved={isSaved}
            applyLocal={applyBookmark}
            onToggle={handleBookmarkToggle}
          />
        </View>

        {/* Chat */}
        <TouchableOpacity onPress={onChat} style={styles.iconContainer} activeOpacity={0.7}>
          <View style={styles.icons}>
            <FIcon name="send" size={18} style={foricon} />
            <Text style={iconText}> Chat</Text>
          </View>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity onPress={onShare} style={styles.iconContainer} activeOpacity={0.7}>
          <View style={styles.icons}>
            <FAIcon name="share" size={18} style={foricon} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Polish round 3 perf 2026-06-03: React.memo so a like / bookmark
// tap on one post doesn't cascade re-renders through every visible
// post's Footer.  Props are mostly primitives + a stable userData
// reference per row, so default shallow-equal is correct here.
export default React.memo(Footer);
