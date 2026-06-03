import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import useChannelStore from '../../../channelStore';
import { rfp } from '../../../utils/responsiveFont';
import EmptyState from '../../shared/EmptyState';
import { emptyStatePreset } from '../../shared/emptyStatePresets';

const PAGE_SIZE = 20;

const ROLE_COLORS = {
  user: '#6C63FF',
  assistant: '#6C63FF',
  system: '#FF6B35',
  agent: '#9D4EDD',
  default: '#888',
};

const CHANNEL_COLORS = {
  whatsapp: '#25D366',
  telegram: '#0088cc',
  discord: '#5865F2',
  slack: '#4A154B',
  email: '#EA4335',
  sms: '#6C63FF',
  webhook: '#FF6B35',
  default: '#6C63FF',
};

const formatTimestamp = (ts) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
};

const ConversationHistoryScreen = () => {
  const navigation = useNavigation();
  const conversations = useChannelStore((s) => s.conversations);
  const conversationsLoading = useChannelStore((s) => s.conversationsLoading);
  const conversationsHasMore = useChannelStore((s) => s.conversationsHasMore);
  const fetchConversations = useChannelStore((s) => s.fetchConversations);
  const bindings = useChannelStore((s) => s.bindings);
  const fetchBindings = useChannelStore((s) => s.fetchBindings);

  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const offsetRef = useRef(0);

  const loadData = useCallback(async (channel, reset) => {
    const offset = reset ? 0 : offsetRef.current;
    const params = { limit: PAGE_SIZE, offset };
    if (channel && channel !== 'all') {
      params.channel = channel;
    }
    await fetchConversations(params);
    offsetRef.current = reset ? PAGE_SIZE : offset + PAGE_SIZE;
  }, [fetchConversations]);

  // Mount-only effect.  fetchBindings + loadData are stable Zustand
  // action refs, but listing them in deps caused the screen to render-
  // loop on some devices (user-reported 2026-06-02: "chat history button
  // constantly rerenders").  Loading is idempotent — once-per-mount is
  // the right semantic; user-triggered refresh handles re-fetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchBindings();
    loadData('all', true);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(activeFilter, true);
    setRefreshing(false);
  }, [activeFilter, loadData]);

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    offsetRef.current = 0;
    loadData(filter, true);
  };

  const handleLoadMore = () => {
    if (conversationsLoading || !conversationsHasMore) return;
    loadData(activeFilter, false);
  };

  // Build unique channel list from bindings for filter chips
  const channelFilters = ['all'];
  const seen = new Set();
  (bindings || []).forEach((b) => {
    const ch = (b.channel || '').toLowerCase();
    if (ch && !seen.has(ch)) {
      seen.add(ch);
      channelFilters.push(ch);
    }
  });

  // useCallback so FlatList sees a stable renderItem reference between
  // parent renders. Without it, every conversations array reference change
  // (which Zustand emits on every fetch) triggered a full row re-mount.
  // That was the second flicker source — first was the Animatable.View
  // fadeInUp wrapper below (kept rendering at opacity 0 on RN 0.81 + Hermes,
  // same family of bugs as task #360 batch).
  const renderMessage = React.useCallback(({ item }) => {
    const roleColor = ROLE_COLORS[(item.role || '').toLowerCase()] || ROLE_COLORS.default;
    const channelColor = CHANNEL_COLORS[(item.channel || '').toLowerCase()] || CHANNEL_COLORS.default;
    const roleName = (item.role || 'unknown').charAt(0).toUpperCase() + (item.role || 'unknown').slice(1);

    return (
      <View style={styles.messageCard}>
        <View style={styles.messageHeader}>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '22' }]}>
            <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleName}</Text>
          </View>
          {item.channel ? (
            <View style={[styles.channelBadge, { backgroundColor: channelColor + '18' }]}>
              <Text style={[styles.channelBadgeText, { color: channelColor }]}>
                {item.channel}
              </Text>
            </View>
          ) : null}
          <Text style={styles.timestamp}>{formatTimestamp(item.created_at || item.timestamp)}</Text>
        </View>
        <Text style={styles.messageContent} numberOfLines={6}>
          {item.content || item.message || ''}
        </Text>
      </View>
    );
  }, []);

  const renderFooter = () => {
    if (!conversationsHasMore) return null;
    if (conversationsLoading && conversations.length > 0) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#6C63FF" />
        </View>
      );
    }
    return (
      <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore} activeOpacity={0.7}>
        <Text style={styles.loadMoreText}>Load more</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Channel filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {channelFilters.map((ch) => {
          const isActive = activeFilter === ch;
          const color = ch === 'all' ? '#6C63FF' : (CHANNEL_COLORS[ch] || CHANNEL_COLORS.default);
          return (
            <TouchableOpacity
              key={ch}
              style={[
                styles.filterChip,
                isActive && { backgroundColor: color + '22', borderColor: color },
              ]}
              onPress={() => handleFilterChange(ch)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, isActive && { color }]}>
                {ch === 'all' ? 'All' : ch.charAt(0).toUpperCase() + ch.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Conversation list — always render FlatList so the empty
          loading state and the populated state share the SAME tree.
          User-reported 2026-06-03 10:20: "STILL STILL CHAT HISTORY
          FLICKERS".  Previous code conditionally swapped between a
          centered Spinner and the FlatList, which fully unmounted +
          remounted on every conversationsLoading toggle → visible
          flicker.  Move the spinner into ListEmptyComponent so only
          the empty body swaps; FlatList container stays mounted. */}
      <FlatList
        data={conversations}
        keyExtractor={(item, idx) => String(item.id || idx)}
        renderItem={renderMessage}
        ListEmptyComponent={
          conversationsLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#6C63FF" />
            </View>
          ) : (
            <EmptyState {...emptyStatePreset('no-conversation-history')} />
          )
        }
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
      />
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
    flex: 1, color: '#FFF', fontSize: rfp(4.5),
    fontWeight: '700', textAlign: 'center',
  },
  headerSpacer: { width: 32 },
  filterRow: {
    paddingHorizontal: wp('4%'), paddingBottom: hp('1.5%'), gap: 8,
    // alignItems: 'flex-start' so chip children don't stretch
    // vertically in landscape. Without this, horizontal ScrollView's
    // default cross-axis 'stretch' made the single "All" chip render
    // as a 400+ px tall column on tablet landscape.
    alignItems: 'flex-start',
  },
  filterChip: {
    paddingHorizontal: wp('3.5%'),
    // Switched from hp() to a fixed dp value — hp() was creating
    // wildly inconsistent chip heights across orientations because
    // hp computes off CURRENT window height, which differs between
    // portrait/landscape. Fixed dp gives the same chip in both.
    paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#2A2A3E',
    backgroundColor: '#1A1A2E',
    // Defensive: chip never stretches vertically beyond its content.
    alignSelf: 'flex-start',
  },
  filterChipText: { color: '#888', fontSize: 13, fontWeight: '600' },
  centerContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: hp('15%'),
  },
  emptyText: { color: '#888', fontSize: rfp(3.2), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  messageCard: {
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('0.8%'), borderWidth: 1, borderColor: '#2A2A3E',
  },
  messageHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 6,
  },
  roleBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  roleBadgeText: { fontSize: rfp(2.6), fontWeight: '700' },
  channelBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  channelBadgeText: { fontSize: rfp(2.4), fontWeight: '600' },
  timestamp: { color: '#555', fontSize: rfp(2.4), marginLeft: 'auto' },
  messageContent: {
    color: '#DDD', fontSize: rfp(3.3), lineHeight: rfp(4.5),
  },
  footerLoader: { paddingVertical: hp('2%'), alignItems: 'center' },
  loadMoreBtn: {
    alignItems: 'center', paddingVertical: hp('1.5%'),
    marginTop: hp('0.5%'),
  },
  loadMoreText: { color: '#6C63FF', fontSize: wp('3.2%'), fontWeight: '600' },
});

export default ConversationHistoryScreen;
