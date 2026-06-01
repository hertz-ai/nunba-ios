import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator, Alert, Animated,
} from 'react-native';
import ParallaxHero from '../../shared/ParallaxHero';
import OpenStatusDot from '../../shared/OpenStatusDot';
import FilterChips from '../../shared/FilterChips';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usersApi, friendsApi } from '../../../services/socialApi';
import ContextBridge from '../components/ContextBridge';
import usePressAnimation from '../../../hooks/usePressAnimation';

// UX-AUDIT 2026-05-20 REDESIGN-R4: Part X.4.3 wireframe deltas:
//   1. Agent badge — purple "AGENT" pill next to display name when
//      `user.is_agent` or `user.agent_kind === 'agent'`.
//   2. OpenStatusDot — green/yellow/grey presence dot near display name.
//   3. "In a call" pill — surfaces when `user.in_call` is set.
//   4. Tabs strip (Posts / Encounters / Reactions / Saved) — Posts is
//      wired today; the other three are nav stubs that route to the
//      already-existing screens (no parallel data fetch).
//
// The full edit-in-sheet pattern stays as-is (existing inline editor
// works on-device); upgrading it to a real BottomSheet is a deferred
// follow-up not blocking the visible redesign.

const PROFILE_TABS = [
  { value: 'posts', label: 'Posts' },
  { value: 'encounters', label: 'Encounters' },
  { value: 'reactions', label: 'Reactions' },
  { value: 'saved', label: 'Saved' },
];

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { onPressIn, onPressOut, animatedStyle: pressStyle } = usePressAnimation(0.96);
  const { userId, isOwnProfile } = route.params || {};
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  // REDESIGN-R4: active profile tab (only 'posts' renders inline; the
  // other tabs route to dedicated screens).
  const [profileTab, setProfileTab] = useState('posts');
  const expCtx = null;
  const resonanceCtx = null;
  const achCtx = null;
  // UX-AUDIT 2026-05-19 P5 wire: scrollY drives ParallaxHero's cover
  // translateY (0.5x parallax) + avatar opacity fade (1→0.7 across 80-160 px).
  const scrollY = useRef(new Animated.Value(0)).current;
  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

  const fetchData = useCallback(async () => {
    try {
      const [userRes, postsRes] = await Promise.all([
        usersApi.get(userId),
        usersApi.posts(userId, { limit: 20 }),
      ]);
      setUser(userRes.data || null);
      setPosts(postsRes.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (user) {
      setEditName(user.display_name || '');
      setEditBio(user.bio || '');
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleSaveProfile = async () => {
    try {
      await usersApi.update(userId, { display_name: editName, bio: editBio });
      setUser(prev => ({ ...prev, display_name: editName, bio: editBio }));
      setEditing(false);
    } catch (err) {
      Alert.alert('Error', err.error || 'Failed to update profile');
    }
  };

  const handleFollow = async () => {
    try {
      if (user.is_following) {
        await usersApi.unfollow(userId);
        setUser(prev => ({ ...prev, is_following: false, follower_count: Math.max(0, (prev.follower_count || 1) - 1) }));
      } else {
        await usersApi.follow(userId);
        setUser(prev => ({ ...prev, is_following: true, follower_count: (prev.follower_count || 0) + 1 }));
      }
    } catch {
      // silent
    }
  };

  // Phase 7c.1 — symmetric Friendship state machine on top of the
  // existing one-directional Follow.  Optimistic local state until a
  // refetch on next FriendsScreen mount catches up.  Backend is
  // flag-gated by `friends_v2` and degrades to 503 when off; the
  // catch arm leaves the button visible so retry is one tap away.
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const handleSendFriendRequest = async () => {
    try {
      await friendsApi.sendRequest(userId);
      setFriendRequestSent(true);
    } catch (e) {
      Alert.alert(
        'Friend request failed',
        e?.error || e?.message || 'Try again later.');
    }
  };

  const renderPost = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <TouchableOpacity
        style={styles.postCard}
        activeOpacity={0.7}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Animated.View style={pressStyle}>
          <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
          <View style={styles.postFooter}>
            <View style={styles.postStat}>
              <Ionicons name="arrow-up" size={14} color="#888" />
              <Text style={styles.postStatText}>{item.upvotes || 0}</Text>
            </View>
            <View style={styles.postStat}>
              <Ionicons name="chatbubble-outline" size={14} color="#888" />
              <Text style={styles.postStatText}>{item.comment_count || 0}</Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderHeader = () => {
    if (!user) return null;
    return (
      <Animatable.View animation="fadeIn">
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{(user.display_name || 'U')[0].toUpperCase()}</Text>
          </View>

          {editing ? (
            <View style={styles.editSection}>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Display name"
                placeholderTextColor="#666"
              />
              <TextInput
                style={[styles.editInput, { height: hp('10%') }]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Bio"
                placeholderTextColor="#666"
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.displayName}>{user.display_name || user.username}</Text>
              <Text style={styles.username}>@{user.username}</Text>
              {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{user.karma || 0}</Text>
                  <Text style={styles.statLabel}>Karma</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{user.follower_count || 0}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{user.following_count || 0}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>

              {/* Context bridges for own profile */}
              {isOwnProfile && (
                <View style={styles.bridgeRow}>
                  {expCtx?.userTopIntent && (
                    <ContextBridge
                      variant="chip"
                      targetScreen="ExperimentDiscovery"
                      params={{ intentFilter: expCtx.userTopIntent }}
                      icon="flask"
                      iconType="community"
                      color="#7C4DFF"
                      title={expCtx.userTopIntent}
                    />
                  )}
                  {resonanceCtx?.streakDays > 0 && (
                    <ContextBridge
                      variant="chip"
                      targetScreen="ResonanceDashboard"
                      icon="local-fire-department"
                      iconType="material"
                      color="#FFD700"
                      title={`${resonanceCtx.streakDays}d streak`}
                    />
                  )}
                  {achCtx?.nearCompleteCount > 0 && (
                    <ContextBridge
                      variant="chip"
                      targetScreen="Achievements"
                      icon="trophy"
                      iconType="ion"
                      color="#F59E0B"
                      title={`${achCtx.nearCompleteCount} close`}
                    />
                  )}
                </View>
              )}

              {isOwnProfile ? (
                <View style={styles.profileActionsRow}>
                  <TouchableOpacity style={styles.editProfileBtn} onPress={() => setEditing(true)}>
                    <Ionicons name="create-outline" size={16} color="#6C63FF" />
                    <Text style={styles.editProfileText}>Edit Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editProfileBtn}
                    onPress={() => navigation.navigate('Friends')}
                    accessibilityLabel="Manage friends, pending requests, and blocks"
                  >
                    <MaterialCommunityIcons name="account-multiple" size={16} color="#6C63FF" />
                    <Text style={styles.editProfileText}>Friends</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.profileActionsRow}>
                  <TouchableOpacity
                    style={[styles.followBtn, user.is_following && styles.followingBtn]}
                    onPress={handleFollow}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                  >
                    <Text style={[styles.followText, user.is_following && styles.followingText]}>
                      {user.is_following ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.friendBtn,
                      friendRequestSent && styles.friendBtnPending,
                    ]}
                    onPress={friendRequestSent ? undefined : handleSendFriendRequest}
                    disabled={friendRequestSent}
                    accessibilityLabel={
                      friendRequestSent
                        ? 'Friend request pending'
                        : 'Send friend request'}
                  >
                    <Ionicons
                      name={friendRequestSent ? 'time-outline' : 'person-add-outline'}
                      size={14}
                      color={friendRequestSent ? '#888' : '#6C63FF'}
                    />
                    <Text style={[
                      styles.friendBtnText,
                      friendRequestSent && styles.friendBtnPendingText,
                    ]}>
                      {friendRequestSent ? 'Pending' : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Posts</Text>
      </Animatable.View>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{user?.display_name || 'Profile'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <AnimatedFlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPost}
        ListHeaderComponent={
          <>
            {/* UX-AUDIT 2026-05-19 P5 wire: ParallaxHero with the
                magazine-style 0.5x cover scroll + bounce-zone scale +
                avatar opacity fade.  scrollY is the Animated.Value
                driven by AnimatedFlatList's onScroll. */}
            <ParallaxHero
              scrollY={scrollY}
              coverUri={user?.cover_url || user?.avatar_url}
              avatarUri={user?.avatar_url}
              name={user?.display_name || user?.username || 'Unknown'}
              subtitle={user?.handle ? `@${user.handle}` : (user?.bio || '')}
              height={200}
            />
            {/* REDESIGN-R4: identity ribbon — presence dot + agent
                badge + in-call pill.  Wired off `user.online_status`,
                `is_agent`, `in_call`.  All optional; absent fields
                render nothing. */}
            {user ? (
              <View style={styles.identityRibbon}>
                {user.online_status ? (
                  <View style={styles.ribbonItem}>
                    <OpenStatusDot status={user.online_status} size={10} />
                    <Text style={styles.ribbonText}>
                      {user.online_status === 'online'
                        ? 'Online'
                        : user.online_status === 'in_call'
                        ? 'In a call'
                        : user.online_status === 'idle'
                        ? 'Idle'
                        : 'Offline'}
                    </Text>
                  </View>
                ) : null}
                {user.is_agent || user.agent_kind === 'agent' ? (
                  <View style={styles.agentRibbonBadge}>
                    <MaterialCommunityIcons
                      name="lightning-bolt"
                      size={12}
                      color="#a78bfa"
                    />
                    <Text style={styles.agentRibbonText}>AGENT</Text>
                  </View>
                ) : null}
                {user.in_call ? (
                  <TouchableOpacity
                    style={styles.inCallPill}
                    onPress={() => {
                      try {
                        navigation.navigate('CallChannel', {
                          call_id: user.in_call.call_id || user.in_call,
                        });
                      } catch (_) { /* silent — route missing */ }
                    }}
                  >
                    <Ionicons name="call" size={12} color="#6C63FF" />
                    <Text style={styles.inCallPillText}>Join call</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {renderHeader()}
            {/* REDESIGN-R4: 4-tab strip. Posts tab keeps the existing
                FlatList data; the other three navigate to their
                dedicated screens (no parallel data fetch in profile). */}
            <FilterChips
              items={PROFILE_TABS}
              value={profileTab}
              onChange={(next) => {
                if (next === 'posts') {
                  setProfileTab('posts');
                  return;
                }
                if (next === 'encounters') {
                  try { navigation.navigate('Encounters'); } catch (_) {}
                } else if (next === 'reactions') {
                  try { navigation.navigate('Notifications'); } catch (_) {}
                } else if (next === 'saved') {
                  try { navigation.navigate('SavedPosts'); } catch (_) {}
                }
              }}
            />
          </>
        }
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <MaterialCommunityIcons name="post-outline" size={48} color="#555" />
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
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
  backButton: { padding: 10 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  centerContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: hp('10%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  profileCard: {
    backgroundColor: '#141225', borderRadius: 16, padding: wp('5%'),
    marginBottom: hp('2%'), borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center',
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#6C63FF22',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarLargeText: { color: '#6C63FF', fontSize: wp('8%'), fontWeight: '700' },
  displayName: { color: '#FFF', fontSize: wp('5%'), fontWeight: '700', marginBottom: 2 },
  username: { color: '#888', fontSize: wp('3.5%'), marginBottom: 8 },
  bio: { color: '#AAA', fontSize: wp('3.5%'), textAlign: 'center', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: wp('8%'), marginVertical: 12 },
  bridgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statItem: { alignItems: 'center' },
  statValue: { color: '#FFF', fontSize: wp('4.5%'), fontWeight: '700' },
  statLabel: { color: '#888', fontSize: wp('3%') },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: wp('5%'), paddingVertical: hp('1%'), borderRadius: 20,
    borderWidth: 1, borderColor: '#6C63FF',
  },
  editProfileText: { color: '#6C63FF', fontWeight: '600', fontSize: wp('3.2%') },
  followBtn: {
    paddingHorizontal: wp('8%'), paddingVertical: hp('1%'), borderRadius: 20, backgroundColor: '#6C63FF',
  },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#6C63FF' },
  followText: { color: '#000000', fontWeight: '700', fontSize: wp('3.5%') },
  followingText: { color: '#6C63FF' },
  profileActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  friendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: wp('4%'), paddingVertical: hp('1%'), borderRadius: 20,
    borderWidth: 1, borderColor: '#6C63FF', backgroundColor: 'transparent',
  },
  friendBtnPending: { borderColor: '#444' },
  friendBtnText: { color: '#6C63FF', fontWeight: '600', fontSize: wp('3.2%') },
  friendBtnPendingText: { color: '#888' },
  editSection: { width: '100%', marginTop: 8 },
  editInput: {
    backgroundColor: '#000000', borderRadius: 12, padding: wp('3%'), color: '#FFF',
    fontSize: wp('3.5%'), marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A',
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingHorizontal: wp('4%'), paddingVertical: hp('0.8%') },
  cancelText: { color: '#888', fontWeight: '600' },

  // REDESIGN-R4 — identity ribbon below ParallaxHero.
  identityRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginHorizontal: wp('4%'),
    marginTop: hp('1%'),
  },
  ribbonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ribbonText: { color: '#CCC', fontSize: wp('3%'), fontWeight: '600' },
  agentRibbonBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderRadius: 8,
  },
  agentRibbonText: {
    color: '#a78bfa', fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
  },
  inCallPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(0,232,157,0.12)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(0,232,157,0.35)',
  },
  inCallPillText: { color: '#6C63FF', fontSize: wp('3%'), fontWeight: '700' },
  saveBtn: { paddingHorizontal: wp('5%'), paddingVertical: hp('0.8%'), borderRadius: 20, backgroundColor: '#6C63FF' },
  saveText: { color: '#000000', fontWeight: '700' },
  sectionTitle: { color: '#FFF', fontSize: wp('4%'), fontWeight: '700', marginBottom: hp('1%') },
  postCard: {
    backgroundColor: '#141225', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  postContent: { color: '#FFF', fontSize: wp('3.5%'), marginBottom: 8 },
  postFooter: { flexDirection: 'row', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { color: '#888', fontSize: wp('3%') },
});

export default ProfileScreen;
