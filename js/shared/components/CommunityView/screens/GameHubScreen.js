import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import { useNavigation } from '@react-navigation/native';

import { gamesApi } from '../../../services/socialApi';
import { GAME_CONFIGS } from '../components/KidsLearning/data/gameConfigs';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
} from '../../../theme/colors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_MATCH_CATEGORIES = [
  { key: 'trivia', emoji: '\uD83E\uDDE0', label: 'Trivia', color: '#6C63FF' },
  { key: 'board', emoji: '\u265F\uFE0F', label: 'Board', color: '#FF6B6B' },
  { key: 'arcade', emoji: '\uD83D\uDD79\uFE0F', label: 'Arcade', color: '#2ECC71' },
  { key: 'word', emoji: '\uD83D\uDCDD', label: 'Word', color: '#FFAB00' },
];

const CATEGORY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'trivia', label: 'Trivia' },
  { key: 'board', label: 'Board' },
  { key: 'arcade', label: 'Arcade' },
  { key: 'word', label: 'Word' },
  { key: 'puzzle', label: 'Puzzle' },
  { key: 'party', label: 'Party' },
];

const CATEGORY_COLORS = {
  trivia: '#6C63FF',
  board: '#FF6B6B',
  arcade: '#2ECC71',
  word: '#FFAB00',
  puzzle: '#00B8D9',
  party: '#EC4899',
};

const CATEGORY_EMOJIS = {
  trivia: '\uD83E\uDDE0',
  board: '\u265F\uFE0F',
  arcade: '\uD83D\uDD79\uFE0F',
  word: '\uD83D\uDCDD',
  puzzle: '\uD83E\uDDE9',
  party: '\uD83C\uDF89',
};

const LOBBY_POLL_INTERVAL = 10000;

// ---------------------------------------------------------------------------
// GameHubScreen
// ---------------------------------------------------------------------------

const GameHubScreen = () => {
  const navigation = useNavigation();
  const lobbyTimerRef = useRef(null);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [games, setGames] = useState([]);
  const [featuredGames, setFeaturedGames] = useState([]);
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- Data fetching ----

  const applyFilters = useCallback((list) => {
    let filtered = list;
    if (tab !== 'all') {
      filtered = filtered.filter(g => g.category === tab || g.audience === tab);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(g =>
        (g.title || g.name || '').toLowerCase().includes(q) ||
        (g.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [tab, search]);

  const fetchCatalog = useCallback(async () => {
    let merged;
    try {
      const params = {};
      if (tab !== 'all') params.category = tab;
      if (search.trim()) params.search = search.trim();
      const res = await gamesApi.catalog(params);
      const catalog = res.data || res.games || [];

      // Merge server + local (deduped by id)
      const serverIds = new Set(catalog.map(g => g.id));
      merged = [...catalog, ...GAME_CONFIGS.filter(g => !serverIds.has(g.id))];
    } catch (_) {
      // Server unreachable — local only
      merged = [...GAME_CONFIGS];
    }

    const filtered = applyFilters(merged);
    setGames(filtered);
    if (!search.trim() && tab === 'all') setFeaturedGames(filtered.slice(0, 5));
  }, [tab, search, applyFilters]);

  const fetchLobbies = useCallback(async () => {
    try {
      const res = await gamesApi.list({ status: 'waiting' });
      setLobbies(res.data || []);
    } catch (_) {
      setLobbies([]);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchCatalog(), fetchLobbies()]);
      setLoading(false);
    };
    load();
  }, [fetchCatalog]);

  // Poll lobbies
  useEffect(() => {
    lobbyTimerRef.current = setInterval(fetchLobbies, LOBBY_POLL_INTERVAL);
    return () => {
      if (lobbyTimerRef.current) clearInterval(lobbyTimerRef.current);
    };
  }, [fetchLobbies]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchCatalog(), fetchLobbies()]);
    setRefreshing(false);
  }, [fetchCatalog, fetchLobbies]);

  // ---- Actions ----

  const handleQuickMatch = useCallback(
    async (category) => {
      try {
        const res = await gamesApi.quickMatch({ category });
        if (res.data?.id || res.session_id) {
          navigation.navigate('GameScreen', {
            gameId: res.data?.id || res.session_id,
          });
        }
      } catch (_) {
        // Fallback: navigate to category tab
        setTab(category);
      }
    },
    [navigation],
  );

  const handleGamePress = useCallback(
    (game) => {
      navigation.navigate('GameScreen', { gameId: game.id });
    },
    [navigation],
  );

  const handleLobbyJoin = useCallback(
    async (lobby) => {
      try {
        await gamesApi.join(lobby.id);
        navigation.navigate('GameScreen', { gameId: lobby.id });
      } catch (_) {
        navigation.navigate('GameScreen', { gameId: lobby.id });
      }
    },
    [navigation],
  );

  // ---- Renderers ----

  const renderQuickMatchRow = () => (
    <Animatable.View animation="fadeInDown" delay={100}>
      <Text style={styles.sectionTitle}>Quick Match</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickMatchRow}
      >
        {QUICK_MATCH_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.quickMatchBtn, { borderColor: cat.color }]}
            onPress={() => handleQuickMatch(cat.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickMatchEmoji}>{cat.emoji}</Text>
            <Text style={[styles.quickMatchLabel, { color: cat.color }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animatable.View>
  );

  const renderSearchBar = () => (
    <Animatable.View animation="fadeInUp" delay={150} style={styles.searchContainer}>
      <Icon name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search games..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        onSubmitEditing={fetchCatalog}
      />
      {search.length > 0 && (
        <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
          <Icon name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </Animatable.View>
  );

  const renderCategoryTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryTabsRow}
      style={styles.categoryTabs}
    >
      {CATEGORY_TABS.map((cat) => {
        const isActive = tab === cat.key;
        const chipColor = CATEGORY_COLORS[cat.key] || colors.accent;
        return (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryChip,
              isActive && { backgroundColor: chipColor + '22', borderColor: chipColor },
            ]}
            onPress={() => setTab(cat.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categoryChipText,
                isActive && { color: chipColor },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderFeaturedCard = ({ item }) => {
    const catColor = CATEGORY_COLORS[item.category] || colors.accent;
    return (
      <TouchableOpacity
        style={[styles.featuredCard, { borderColor: catColor + '44' }]}
        onPress={() => handleGamePress(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.featuredIconWrap, { backgroundColor: catColor + '20' }]}>
          <Text style={styles.featuredEmoji}>
            {CATEGORY_EMOJIS[item.category] || '\uD83C\uDFAE'}
          </Text>
        </View>
        <Text style={styles.featuredTitle} numberOfLines={1}>
          {item.title || item.name}
        </Text>
        <View style={styles.featuredMeta}>
          <Icon name="account-group" size={14} color={colors.textSecondary} />
          <Text style={styles.featuredMetaText}>
            {item.min_players || 1}-{item.max_players || 4}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFeaturedSection = () => {
    if (featuredGames.length === 0) return null;
    return (
      <Animatable.View animation="fadeInUp" delay={200}>
        <Text style={styles.sectionTitle}>Featured</Text>
        <FlatList
          data={featuredGames}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderFeaturedCard}
          contentContainerStyle={styles.featuredList}
        />
      </Animatable.View>
    );
  };

  const renderGameCard = ({ item, index }) => {
    const catColor = CATEGORY_COLORS[item.category] || colors.accent;
    const isSolo = item.min_players === 1 && item.max_players === 1;
    return (
      <Animatable.View
        animation="fadeInUp"
        delay={index * 60}
        style={styles.gameCardWrapper}
      >
        <TouchableOpacity
          style={[styles.gameCard, { borderColor: catColor + '33' }]}
          onPress={() => handleGamePress(item)}
          activeOpacity={0.8}
        >
          <Text style={styles.gameCardEmoji}>
            {CATEGORY_EMOJIS[item.category] || '\uD83C\uDFAE'}
          </Text>
          <Text style={styles.gameCardTitle} numberOfLines={2}>
            {item.title || item.name}
          </Text>

          <View style={styles.gameCardChips}>
            <View style={[styles.playerChip, { backgroundColor: catColor + '20' }]}>
              <Icon name="account-group" size={12} color={catColor} />
              <Text style={[styles.playerChipText, { color: catColor }]}>
                {item.min_players || 1}-{item.max_players || 4}
              </Text>
            </View>
            {isSolo && (
              <View style={[styles.soloChip, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.soloChipText, { color: colors.success }]}>Solo</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  const renderGameGrid = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      );
    }
    if (games.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="gamepad-variant-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No games found</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={games}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderGameCard}
        numColumns={2}
        scrollEnabled={false}
        contentContainerStyle={styles.gameGrid}
        columnWrapperStyle={styles.gameGridRow}
      />
    );
  };

  const renderLobbyItem = (lobby) => (
    <TouchableOpacity
      key={lobby.id}
      style={styles.lobbyCard}
      onPress={() => handleLobbyJoin(lobby)}
      activeOpacity={0.8}
    >
      <View style={styles.lobbyLeft}>
        <View style={styles.lobbyLiveDot} />
        <View>
          <Text style={styles.lobbyTitle} numberOfLines={1}>
            {lobby.game_title || lobby.title || 'Game Lobby'}
          </Text>
          <Text style={styles.lobbyMeta}>
            {lobby.player_count || lobby.players?.length || 1}/
            {lobby.max_players || 4} players
          </Text>
        </View>
      </View>
      <View style={styles.lobbyJoinBtn}>
        <Text style={styles.lobbyJoinText}>Join</Text>
      </View>
    </TouchableOpacity>
  );

  const renderLobbiesSection = () => {
    if (lobbies.length === 0) return null;
    return (
      <Animatable.View animation="fadeInUp" delay={300}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Open Lobbies</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDotSmall} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        {lobbies.map(renderLobbyItem)}
      </Animatable.View>
    );
  };

  // ---- Main render ----

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Games</Text>
            <Text style={styles.headerSubtitle}>108+ games</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {renderQuickMatchRow()}
        {renderSearchBar()}
        {renderCategoryTabs()}
        {renderFeaturedSection()}

        <Text style={styles.sectionTitle}>All Games</Text>
        {renderGameGrid()}

        {renderLobbiesSection()}
      </ScrollView>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerCenter: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Section
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Quick Match
  quickMatchRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  quickMatchBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 80,
  },
  quickMatchEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  quickMatchLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingVertical: spacing.sm + 2,
  },
  searchClear: {
    padding: spacing.xs,
  },

  // Category tabs
  categoryTabs: {
    marginTop: spacing.md,
  },
  categoryTabsRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  categoryChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // Featured
  featuredList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  featuredCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    width: 150,
    ...shadows.md,
  },
  featuredIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featuredEmoji: {
    fontSize: 24,
  },
  featuredTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredMetaText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },

  // Game grid
  gameGrid: {
    paddingHorizontal: spacing.md,
  },
  gameGridRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gameCardWrapper: {
    flex: 1,
  },
  gameCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  gameCardEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  gameCardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  gameCardChips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.pill,
    gap: 4,
  },
  playerChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  soloChip: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  soloChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // Loading / Empty
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },

  // Lobbies
  lobbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lobbyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  lobbyLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  lobbyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  lobbyMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  lobbyJoinBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  lobbyJoinText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success + '20',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.success,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
});

export default GameHubScreen;
