import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { communitiesApi } from '../../../services/socialApi';
import FilterChips from '../../shared/FilterChips';

// UX-AUDIT 2026-05-20 REDESIGN-R1: Part D.1 wireframe additions
//
// Wireframe deltas vs the prior minimal screen:
//   1. Header overflow + Voice/Video buttons (visible when is_member).
//   2. Banner image placeholder above the info card (cover_url fallback to
//      gradient block).
//   3. Member roster strip — 12 avatars, agent badge on agent members.
//   4. Sort tabs row (Hot / Top / New / Controversial) above the post
//      feed, using the shared FilterChips primitive.
//   5. Reaction chips row on each post card below vote count.
//
// Animatable.View has been removed from primary content for the same
// BROKEN-B-pattern reasons as the recent fixes — visibility is no longer
// gated on a third-party animation library.

const SORT_TABS = [
  { value: 'hot', label: 'Hot' },
  { value: 'top', label: 'Top' },
  { value: 'new', label: 'New' },
  { value: 'controversial', label: 'Controversial' },
];

const DEFAULT_REACTIONS = ['👍', '❤️', '🔥', '😂', '🚀'];

const CommunityDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId } = route.params;
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [sort, setSort] = useState('hot');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, postsRes, membersRes] = await Promise.all([
        communitiesApi.get(communityId),
        communitiesApi.posts(communityId, { limit: 30, sort }).catch(() => ({ data: [] })),
        // Roster strip — best-effort. Older servers may not implement
        // members() yet, in which case the strip silently falls back to
        // empty.
        (communitiesApi.members
          ? communitiesApi.members(communityId, { limit: 12, include_agents: true })
          : Promise.resolve({ data: [] })
        ).catch(() => ({ data: [] })),
      ]);
      setCommunity(subRes.data || null);
      setPosts(postsRes.data || []);
      setMembers(membersRes.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [communityId, sort]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleToggleMembership = async () => {
    if (!community) return;
    try {
      if (community.is_member) {
        await communitiesApi.leave(communityId);
        setCommunity(prev => ({ ...prev, is_member: false, member_count: Math.max(0, (prev.member_count || 1) - 1) }));
      } else {
        await communitiesApi.join(communityId);
        setCommunity(prev => ({ ...prev, is_member: true, member_count: (prev.member_count || 0) + 1 }));
      }
    } catch {
      // silent
    }
  };

  const renderPost = ({ item }) => {
    // Reactions can arrive in two server shapes: `reactions: {emoji: count}`
    // OR `reactions: [{emoji, count}]`. Normalize to the first.
    let reactionMap = {};
    if (Array.isArray(item.reactions)) {
      item.reactions.forEach((r) => {
        if (r && r.emoji) reactionMap[r.emoji] = r.count || 0;
      });
    } else if (item.reactions && typeof item.reactions === 'object') {
      reactionMap = item.reactions;
    }
    const visibleEmojis = DEFAULT_REACTIONS.filter((e) => reactionMap[e] > 0);

    return (
      <View style={styles.postCard}>
        <Text style={styles.postAuthor}>{item.author_name || 'Unknown'}</Text>
        <Text style={styles.postContent} numberOfLines={4}>{item.content}</Text>
        <View style={styles.postFooter}>
          <View style={styles.postStat}>
            <Ionicons name="arrow-up" size={14} color="#888" />
            <Text style={styles.postStatText}>{item.upvotes || 0}</Text>
          </View>
          <View style={styles.postStat}>
            <Ionicons name="chatbubble-outline" size={14} color="#888" />
            <Text style={styles.postStatText}>{item.comment_count || 0}</Text>
          </View>
          {visibleEmojis.length > 0 ? (
            <View style={styles.reactionsStrip}>
              {visibleEmojis.map((emoji) => (
                <View key={emoji} style={styles.reactionChip}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={styles.reactionCount}>{reactionMap[emoji]}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderMemberRoster = () => {
    if (!members || members.length === 0) return null;
    return (
      <View style={styles.rosterStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rosterRow}
        >
          {members.map((m, idx) => {
            const isAgent = m.agent_kind === 'agent' || m.user_type === 'agent';
            const initial = (m.display_name || m.username || '?').slice(0, 1).toUpperCase();
            return (
              <View key={String(m.id || idx)} style={styles.rosterAvatarWrap}>
                <View style={[styles.rosterAvatar, isAgent && styles.rosterAvatarAgent]}>
                  <Text style={styles.rosterAvatarInitial}>{initial}</Text>
                </View>
                {isAgent ? (
                  <View style={styles.rosterAgentBadge}>
                    <MaterialCommunityIcons name="lightning-bolt" size={10} color="#0E1114" />
                  </View>
                ) : null}
              </View>
            );
          })}
          {community && community.member_count > members.length ? (
            <View style={styles.rosterMoreChip}>
              <Text style={styles.rosterMoreText}>
                +{Math.max(0, (community.member_count || 0) - members.length)}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>h/{community?.name || '...'}</Text>
        {/* Voice/Video appear only when the viewer is a member — per
            Part D.1 — and route to CallChannel with parent_kind='community'.
            Falling back silently when the route isn't registered keeps
            the screen safe across older app versions. */}
        {community && community.is_member ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityLabel="Start voice call"
              style={styles.headerIconBtn}
              onPress={() => {
                try {
                  navigation.navigate('CallChannel', {
                    parent_kind: 'community',
                    parent_id: communityId,
                    kind: 'voice',
                  });
                } catch (_) { /* route missing in older builds */ }
              }}
            >
              <Ionicons name="call" size={20} color="#6C63FF" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Start video call"
              style={styles.headerIconBtn}
              onPress={() => {
                try {
                  navigation.navigate('CallChannel', {
                    parent_kind: 'community',
                    parent_id: communityId,
                    kind: 'video',
                  });
                } catch (_) { /* silent fallback */ }
              }}
            >
              <Ionicons name="videocam" size={20} color="#6C63FF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {community && (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoDesc}>{community.description || 'No description'}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoStat}>
                {community.member_count || 0} members
                {typeof community.online_count === 'number' ? ` · ${community.online_count} online` : ''}
              </Text>
              <TouchableOpacity
                style={[styles.joinBtn, community.is_member && styles.joinedBtn]}
                onPress={handleToggleMembership}
              >
                <Text style={[styles.joinText, community.is_member && styles.joinedText]}>
                  {community.is_member ? 'Leave' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {renderMemberRoster()}
        </>
      )}

      <FilterChips items={SORT_TABS} value={sort} onChange={setSort} />

      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPost}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <MaterialCommunityIcons name="post-outline" size={48} color="#555" />
            <Text style={styles.emptyText}>No posts in this community yet</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%') },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: hp('10%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  infoCard: {
    backgroundColor: '#141225', borderRadius: 12, padding: wp('4%'),
    marginHorizontal: wp('4%'), marginBottom: hp('1.5%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  infoDesc: { color: '#CCC', fontSize: wp('3.5%'), marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoStat: { color: '#888', fontSize: wp('3%') },
  joinBtn: { paddingHorizontal: wp('5%'), paddingVertical: hp('0.8%'), borderRadius: 20, backgroundColor: '#6C63FF' },
  joinedBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF6B35' },
  joinText: { color: '#000000', fontWeight: '700', fontSize: wp('3%') },
  joinedText: { color: '#FF6B35' },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  postCard: {
    backgroundColor: '#141225', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  postAuthor: { color: '#6C63FF', fontSize: wp('3.2%'), fontWeight: '600', marginBottom: 4 },
  postContent: { color: '#FFF', fontSize: wp('3.5%'), marginBottom: 8 },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { color: '#888', fontSize: wp('3%') },

  // Part D.1 — Header voice/video actions (visible only when is_member).
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0, 232, 157, 0.12)',
  },

  // Part D.1 — Member roster strip.
  rosterStrip: {
    marginHorizontal: wp('4%'), marginBottom: hp('1.5%'),
  },
  rosterRow: { gap: 8, paddingVertical: 4 },
  rosterAvatarWrap: { position: 'relative' },
  rosterAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2A2A3E',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#3A3A4E',
  },
  rosterAvatarAgent: { borderColor: '#FFD700' },
  rosterAvatarInitial: { color: '#FFF', fontSize: wp('3.5%'), fontWeight: '700' },
  rosterAgentBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FFD700',
    alignItems: 'center', justifyContent: 'center',
  },
  rosterMoreChip: {
    height: 40, borderRadius: 20, paddingHorizontal: 12,
    backgroundColor: '#141225', borderWidth: 1, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  rosterMoreText: { color: '#AAA', fontSize: wp('3%'), fontWeight: '600' },

  // Part D.1 — Reaction chips on post cards.
  reactionsStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reactionEmoji: { fontSize: wp('3.2%') },
  reactionCount: { color: '#CCC', fontSize: wp('2.7%'), fontWeight: '600' },
});

export default CommunityDetailScreen;
