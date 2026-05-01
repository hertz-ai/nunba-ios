import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { federationApi, marketingAgentApi } from '../../../services/socialApi';
import useThemeStore from '../../../colorThemeZustand';

const FederatedFeedScreen = () => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const navigation = useNavigation();

  const [posts, setPosts] = useState([]);
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoPostActive, setAutoPostActive] = useState(false);
  const offsetRef = React.useRef(0);

  const fetchFeed = useCallback(async (reset = false) => {
    try {
      if (reset) offsetRef.current = 0;
      const result = await federationApi.feed({ limit: 20, offset: offsetRef.current });
      const feedPosts = result?.data || result?.posts || [];
      if (reset) {
        setPosts(feedPosts);
      } else {
        setPosts(prev => [...prev, ...feedPosts]);
      }
      offsetRef.current += feedPosts.length;
    } catch (e) {
      console.warn('Federation feed error:', e);
    }
  }, []);

  const fetchPeers = useCallback(async () => {
    try {
      const result = await federationApi.discoverPeers();
      setPeers(result?.data || result?.peers || []);
    } catch (e) {}
  }, []);

  const checkAutoPost = useCallback(async () => {
    try {
      const result = await marketingAgentApi.listGoals({ status: 'active' });
      const goals = result?.data || result?.goals || [];
      setAutoPostActive(goals.some(g => g.config_json?.auto_post));
    } catch (e) {}
  }, []);

  useEffect(() => {
    Promise.all([fetchFeed(true), fetchPeers(), checkAutoPost()])
      .finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFeed(true), fetchPeers(), checkAutoPost()]);
    setRefreshing(false);
  };

  const toggleAutoPost = async () => {
    try {
      if (autoPostActive) {
        const result = await marketingAgentApi.listGoals({ status: 'active' });
        const goals = result?.data || result?.goals || [];
        const autoGoal = goals.find(g => g.config_json?.auto_post);
        if (autoGoal) await marketingAgentApi.pauseGoal(autoGoal.id);
        setAutoPostActive(false);
      } else {
        await marketingAgentApi.createAutoPostGoal();
        setAutoPostActive(true);
      }
    } catch (e) {
      console.warn('Auto-post toggle error:', e);
    }
  };

  const boostPost = async (postId) => {
    try {
      await federationApi.boost(postId);
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, is_boosted: true } : p
      ));
    } catch (e) {}
  };

  const sharePost = async (post) => {
    try {
      await Share.share({
        message: `${post.title}\n\n${post.content?.substring(0, 200)}...\n\nShared via Hevolve`,
      });
    } catch (e) {}
  };

  const renderPost = ({ item }) => (
    <View style={[styles.postCard, isDark && styles.postCardDark]}>
      <View style={styles.postOrigin}>
        <MaterialCommunityIcons name="server-network" size={14} color="#00E89D" />
        <Text style={[styles.originText, isDark && styles.textLight]}>
          {item.origin_node_name || 'Peer Node'}
        </Text>
        <Text style={styles.originAuthor}>@{item.origin_author || 'unknown'}</Text>
      </View>

      {item.title ? (
        <Text style={[styles.postTitle, isDark && styles.textLight]}>{item.title}</Text>
      ) : null}

      <Text style={[styles.postContent, isDark && styles.textMuted]} numberOfLines={6}>
        {item.content}
      </Text>

      <View style={styles.postActions}>
        <TouchableOpacity
          style={[styles.actionBtn, item.is_boosted && styles.actionBtnActive]}
          onPress={() => boostPost(item.id)}
          disabled={item.is_boosted}
        >
          <MaterialCommunityIcons
            name={item.is_boosted ? 'rocket-launch' : 'rocket-launch-outline'}
            size={18}
            color={item.is_boosted ? '#00E89D' : '#9CA3AF'}
          />
          <Text style={[styles.actionText, item.is_boosted && styles.actionTextActive]}>
            {item.is_boosted ? 'Boosted' : 'Boost'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => sharePost(item)}>
          <MaterialCommunityIcons name="share-outline" size={18} color="#9CA3AF" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        <View style={styles.postMeta}>
          <MaterialCommunityIcons name="arrow-up" size={14} color="#9CA3AF" />
          <Text style={styles.metaText}>{item.score || 0}</Text>
          <MaterialCommunityIcons name="comment-outline" size={14} color="#9CA3AF" style={{ marginLeft: 8 }} />
          <Text style={styles.metaText}>{item.comment_count || 0}</Text>
        </View>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View>
      {/* Auto-post toggle */}
      <TouchableOpacity
        style={[styles.autoPostBar, autoPostActive && styles.autoPostBarActive]}
        onPress={toggleAutoPost}
      >
        <MaterialCommunityIcons
          name={autoPostActive ? 'robot-happy' : 'robot-outline'}
          size={20}
          color={autoPostActive ? '#00E89D' : '#9CA3AF'}
        />
        <Text style={[styles.autoPostText, autoPostActive && styles.autoPostTextActive]}>
          {autoPostActive ? 'Auto-posting active — curating best content' : 'Tap to auto-create posts from social media'}
        </Text>
        <View style={[styles.toggleDot, autoPostActive && styles.toggleDotActive]} />
      </TouchableOpacity>

      {/* Peer count */}
      <View style={styles.peerBar}>
        <MaterialCommunityIcons name="lan-connect" size={16} color="#00E89D" />
        <Text style={[styles.peerText, isDark && styles.textMuted]}>
          {peers.length} peer{peers.length !== 1 ? 's' : ''} connected — content stays P2P
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, isDark && styles.bgDark]}>
        <ActivityIndicator size="large" color="#00E89D" />
        <Text style={[styles.loadingText, isDark && styles.textMuted]}>
          Discovering peers...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.bgDark]}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="earth-off" size={48} color="#4B5563" />
            <Text style={[styles.emptyTitle, isDark && styles.textLight]}>No federated content yet</Text>
            <Text style={[styles.emptySubtitle, isDark && styles.textMuted]}>
              Follow peer HARTOS instances to see their posts here.{'\n'}
              All content shared directly — no cloud storage.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E89D" />
        }
        onEndReached={() => fetchFeed(false)}
        onEndReachedThreshold={0.5}
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F14' },
  bgDark: { backgroundColor: '#0D0F14' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0F14' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },

  autoPostBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, marginHorizontal: 12, marginTop: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  autoPostBarActive: { borderColor: 'rgba(0,232,157,0.3)', backgroundColor: 'rgba(0,232,157,0.06)' },
  autoPostText: { flex: 1, marginLeft: 10, fontSize: 13, color: '#9CA3AF' },
  autoPostTextActive: { color: '#00E89D' },
  toggleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4B5563' },
  toggleDotActive: { backgroundColor: '#00E89D' },

  peerBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 8, marginHorizontal: 12, marginTop: 8,
  },
  peerText: { marginLeft: 8, fontSize: 12, color: '#6B7280' },

  postCard: {
    marginHorizontal: 12, marginTop: 12, padding: 16, borderRadius: 16,
    backgroundColor: '#1A1D23', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  postCardDark: { backgroundColor: '#1A1D23' },
  postOrigin: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  originText: { marginLeft: 6, fontSize: 12, fontWeight: '600', color: '#E5E7EB' },
  originAuthor: { marginLeft: 8, fontSize: 12, color: '#6B7280' },
  postTitle: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', marginBottom: 6 },
  postContent: { fontSize: 14, lineHeight: 20, color: '#D1D5DB' },
  postActions: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  actionBtnActive: {},
  actionText: { marginLeft: 4, fontSize: 12, color: '#9CA3AF' },
  actionTextActive: { color: '#00E89D' },
  postMeta: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  metaText: { marginLeft: 4, fontSize: 12, color: '#9CA3AF' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyContainer: { flex: 1 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#E5E7EB', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  textLight: { color: '#E5E7EB' },
  textMuted: { color: '#9CA3AF' },
});

export default FederatedFeedScreen;
