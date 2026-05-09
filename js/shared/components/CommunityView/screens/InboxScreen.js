/**
 * InboxScreen — flagship unified inbox.
 *
 * One screen surfaces every channel (mentions, DMs, invites, friend
 * requests, notifications) with the same row template + provenance
 * chip, so users don't have to hunt across notifications, friends,
 * and conversations to find what's pending.
 *
 * UI pattern lineage:
 *   - LinkedIn  → compact ListRowCard with avatar | body | trailing time
 *   - Instagram → pulsing UnreadDot
 *   - Reddit    → FilterChips with live unread counts + EmptyState
 *   - Discord   → ProvenanceChip ("via #cosmic-tea-club"), ActionSheet
 *
 * Backed by GET /api/social/sync/inbox (HARTOS commit ffe4270 — same
 * `sync_v1` flag as /sync, returns flattened InboxRow shape).
 */
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { inboxApi } from '../../../services/socialApi';
import { colors, spacing } from '../../../theme/colors';
import ListRowCard    from '../../shared/ListRowCard';
import FilterChips    from '../../shared/FilterChips';
import EmptyState     from '../../shared/EmptyState';
import SkeletonRow    from '../../shared/SkeletonRow';
import ActionSheet    from '../../shared/ActionSheet';

/* ── Filter taxonomy ─────────────────────────────────────────────── */

const FILTERS = [
  { value: 'all',           label: 'All',       kinds: null },
  { value: 'mention',       label: 'Mentions',  kinds: ['mention'] },
  { value: 'message',       label: 'Messages',  kinds: ['message'] },
  { value: 'invite',        label: 'Invites',   kinds: ['invite'] },
  { value: 'friendship',    label: 'Friends',   kinds: ['friendship'] },
  { value: 'notification',  label: 'Other',     kinds: ['notification'] },
];

/* ── Inbox row → navigation target ───────────────────────────────── */

const routeForRow = (row) => {
  if (!row) return null;
  // Server may stamp a canonical deep-link; prefer it when present so the
  // routing logic stays a single source of truth on the server side.
  if (row.deep_link && typeof row.deep_link === 'string') {
    return { kind: 'deep_link', value: row.deep_link };
  }
  switch (row.kind) {
    case 'message':
      return {
        kind: 'navigate',
        screen: 'ConversationHistory',
        params: { conversation_id: row.parent_id },
      };
    case 'mention':
      if (row.parent_kind === 'post' || row.parent_kind === 'comment') {
        return {
          kind: 'navigate',
          screen: 'PostDetail',
          params: { postId: row.parent_id },
        };
      }
      if (row.parent_kind === 'community') {
        return {
          kind: 'navigate',
          screen: 'CommunityDetail',
          params: { communityId: row.parent_id },
        };
      }
      return null;
    case 'invite':
      return { kind: 'navigate', screen: 'Invites' };
    case 'friendship':
      return { kind: 'navigate', screen: 'Friends' };
    case 'notification':
    default:
      return { kind: 'navigate', screen: 'Notifications' };
  }
};

/* ── Relative-time formatter (no extra dep) ──────────────────────── */

const ago = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60)       return `${sec}s`;
  if (sec < 3600)     return `${Math.floor(sec / 60)}m`;
  if (sec < 86400)    return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800)   return `${Math.floor(sec / 86400)}d`;
  return new Date(t).toLocaleDateString();
};

/* ── Sender display helper — server may flatten or nest ──────────── */

const senderName = (row) => {
  const s = row.sender || {};
  return (
    s.display_name ||
    s.username ||
    row.sender_name ||
    row.sender_username ||
    'Someone'
  );
};

const senderUri = (row) => {
  const s = row.sender || {};
  return s.avatar_url || row.sender_avatar_url || null;
};

const isAgent = (row) =>
  (row.sender && row.sender.user_type === 'agent') ||
  row.sender_kind === 'agent';

/* ── Screen ──────────────────────────────────────────────────────── */

const InboxScreen = () => {
  const navigation = useNavigation();
  const [rows, setRows]               = useState([]);
  const [cursor, setCursor]           = useState(null);
  const [hasMore, setHasMore]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState('all');
  const [longPressedRow, setLongPressedRow] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  /* ── Data loading ────────────────────────────────────────────── */

  const loadInitial = useCallback(async () => {
    try {
      const res = await inboxApi.list({ limit: 50 });
      const data = (res && res.data) || res || {};
      if (!mountedRef.current) return;
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setCursor(data.cursor || null);
      setHasMore(Boolean(data.has_more));
    } catch (_e) {
      // silent — empty state handles it; user can pull-to-refresh
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await inboxApi.list({ limit: 50 });
      const data = (res && res.data) || res || {};
      if (!mountedRef.current) return;
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setCursor(data.cursor || null);
      setHasMore(Boolean(data.has_more));
    } catch (_e) {
      // silent
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await inboxApi.list({ since: cursor, limit: 50 });
      const data = (res && res.data) || res || {};
      if (!mountedRef.current) return;
      const next = Array.isArray(data.rows) ? data.rows : [];
      setRows((prev) => prev.concat(next));
      setCursor(data.cursor || null);
      setHasMore(Boolean(data.has_more));
    } catch (_e) {
      // silent — user can pull-to-refresh
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore]);

  /* ── Derived: filtered + searched rows + per-filter counts ──── */

  const filteredRows = useMemo(() => {
    const def = FILTERS.find((f) => f.value === filter) || FILTERS[0];
    let out = def.kinds == null
      ? rows
      : rows.filter((r) => def.kinds.includes(r.kind));
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((r) =>
        (senderName(r) || '').toLowerCase().includes(q) ||
        (r.content_preview || '').toLowerCase().includes(q),
      );
    }
    return out;
  }, [rows, filter, search]);

  const filterItems = useMemo(() => {
    // Unread counts per filter — drives the live badges on chips.
    const unreadCount = (kinds) => {
      let n = 0;
      for (const r of rows) {
        if (!r.is_unread) continue;
        if (kinds == null || kinds.includes(r.kind)) n += 1;
      }
      return n;
    };
    return FILTERS.map((f) => ({
      value: f.value,
      label: f.label,
      count: unreadCount(f.kinds),
    }));
  }, [rows]);

  /* ── Row interactions ───────────────────────────────────────── */

  const handlePress = useCallback((row) => {
    const target = routeForRow(row);
    if (!target) return;
    if (target.kind === 'deep_link') {
      // Deep link → for now route via shared deep-link landing screen.
      navigation.navigate('ShareLanding', { url: target.value });
      return;
    }
    if (target.kind === 'navigate') {
      navigation.navigate(target.screen, target.params || {});
    }
  }, [navigation]);

  const handleLongPress = useCallback((row) => {
    setLongPressedRow(row);
  }, []);

  const closeActionSheet = useCallback(() => setLongPressedRow(null), []);

  const markRead = useCallback((row) => {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_unread: false } : r)),
    );
    // Server-side mark-read endpoint is per-kind today; until the
    // unified PATCH lands the optimistic local flip is enough for the
    // user-visible badge to drop.  See plan Part W.
  }, []);

  const markUnread = useCallback((row) => {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_unread: true } : r)),
    );
  }, []);

  const archive = useCallback((row) => {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }, []);

  const actionSheetActions = useMemo(() => {
    if (!longPressedRow) return [];
    const r = longPressedRow;
    return [
      {
        key: 'open',
        label: 'Open',
        icon: 'open-in-new',
        onPress: () => handlePress(r),
      },
      r.is_unread
        ? {
            key: 'read',
            label: 'Mark as read',
            icon: 'email-open-outline',
            onPress: () => markRead(r),
          }
        : {
            key: 'unread',
            label: 'Mark as unread',
            icon: 'email-outline',
            onPress: () => markUnread(r),
          },
      {
        key: 'archive',
        label: 'Archive',
        icon: 'archive-outline',
        destructive: true,
        onPress: () => archive(r),
      },
    ];
  }, [longPressedRow, handlePress, markRead, markUnread, archive]);

  /* ── Render ─────────────────────────────────────────────────── */

  const renderItem = useCallback(({ item, index }) => (
    <ListRowCard
      index={index}
      senderName={senderName(item)}
      senderUri={senderUri(item)}
      isAgent={isAgent(item)}
      preview={item.content_preview}
      channelType={item.channel_type}
      parentLabel={item.parent_label}
      isUnread={Boolean(item.is_unread)}
      trailingTime={ago(item.last_activity_at)}
      onPress={() => handlePress(item)}
      onLongPress={() => handleLongPress(item)}
    />
  ), [handlePress, handleLongPress]);

  const totalUnread = filterItems.find((f) => f.value === 'all')?.count || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Inbox</Text>
          {totalUnread > 0 ? (
            <Text style={styles.subtitle}>{totalUnread} unread</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Search')}
          style={styles.iconBtn}
          accessibilityLabel="Search"
        >
          <Ionicons name="search" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search inbox…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FilterChips items={filterItems} value={filter} onChange={setFilter} />

      {loading ? (
        <SkeletonRow count={6} />
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(item, idx) => String(item.id || idx)}
          renderItem={renderItem}
          contentContainerStyle={
            filteredRows.length === 0
              ? styles.listContentEmpty
              : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyState
              icon={filter === 'all' ? 'inbox-outline' : 'magnify'}
              title={
                filter === 'all'
                  ? 'Inbox zero'
                  : 'Nothing here'
              }
              body={
                filter === 'all'
                  ? 'New mentions, messages, and invites will land here.'
                  : 'Try a different filter or pull to refresh.'
              }
              ctaLabel={search ? 'Clear search' : null}
              onCta={search ? () => setSearch('') : null}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoad}>
                <MaterialCommunityIcons
                  name="dots-horizontal"
                  size={28}
                  color={colors.textMuted}
                />
              </View>
            ) : null
          }
        />
      )}

      <ActionSheet
        visible={Boolean(longPressedRow)}
        title={longPressedRow ? senderName(longPressedRow) : ''}
        actions={actionSheetActions}
        onClose={closeActionSheet}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    padding: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    marginLeft: 8,
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footerLoad: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});

// Test-only export so unit tests can exercise routing logic without a
// full RN render pass.  Not part of the public component contract.
export { routeForRow };
export default InboxScreen;
