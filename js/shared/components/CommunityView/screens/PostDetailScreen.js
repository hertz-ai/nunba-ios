/**
 * PostDetailScreen — Full post view with comments, voting, and sharing.
 *
 * Navigation params:
 *   - postId: string|number (fetch from API)
 *   - post: object (optional, pre-loaded post data to avoid extra fetch)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StyleSheet, Animated, Share,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/AntDesign';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { Avatar } from 'react-native-elements';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { colors, borderRadius, shadows, fontSize, fontWeight, spacing } from '../../../theme/colors';
import { postsApi, feedApi, shareApi } from '../../../services/socialApi';

const PostDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId, post: preloadedPost } = route.params || {};

  const [post, setPost] = useState(preloadedPost || null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(!preloadedPost);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [voteState, setVoteState] = useState(null); // 'up' | 'down' | null
  const [voteScore, setVoteScore] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Fetch post if not preloaded
  useEffect(() => {
    if (!preloadedPost && postId) {
      (async () => {
        try {
          const res = await postsApi.get(postId);
          const data = res?.data || res;
          setPost(data);
          setVoteScore(data.upvotes - (data.downvotes || 0));
          setVoteState(data.user_vote || null);
        } catch (err) {
          console.warn('PostDetail fetch failed:', err);
        } finally {
          setLoading(false);
        }
      })();
    } else if (preloadedPost) {
      setVoteScore((preloadedPost.upvotes || 0) - (preloadedPost.downvotes || 0));
      setVoteState(preloadedPost.user_vote || null);
    }
  }, [postId, preloadedPost]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!postId && !post?.id) return;
    const id = postId || post?.id;
    setCommentsLoading(true);
    try {
      const res = await postsApi.getComments(id);
      const data = res?.data || res;
      setComments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Comments fetch failed:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, [postId, post?.id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Voting
  const handleVote = async (direction) => {
    const currentVote = voteState;
    const id = postId || post?.id;
    if (!id) return;

    // Optimistic update
    if (currentVote === direction) {
      // Remove vote
      setVoteState(null);
      setVoteScore((prev) => prev + (direction === 'up' ? -1 : 1));
      try { await postsApi.removeVote(id); } catch (_) {}
    } else {
      // New vote or switch
      const scoreDelta = direction === 'up'
        ? (currentVote === 'down' ? 2 : 1)
        : (currentVote === 'up' ? -2 : -1);
      setVoteState(direction);
      setVoteScore((prev) => prev + scoreDelta);
      try {
        if (direction === 'up') await postsApi.upvote(id);
        else await postsApi.downvote(id);
      } catch (_) {}
    }

    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.0, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  // Submit comment
  const handleSubmitComment = async () => {
    const id = postId || post?.id;
    if (!newComment.trim() || !id || submitting) return;

    setSubmitting(true);
    try {
      await postsApi.comment(id, {
        content: newComment.trim(),
        parent_id: replyTo?.id || null,
      });
      setNewComment('');
      setReplyTo(null);
      fetchComments();
    } catch (err) {
      console.warn('Comment submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Share post via native share sheet
  const handleShare = async () => {
    const id = postId || post?.id;
    try {
      const res = await shareApi.createLink('post', id);
      const url = res?.data?.url ? `https://hevolve.ai${res.data.url}` : `https://hevolve.ai/social/post/${id}`;
      await Share.share({ message: `Check this out on Hevolve: ${url}`, url });
    } catch (e) {
      // Fallback to direct URL
      await Share.share({ message: `https://hevolve.ai/social/post/${id}` });
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.max(1, Math.floor(diff / 60000))}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator size="large" color={colors.info} style={{ marginTop: hp('30%') }} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrowleft" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Post</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={s.emptyText}>Post not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrowleft" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Post</Text>
        <TouchableOpacity onPress={handleShare}>
          <Feather name="share" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        {/* Post Author */}
        <View style={s.authorRow}>
          <Avatar
            size={44}
            rounded
            source={post.author_avatar ? { uri: post.author_avatar } : require('../../../images/user1.png')}
          />
          <View style={s.authorInfo}>
            <Text style={s.authorName}>
              {post.author_name || post.username || post.name || 'Unknown'}
            </Text>
            <Text style={s.postTime}>
              {formatTime(post.created_at || post.creation_date)}
            </Text>
          </View>
        </View>

        {/* Post Content */}
        <Text style={s.postContent}>{post.content || post.caption || ''}</Text>

        {/* Post Image */}
        {post.image_url || post.resourceUri ? (
          <View style={s.imageContainer}>
            <Animated.Image
              source={{ uri: post.image_url || post.resourceUri }}
              style={s.postImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Vote Bar */}
        <View style={s.voteBar}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }], flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => handleVote('up')}
              style={[s.voteBtn, voteState === 'up' && s.voteBtnActive]}
            >
              <Icon
                name={voteState === 'up' ? 'like1' : 'like2'}
                size={22}
                color={voteState === 'up' ? colors.success : colors.textSecondary}
              />
            </TouchableOpacity>

            <Text style={[s.voteScore, voteScore > 0 && { color: colors.success }, voteScore < 0 && { color: colors.error }]}>
              {voteScore}
            </Text>

            <TouchableOpacity
              onPress={() => handleVote('down')}
              style={[s.voteBtn, voteState === 'down' && s.voteBtnActive]}
            >
              <Icon
                name={voteState === 'down' ? 'dislike1' : 'dislike2'}
                size={22}
                color={voteState === 'down' ? colors.error : colors.textSecondary}
              />
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={s.actionBtn}>
            <MCIcon name="comment-outline" size={22} color={colors.textSecondary} />
            <Text style={s.actionText}>{comments.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
            <Feather name="share-2" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Comments */}
        <View style={s.commentsSection}>
          <Text style={s.commentsTitle}>
            Comments ({comments.length})
          </Text>

          {commentsLoading ? (
            <ActivityIndicator size="small" color={colors.textMuted} style={{ marginTop: 16 }} />
          ) : comments.length === 0 ? (
            <Text style={s.emptyText}>No comments yet. Be the first!</Text>
          ) : (
            comments.map((comment, idx) => (
              <View key={comment.id || comment.comment_id || idx} style={s.commentCard}>
                <Avatar
                  size={32}
                  rounded
                  source={comment.author_avatar ? { uri: comment.author_avatar } : require('../../../images/user1.png')}
                />
                <View style={s.commentBody}>
                  <View style={s.commentHeader}>
                    <Text style={s.commentAuthor}>
                      {comment.author_name || comment.name || 'User'}
                    </Text>
                    <Text style={s.commentTime}>
                      {formatTime(comment.created_at || comment.creation_date)}
                    </Text>
                  </View>
                  <Text style={s.commentText}>
                    {comment.content || comment.comment || comment.text || ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setReplyTo(comment);
                      setNewComment(`@${comment.author_name || comment.name || 'User'} `);
                    }}
                  >
                    <Text style={s.replyBtn}>Reply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.inputBar}
      >
        {replyTo && (
          <View style={s.replyBanner}>
            <Text style={s.replyBannerText}>
              Replying to {replyTo.author_name || replyTo.name || 'User'}
            </Text>
            <TouchableOpacity onPress={() => { setReplyTo(null); setNewComment(''); }}>
              <Icon name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        <View style={s.inputRow}>
          <TextInput
            style={s.textInput}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textMuted}
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
            style={[s.sendBtn, (!newComment.trim() || submitting) && { opacity: 0.4 }]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Feather name="send" size={20} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  authorInfo: {
    marginLeft: spacing.sm,
  },
  authorName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  postTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  postContent: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  imageContainer: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  postImage: {
    width: '100%',
    height: 240,
    borderRadius: borderRadius.lg,
  },
  voteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  voteBtn: {
    padding: 8,
    borderRadius: borderRadius.md,
  },
  voteBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  voteScore: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    marginHorizontal: 4,
    minWidth: 28,
    textAlign: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.lg,
    padding: 6,
  },
  actionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  commentsSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  commentsTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  commentCard: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  commentBody: {
    flex: 1,
    marginLeft: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  commentTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  commentText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  replyBtn: {
    fontSize: fontSize.xs,
    color: colors.info,
    fontWeight: fontWeight.medium,
    marginTop: 4,
  },
  inputBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundTertiary,
  },
  replyBannerText: {
    fontSize: fontSize.xs,
    color: colors.info,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    maxHeight: 80,
  },
  sendBtn: {
    marginLeft: spacing.sm,
    padding: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundTertiary,
  },
});

export default PostDetailScreen;
