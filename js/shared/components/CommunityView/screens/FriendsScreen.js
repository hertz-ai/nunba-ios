/**
 * FriendsScreen — Phase 7c UI for the Friendship state machine.
 *
 * Plan reference: sunny-gliding-eich.md, Part D.9 (wireframes A–D) +
 * Part E.8 (FriendService) + Part F.14 (route registration).
 *
 * Three tabs:
 *   - Friends   — active two-way friendships. Actions: Message, Unfriend, Block.
 *   - Pending   — incoming requests (Accept/Reject) and outgoing (Cancel).
 *   - Blocked   — users this account has blocked. Action: Unblock.
 *
 * Mirrors the dark-card layout of CommunitiesScreen so the visual
 * vocabulary stays consistent across the social surface area.
 *
 * Backend: friendsApi (services/socialApi.js) — flag-gated server-side
 * by `friends_v2`.  When the flag is off, list endpoints return [] via
 * the requires_flag(else_value=[]) decorator pattern, so this screen
 * renders an empty-state without errors on legacy deploys.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator,
  Alert,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { friendsApi } from '../../../services/socialApi';
import EmptyState from '../../shared/EmptyState';
import { emptyStatePreset } from '../../shared/emptyStatePresets';
import { flatListVirtualizationProps } from '../../shared/listPerf';

// UX-AUDIT 2026-05-19: 88px = avatar(48) + 20px row padding both sides
// + 1px separator — measured on Galaxy S22+.  Used as fixed rowHeight
// for FlatList virtualization (60fps scroll on 100+ friends).
const FRIEND_ROW_HEIGHT = 88;

// Tab → preset key map.  Single source of truth for the empty-state
// copy across the three tabs.
const EMPTY_PRESET_FOR_TAB = {
  friends: 'no-friends',
  pending: 'no-pending',
  blocked: 'no-blocked',
};

const TABS = [
  { key: 'friends', label: 'Friends', icon: 'account-multiple' },
  { key: 'pending', label: 'Pending', icon: 'clock-outline' },
  { key: 'blocked', label: 'Blocked', icon: 'block-helper' },
];

const FriendsScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [f, p, b] = await Promise.all([
        friendsApi.list('active').catch(() => ({ data: [] })),
        friendsApi.listPending().catch(() => ({ data: [] })),
        friendsApi.listBlocks().catch(() => ({ data: [] })),
      ]);
      setFriends(f?.data || []);
      setPending(p?.data || []);
      setBlocked(b?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const withBusy = async (id, fn) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  // ── Mutations ────────────────────────────────────────────────────

  const handleAccept = (friendshipId) =>
    withBusy(friendshipId, async () => {
      try {
        await friendsApi.accept(friendshipId);
        await fetchAll();
      } catch (e) {
        Alert.alert('Could not accept', e?.message || 'Try again later.');
      }
    });

  const handleReject = (friendshipId) =>
    withBusy(friendshipId, async () => {
      try {
        await friendsApi.reject(friendshipId);
        await fetchAll();
      } catch (e) {
        Alert.alert('Could not reject', e?.message || 'Try again later.');
      }
    });

  const handleCancel = (friendshipId) =>
    withBusy(friendshipId, async () => {
      try {
        await friendsApi.cancel(friendshipId);
        await fetchAll();
      } catch (e) {
        Alert.alert('Could not cancel', e?.message || 'Try again later.');
      }
    });

  const handleUnfriend = (userId, displayName) => {
    Alert.alert(
      `Unfriend ${displayName || 'this user'}?`,
      'You can send a new friend request later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: () => withBusy(userId, async () => {
            try {
              await friendsApi.unfriend(userId);
              await fetchAll();
            } catch (e) {
              Alert.alert('Could not unfriend', e?.message || 'Try again later.');
            }
          }),
        },
      ],
    );
  };

  const handleBlock = (userId, displayName) => {
    Alert.alert(
      `Block ${displayName || 'this user'}?`,
      'They will no longer be able to message or mention you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => withBusy(userId, async () => {
            try {
              await friendsApi.block(userId);
              await fetchAll();
            } catch (e) {
              Alert.alert('Could not block', e?.message || 'Try again later.');
            }
          }),
        },
      ],
    );
  };

  const handleUnblock = (userId) =>
    withBusy(userId, async () => {
      try {
        await friendsApi.unblock(userId);
        await fetchAll();
      } catch (e) {
        Alert.alert('Could not unblock', e?.message || 'Try again later.');
      }
    });

  const handleMessage = (userId) => {
    // Conversation auto-dedups on (kind='dm', sorted member_hash)
    // so re-tapping just opens the existing thread.
    navigation.navigate('ConversationDetail', {
      kind: 'dm',
      member_ids: [userId],
    });
  };

  // ── Card renderers — one per tab, sharing the row chrome ─────────

  const renderAvatar = (initials) => (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials || '?'}</Text>
    </View>
  );

  const initialsFor = (name, fallback = '?') => {
    if (!name) return fallback;
    return name.trim().slice(0, 2).toUpperCase();
  };

  const renderFriendsCard = ({ item, index }) => {
    const other = item.other_user || {};
    const name = other.display_name || other.username || 'User';
    return (
      <Animatable.View animation="fadeInUp" delay={index * 30}>
        <View style={styles.card}>
          <View style={styles.row}>
            {renderAvatar(initialsFor(name))}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{name}</Text>
              {other.username ? (
                <Text style={styles.handle}>@{other.username}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => handleMessage(other.id)}
              disabled={busyId === other.id}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#000000" />
              <Text style={styles.primaryBtnText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => handleUnfriend(other.id, name)}
              disabled={busyId === other.id}
            >
              <Text style={styles.ghostBtnText}>Unfriend</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconGhost}
              onPress={() => handleBlock(other.id, name)}
              disabled={busyId === other.id}
            >
              <MaterialCommunityIcons name="block-helper" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        </View>
      </Animatable.View>
    );
  };

  const renderPendingCard = ({ item, index }) => {
    const other = item.other_user || {};
    const name = other.display_name || other.username || 'User';
    const isIncoming = item.direction === 'incoming';
    return (
      <Animatable.View animation="fadeInUp" delay={index * 30}>
        <View style={styles.card}>
          <View style={styles.row}>
            {renderAvatar(initialsFor(name))}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.handle}>
                {isIncoming ? 'wants to be friends' : 'request sent'}
              </Text>
            </View>
          </View>
          {isIncoming ? (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => handleAccept(item.id)}
                disabled={busyId === item.id}
              >
                <Ionicons name="checkmark" size={16} color="#000000" />
                <Text style={styles.primaryBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => handleReject(item.id)}
                disabled={busyId === item.id}
              >
                <Text style={styles.ghostBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => handleCancel(item.id)}
                disabled={busyId === item.id}
              >
                <Text style={styles.ghostBtnText}>Cancel request</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animatable.View>
    );
  };

  const renderBlockedCard = ({ item, index }) => {
    const blockedUser = item.blocked_user || {};
    const name = blockedUser.display_name || blockedUser.username || 'User';
    return (
      <Animatable.View animation="fadeInUp" delay={index * 30}>
        <View style={styles.card}>
          <View style={styles.row}>
            {renderAvatar(initialsFor(name))}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{name}</Text>
              {blockedUser.username ? (
                <Text style={styles.handle}>@{blockedUser.username}</Text>
              ) : null}
              {item.reason ? (
                <Text style={styles.reason} numberOfLines={1}>
                  Reason: {item.reason}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => handleUnblock(blockedUser.id)}
              disabled={busyId === blockedUser.id}
            >
              <Text style={styles.ghostBtnText}>Unblock</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animatable.View>
    );
  };

  // ── Tab dispatch ─────────────────────────────────────────────────

  const dataForTab = activeTab === 'friends'
    ? friends
    : activeTab === 'pending'
      ? pending
      : blocked;

  const renderForTab = activeTab === 'friends'
    ? renderFriendsCard
    : activeTab === 'pending'
      ? renderPendingCard
      : renderBlockedCard;

  const emptyForTab = activeTab === 'friends'
    ? { icon: 'account-multiple-outline', text: 'No friends yet — accept a pending request or send one from a profile.' }
    : activeTab === 'pending'
      ? { icon: 'clock-outline', text: 'No pending requests right now.' }
      : { icon: 'block-helper', text: 'You haven’t blocked anyone.' };

  const countFor = (key) => {
    if (key === 'friends') return friends.length;
    if (key === 'pending') return pending.length;
    return blocked.length;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabsBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === t.key }}
          >
            <MaterialCommunityIcons
              name={t.icon}
              size={16}
              color={activeTab === t.key ? '#000000' : '#888'}
            />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
            {countFor(t.key) > 0 ? (
              <View style={[styles.badge, activeTab === t.key && styles.badgeActive]}>
                <Text style={[styles.badgeText, activeTab === t.key && styles.badgeTextActive]}>
                  {countFor(t.key)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={dataForTab}
          keyExtractor={(item) => String(item.id || (item.blocked_user || {}).id)}
          renderItem={renderForTab}
          // UX-AUDIT 2026-05-19 P7 wire: empty state via curated preset.
          // Replaces inline `<MaterialCommunityIcons + Text>` with the
          // single source of truth (3 preset keys for 3 tabs).
          ListEmptyComponent={
            <EmptyState
              {...emptyStatePreset(EMPTY_PRESET_FOR_TAB[activeTab] || 'inbox-empty')}
              onCta={
                activeTab === 'friends'
                  ? () => navigation.navigate('Invites')
                  : null
              }
            />
          }
          // UX-AUDIT 2026-05-19 P10 wire: virtualization (fixed row
          // height = FRIEND_ROW_HEIGHT) → 60fps scroll on 100+ friends.
          {...flatListVirtualizationProps(FRIEND_ROW_HEIGHT)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6C63FF"
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%'),
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1, color: '#FFF', fontSize: wp('5%'),
    fontWeight: '700', textAlign: 'center',
  },
  headerSpacer: { width: 32 },

  tabsBar: {
    flexDirection: 'row',
    marginHorizontal: wp('4%'),
    marginBottom: hp('1.5%'),
    backgroundColor: '#141225',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1%'),
    borderRadius: 8,
    gap: 6,
  },
  tabActive: { backgroundColor: '#6C63FF' },
  tabText: { color: '#888', fontSize: wp('3.2%'), fontWeight: '600' },
  tabTextActive: { color: '#000000', fontWeight: '700' },
  badge: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  badgeActive: { backgroundColor: '#000000' },
  badgeText: { color: '#888', fontSize: wp('2.6%'), fontWeight: '700' },
  badgeTextActive: { color: '#6C63FF' },

  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },

  card: {
    backgroundColor: '#141225',
    borderRadius: 12,
    padding: wp('4%'),
    marginBottom: hp('1%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#6C63FF22',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#6C63FF', fontSize: wp('3.6%'), fontWeight: '700' },
  name: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700' },
  handle: { color: '#888', fontSize: wp('3%'), marginTop: 2 },
  reason: { color: '#666', fontSize: wp('2.8%'), marginTop: 4, fontStyle: 'italic' },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 20,
    gap: 4,
  },
  primaryBtnText: { color: '#000000', fontWeight: '700', fontSize: wp('3%') },
  ghostBtn: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: 'transparent',
  },
  ghostBtnText: { color: '#FFF', fontWeight: '600', fontSize: wp('3%') },
  iconGhost: {
    width: 36, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A',
  },

  centerContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: hp('15%'), paddingHorizontal: wp('8%'),
  },
  emptyText: {
    color: '#888', fontSize: wp('3.5%'),
    marginTop: hp('2%'), textAlign: 'center',
  },
});

export default FriendsScreen;
