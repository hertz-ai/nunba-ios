/**
 * MarketplaceScreen — RN parity for the web SPA's
 * landing-page/src/components/Social/Marketplace/MarketplacePage.jsx.
 *
 * Browse agents and services available for hire.  Card grid with:
 *   - Avatar + name + (sub-)agent name
 *   - 3-line description
 *   - Star rating + HART count
 *   - Spark price chip / "Free" chip
 *   - Hire button → emits `nunba:selectAgent` for a chat composer
 *
 * Filters: 7 category tabs + debounced search.  Pagination via
 * "Load more" button (RN ScrollView doesn't have an easy
 * onEndReached without flipping to FlatList — keeping the simple
 * button keeps the code small and predictable).
 *
 * Backend (HARTOS — routes/api_marketplace.py):
 *   GET /api/social/marketplace/listings?limit=&offset=&category=&q=
 *   GET /api/social/marketplace/categories
 *
 * Service: services/socialApi.js → marketplaceApi.listings.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { marketplaceApi } from '../../../services/socialApi';

const ACCENT = '#6C63FF';
const ACCENT_GREEN = '#00e89d';
const ACCENT_AMBER = '#FFAB00';
const HEART = '#FF6B6B';
const MUTED = '#888';

const CATEGORIES = [
  { label: 'All', value: 'all' },
  { label: 'Content', value: 'content_creation' },
  { label: 'Research', value: 'analysis_research' },
  { label: 'Learning', value: 'learning_tutoring' },
  { label: 'Games', value: 'game_design' },
  { label: 'Creative', value: 'creative' },
  { label: 'Custom', value: 'custom' },
];

// Deterministic avatar gradient base color per listing title.
const PALETTES = [
  '#6C63FF',
  '#FF6B6B',
  '#2ECC71',
  '#00B8D9',
  '#FFAB00',
  '#7C4DFF',
  '#FF4081',
  '#00BFA5',
];
const avatarColor = (name) => {
  if (!name) return PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTES[Math.abs(hash) % PALETTES.length];
};

// HARTOS responses are payload-wrapped: {success, data: [...], meta: {...}}.
// Defensive reader returns {data, meta} regardless of wrap depth.
const unwrap = (res) => {
  if (res && typeof res === 'object' && 'data' in res) {
    return { data: res.data, meta: res.meta || null };
  }
  return { data: res, meta: null };
};

const PAGE_SIZE = 20;

const StarRow = ({ value }) => {
  const filled = Math.floor(value || 0);
  const half = (value || 0) - filled >= 0.5;
  return (
    <View style={{ flexDirection: 'row' }}>
      {[0, 1, 2, 3, 4].map((i) => {
        let name = 'star-border';
        if (i < filled) name = 'star';
        else if (i === filled && half) name = 'star-half';
        return (
          <MaterialIcons
            key={i}
            name={name}
            size={14}
            color={ACCENT_AMBER}
          />
        );
      })}
    </View>
  );
};

const MarketplaceScreen = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce search input to avoid re-fetching on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async ({ reset } = { reset: false }) => {
      const o = reset ? 0 : offset;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = { limit: PAGE_SIZE, offset: o };
        if (category !== 'all') params.category = category;
        if (searchDebounced) params.q = searchDebounced;
        const res = await marketplaceApi.listings(params);
        const { data, meta } = unwrap(res);
        const items = Array.isArray(data) ? data : [];
        setListings((prev) => (reset ? items : [...prev, ...items]));
        setHasMore(meta ? !!meta.has_more : items.length === PAGE_SIZE);
        setOffset(o + items.length);
      } catch (_) {
        if (reset) setListings([]);
      } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [category, searchDebounced, offset],
  );

  // Reload on filter / search change.
  useEffect(() => {
    setListings([]);
    setOffset(0);
    setHasMore(true);
    load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, searchDebounced]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    await load({ reset: true });
    setRefreshing(false);
  }, [load]);

  const handleHire = useCallback((listing) => {
    DeviceEventEmitter.emit('nunba:selectAgent', {
      agentId: listing.agent_id || listing.id,
      agentName: listing.agent_name || listing.title,
      context: listing.title,
    });
  }, []);

  const renderTabs = useMemo(
    () => (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        testID="marketplace-tabs"
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat.value;
          return (
            <TouchableOpacity
              key={cat.value}
              onPress={() => setCategory(cat.value)}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`marketplace-tab-${cat.value}`}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    ),
    [category],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={ACCENT_GREEN}
        />
      }
      testID="marketplace-screen"
    >
      <Text style={styles.heading}>Marketplace</Text>

      <View style={styles.searchRow}>
        <MaterialIcons
          name="search"
          size={18}
          color={MUTED}
          style={{ marginRight: 6 }}
        />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search agents and services…"
          placeholderTextColor={MUTED}
          autoCapitalize="none"
          autoCorrect={false}
          testID="marketplace-search-input"
        />
      </View>

      {renderTabs}

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT_GREEN} />
        </View>
      )}

      {!loading && listings.length === 0 && (
        <View style={[styles.card, styles.emptyCard]} testID="marketplace-empty">
          <MaterialIcons
            name="storefront"
            size={32}
            color={MUTED}
            style={{ marginBottom: 8 }}
          />
          <Text style={styles.emptyTitle}>No listings yet</Text>
          <Text style={styles.emptyBody}>
            {searchDebounced
              ? 'Try a different search term.'
              : 'Pull to refresh to check for new listings.'}
          </Text>
        </View>
      )}

      {!loading &&
        listings.map((listing) => {
          const initial = (
            (listing.agent_name || listing.title || '?')[0] || '?'
          ).toUpperCase();
          const color = avatarColor(listing.title || listing.agent_name);
          const isFree = !listing.spark_price;
          return (
            <View
              key={listing.id}
              style={styles.card}
              testID={`marketplace-listing-${listing.id}`}
            >
              <View style={styles.headerRow}>
                <View style={[styles.avatar, { backgroundColor: color }]}>
                  <Text style={styles.avatarLetter}>{initial}</Text>
                  <View style={styles.botBadge}>
                    <MaterialIcons
                      name="smart-toy"
                      size={10}
                      color="#FFF"
                    />
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {listing.title || listing.agent_name}
                  </Text>
                  {!!listing.agent_name &&
                    listing.title !== listing.agent_name && (
                      <Text style={styles.byLine}>by {listing.agent_name}</Text>
                    )}
                </View>
              </View>
              <Text style={styles.cardBody} numberOfLines={3}>
                {listing.description || 'No description provided.'}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.starsBlock}>
                  <StarRow value={listing.rating || 0} />
                  <Text style={styles.starText}>
                    {listing.rating ? listing.rating.toFixed(1) : '--'}
                  </Text>
                </View>
                <View style={styles.heartsBlock}>
                  <MaterialIcons name="favorite" size={14} color={HEART} />
                  <Text style={styles.heartsText}>
                    {listing.hart_count || 0}
                  </Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <View
                  style={[
                    styles.priceChip,
                    isFree ? styles.priceFree : styles.priceSpark,
                  ]}
                >
                  <MaterialIcons
                    name="bolt"
                    size={12}
                    color={isFree ? '#2ECC71' : ACCENT_AMBER}
                  />
                  <Text
                    style={[
                      styles.priceText,
                      { color: isFree ? '#2ECC71' : ACCENT_AMBER },
                    ]}
                  >
                    {isFree ? 'Free' : `${listing.spark_price} Spark`}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleHire(listing)}
                  style={styles.hireButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Hire ${
                    listing.title || listing.agent_name
                  }`}
                  testID={`marketplace-hire-${listing.id}`}
                >
                  <Text style={styles.hireText}>Hire</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

      {!loading && hasMore && listings.length > 0 && (
        <TouchableOpacity
          onPress={() => load({ reset: false })}
          style={styles.loadMore}
          disabled={loadingMore}
          accessibilityRole="button"
          accessibilityLabel="Load more listings"
          testID="marketplace-load-more"
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <Text style={styles.loadMoreText}>Load more</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: wp('4%') },
  heading: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    marginBottom: hp('1.2%'),
  },
  center: { paddingVertical: hp('4%'), alignItems: 'center' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a3e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: wp('3%'),
    marginBottom: hp('1.2%'),
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('3.4%'),
    paddingVertical: hp('1%'),
  },
  tabsRow: { paddingVertical: hp('0.4%'), gap: 6 },
  tab: {
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.6%'),
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginRight: 6,
  },
  tabActive: { backgroundColor: 'rgba(108,99,255,0.18)' },
  tabText: { color: MUTED, fontSize: wp('3%'), fontWeight: '600' },
  tabTextActive: { color: '#FFF' },
  card: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('4%'),
    marginTop: hp('1.2%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyCard: { alignItems: 'center', paddingVertical: hp('5%') },
  emptyTitle: {
    color: '#FFF',
    fontSize: wp('3.8%'),
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyBody: { color: MUTED, fontSize: wp('3%'), textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarLetter: { color: '#FFF', fontWeight: '700', fontSize: wp('4.4%') },
  botBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  cardTitle: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700' },
  byLine: { color: MUTED, fontSize: wp('2.9%'), marginTop: 2 },
  cardBody: {
    color: MUTED,
    fontSize: wp('3.2%'),
    lineHeight: wp('4.4%'),
    marginBottom: hp('1%'),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: hp('1%'),
  },
  starsBlock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starText: { color: MUTED, fontSize: wp('2.8%'), fontWeight: '600' },
  heartsBlock: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  heartsText: { color: MUTED, fontSize: wp('2.8%'), fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  priceSpark: {
    backgroundColor: 'rgba(255,171,0,0.12)',
    borderColor: 'rgba(255,171,0,0.25)',
  },
  priceFree: {
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderColor: 'rgba(46,204,113,0.25)',
  },
  priceText: { fontSize: wp('2.9%'), fontWeight: '700' },
  hireButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1%'),
    borderRadius: 8,
  },
  hireText: { color: '#FFF', fontWeight: '700', fontSize: wp('3.2%') },
  loadMore: {
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    paddingVertical: hp('1.4%'),
    alignItems: 'center',
    marginTop: hp('1.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  loadMoreText: { color: ACCENT, fontWeight: '600', fontSize: wp('3.4%') },
});

export default MarketplaceScreen;
