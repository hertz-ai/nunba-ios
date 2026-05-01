import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  SafeAreaView, StyleSheet, Animated, RefreshControl, Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import KidsThemeProvider from '../../components/KidsLearning/KidsThemeProvider';
import OfflineBanner from '../../components/KidsLearning/OfflineBanner';
import useKidsLearningStore from '../../../../kidsLearningStore';
import useKidsIntelligenceStore from '../../../../kidsIntelligenceStore';
import useLanguageStore from '../../../../zustandStore';
import {kidsLearningApi} from '../../../../services/kidsLearningApi';
import {
  kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize,
  kidsFontWeight, kidsShadows, CATEGORY_MAP,
} from '../../../../theme/kidsColors';
import {GAME_CONFIGS} from '../../components/KidsLearning/data/gameConfigs';
import NetInfo from '@react-native-community/netinfo';
import useDeviceCapabilityStore from '../../../../deviceCapabilityStore';
import ContextBridge from '../../components/ContextBridge';
import TVFocusableItem from '../../../shared/TVFocusableItem';
import MediaPreloader from '../../components/KidsLearning/shared/MediaPreloader';
import MediaCacheManager from '../../components/KidsLearning/shared/MediaCacheManager';
import GameSounds from '../../components/KidsLearning/shared/SoundManager';
import usePressAnimation from '../../../../hooks/usePressAnimation';

const AGE_GROUPS = [
  {id: 'early', label: '4-6', range: [4, 6]},
  {id: 'middle', label: '7-9', range: [7, 9]},
  {id: 'upper', label: '10-12', range: [10, 12]},
];

const CATEGORIES = [
  {id: 'all', label: 'All', icon: 'apps', color: kidsColors.accent},
  {id: 'english', label: 'English', icon: 'alphabetical-variant', color: kidsColors.english},
  {id: 'math', label: 'Math', icon: 'calculator-variant', color: kidsColors.math},
  {id: 'lifeSkills', label: 'Life Skills', icon: 'heart-pulse', color: kidsColors.lifeSkills},
  {id: 'science', label: 'Science', icon: 'flask', color: kidsColors.science},
  {id: 'creativity', label: 'Creative', icon: 'palette', color: kidsColors.creativity},
  {id: 'custom', label: 'My Games', icon: 'star-circle', color: kidsColors.star},
];

const KidsHubScreen = () => {
  const navigation = useNavigation();
  const { onPressIn, onPressOut, animatedStyle: pressStyle } = usePressAnimation(0.96);
  const {
    ageGroup, setAgeGroup, totalStars, isOnline, setIsOnline, customGames,
    initialized, initialize, gameHistory,
  } = useKidsLearningStore();
  const {initialize: initIntelligence} = useKidsIntelligenceStore();
  const userAge = useLanguageStore(s => s.userAge);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const kidsCtx = null;
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [serverGames, setServerGames] = useState([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const searchTimerRef = useRef(null);

  // Debounce search input (300ms)
  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Share app with friends
  const handleShareApp = useCallback(async () => {
    try {
      await Share.share({
        message:
          'My kid loves learning with Hevolve! 100+ educational games for reading, math, science & more.\n\n' +
          'Download free: https://play.google.com/store/apps/details?id=com.hertzai.hevolve',
        title: 'Hevolve Kids - Learn & Play',
      });
    } catch (_) {}
  }, []);

  // Initialize stores
  useEffect(() => {
    if (!initialized) {
      initialize();
      initIntelligence();
    }
  }, []);

  // Initialize media cache
  useEffect(() => {
    MediaCacheManager.init().catch(() => {});
  }, []);

  // Network monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);

  // Pre-generate media for upcoming games
  useEffect(() => {
    if (isOnline && allGames.length > 0) {
      MediaPreloader.preloadForUpcomingGames(allGames.slice(0, 5)).catch(() => {});
    }
  }, [isOnline, allGames.length > 0]);

  // Auto-detect age group from profile
  useEffect(() => {
    if (userAge && !ageGroup) {
      if (userAge <= 6) setAgeGroup('early');
      else if (userAge <= 9) setAgeGroup('middle');
      else setAgeGroup('upper');
    }
  }, [userAge]);

  // Fetch server-generated games (evolved/new games from agents)
  const fetchServerGames = useCallback(async () => {
    if (!isOnline) return;
    setLoadingServer(true);
    try {
      const response = await kidsLearningApi.getAdaptiveQuestion({
        category: 'all',
        topic: 'game_catalog',
        age: userAge || 8,
        difficulty: 1,
        threeRType: 'registration',
      });
      if (response && response.games) {
        setServerGames(response.games);
      }
    } catch (e) {
      // Server games unavailable, use local only
    } finally {
      setLoadingServer(false);
    }
  }, [isOnline, userAge]);

  useEffect(() => {
    fetchServerGames();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchServerGames();
    setRefreshing(false);
  }, [fetchServerGames]);

  // Combine local + server + custom games
  const allGames = useMemo(() => {
    const local = GAME_CONFIGS || [];
    const combined = [...local, ...serverGames, ...customGames.map(g => ({...g, isCustom: true}))];
    return combined;
  }, [serverGames, customGames]);

  // Filter games
  const filteredGames = useMemo(() => {
    let games = allGames;

    // Filter by category
    if (selectedCategory === 'custom') {
      games = games.filter(g => g.isCustom);
    } else if (selectedCategory !== 'all') {
      games = games.filter(g => g.category === selectedCategory);
    }

    // Filter by age group
    if (ageGroup) {
      const ageRange = AGE_GROUPS.find(a => a.id === ageGroup)?.range;
      if (ageRange) {
        games = games.filter(g => {
          if (!g.ageRange) return true;
          return g.ageRange[0] <= ageRange[1] && g.ageRange[1] >= ageRange[0];
        });
      }
    }

    // Search filter (uses debounced value for performance)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      games = games.filter(g =>
        g.title?.toLowerCase().includes(q) ||
        g.category?.toLowerCase().includes(q) ||
        g.tags?.some(t => t.toLowerCase().includes(q)),
      );
    }

    return games;
  }, [allGames, selectedCategory, ageGroup, debouncedSearch]);

  // Check if game was played before
  const getGameBestScore = (gameId) => {
    const played = gameHistory.find(h => h.gameId === gameId);
    return played ? played.score : null;
  };

  const handleGamePress = (game) => {
    navigation.navigate('KidsGame', {gameConfig: game});
  };

  const renderGameCard = useCallback(({item, index}) => {
    const catInfo = CATEGORY_MAP[item.category] || {color: kidsColors.accent, icon: 'gamepad-variant'};
    const bestScore = getGameBestScore(item.id);
    const isPlayed = bestScore !== null;
    const difficulty = item.difficulty || 1;

    return (
      <Animatable.View animation="fadeInUp" delay={Math.min(index * 50, 500)} duration={400}>
        <TouchableOpacity
          style={styles.gameCard}
          onPress={() => handleGamePress(item)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.7}
        >
          <Animated.View style={pressStyle}>
            {/* Colorful top section with category color */}
            <View style={[styles.cardTopSection, {backgroundColor: catInfo.color + '12'}]}>
              <View style={[styles.cardIcon, {backgroundColor: catInfo.color + '25'}]}>
                <Icon name={item.icon || catInfo.icon} size={36} color={catInfo.color} />
              </View>
              {!isPlayed && (
                <View style={[styles.newBadge, {backgroundColor: catInfo.color}]}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
              {isPlayed && (
                <View style={styles.scoreBadge}>
                  <Icon name="check-circle" size={16} color={kidsColors.correct} />
                </View>
              )}
              {item.isCustom && (
                <View style={styles.customBadge}>
                  <Icon name="account-edit" size={12} color={kidsColors.accent} />
                </View>
              )}
              {item.serverHtml && (
                <View style={[styles.customBadge, {backgroundColor: kidsColors.science + '20'}]}>
                  <Icon name="cloud" size={12} color={kidsColors.science} />
                </View>
              )}
            </View>
            {/* Info section */}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.cardMeta}>
                <View style={styles.difficultyRow}>
                  {[1, 2, 3].map(i => (
                    <View
                      key={i}
                      style={[
                        styles.difficultyDot,
                        {backgroundColor: i <= Math.ceil(difficulty / 2) ? catInfo.color : kidsColors.border},
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.cardTime}>{item.estimatedMinutes || 3}m</Text>
              </View>
            </View>
            {/* Category color accent bar */}
            <View style={[styles.cardAccentBar, {backgroundColor: catInfo.color}]} />
          </Animated.View>
        </TouchableOpacity>
      </Animatable.View>
    );
  }, [gameHistory]);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const gamesPlayedToday = useMemo(() => {
    const today = new Date().toDateString();
    return gameHistory.filter(g => {
      if (!g.date) return false;
      return new Date(g.date).toDateString() === today;
    }).length;
  }, [gameHistory]);

  const renderHeader = () => (
    <View>
      {/* Vibrant Welcome Banner */}
      <Animatable.View animation="fadeIn" duration={600}>
        <View style={styles.welcomeBanner}>
          <View style={styles.welcomeTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon name="arrow-left" size={28} color={kidsColors.textOnDark} />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleShareApp} style={styles.shareBtn}>
                <Icon name="share-variant" size={20} color={kidsColors.textOnDark} />
              </TouchableOpacity>
              <View style={styles.starsCounter}>
                <Icon name="star" size={22} color={kidsColors.star} />
                <Text style={styles.starsText}>{totalStars}</Text>
              </View>
            </View>
          </View>
          <Animatable.View animation="bounceIn" delay={200}>
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeIconRow}>
                <Icon name="rocket-launch" size={40} color={kidsColors.star} />
              </View>
              <Text style={styles.welcomeGreeting}>{getGreeting()}!</Text>
              <Text style={styles.welcomeSubtext}>
                {gamesPlayedToday > 0
                  ? `You've played ${gamesPlayedToday} game${gamesPlayedToday > 1 ? 's' : ''} today! Keep going!`
                  : "Ready to learn something amazing today?"}
              </Text>
            </View>
          </Animatable.View>

          {/* Quick Stats Row */}
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Icon name="gamepad-variant" size={18} color={kidsColors.textOnDark} />
              <Text style={styles.quickStatValue}>{gameHistory.length}</Text>
              <Text style={styles.quickStatLabel}>Games</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Icon name="star" size={18} color={kidsColors.star} />
              <Text style={styles.quickStatValue}>{totalStars}</Text>
              <Text style={styles.quickStatLabel}>Stars</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Icon name="trophy" size={18} color={kidsColors.star} />
              <Text style={styles.quickStatValue}>
                {gameHistory.filter(g => g.isPerfect).length}
              </Text>
              <Text style={styles.quickStatLabel}>Perfect</Text>
            </View>
          </View>
        </View>
      </Animatable.View>

      <OfflineBanner visible={!isOnline} />

      {/* Context bridge: concepts due for review */}
      {kidsCtx?.reviewDueCount > 0 && (
        <ContextBridge
          variant="banner"
          targetScreen="KidsGame"
          params={{ mode: 'review' }}
          icon="school"
          iconType="community"
          color="#6C63FF"
          title={`${kidsCtx?.reviewDueCount} concept${kidsCtx?.reviewDueCount !== 1 ? 's' : ''} need review`}
          subtitle="Practice makes perfect!"
        />
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={22} color={kidsColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search games..."
          placeholderTextColor={kidsColors.textMuted}
          value={searchQuery}
          onChangeText={handleSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setDebouncedSearch(''); }}>
            <Icon name="close-circle" size={20} color={kidsColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Tabs with larger, colorful pill design */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={c => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        renderItem={({item}) => {
          const isActive = selectedCategory === item.id;
          return (
            <TouchableOpacity
              style={[
                styles.categoryTab,
                isActive && {backgroundColor: item.color, borderColor: item.color},
              ]}
              onPress={() => setSelectedCategory(item.id)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.categoryIconBg,
                {backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : item.color + '15'},
              ]}>
                <Icon
                  name={item.icon}
                  size={20}
                  color={isActive ? '#FFF' : item.color}
                />
              </View>
              <Text
                style={[
                  styles.categoryLabel,
                  isActive && {color: '#FFF', fontWeight: kidsFontWeight.bold},
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Age Filter */}
      <View style={styles.ageRow}>
        <Icon name="account-child" size={18} color={kidsColors.textSecondary} />
        <Text style={styles.ageLabel}>Age:</Text>
        {AGE_GROUPS.map(ag => (
          <TouchableOpacity
            key={ag.id}
            style={[
              styles.ageChip,
              ageGroup === ag.id && styles.ageChipActive,
            ]}
            onPress={() => setAgeGroup(ag.id)}
          >
            <Text style={[
              styles.ageChipText,
              ageGroup === ag.id && styles.ageChipTextActive,
            ]}>
              {ag.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Game count */}
      <Text style={styles.gameCount}>
        {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''} available
      </Text>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footer}>
      <TouchableOpacity
        style={styles.progressBanner}
        onPress={() => navigation.navigate('KidsProgress')}
      >
        <Icon name="chart-arc" size={24} color={kidsColors.accent} />
        <Text style={styles.progressText}>My Learning Progress</Text>
        <Icon name="chevron-right" size={24} color={kidsColors.accent} />
      </TouchableOpacity>
    </View>
  );

  return (
    <KidsThemeProvider>
      <SafeAreaView style={styles.container}>
        <FlatList
          data={filteredGames}
          keyExtractor={(item, i) => item.id || String(i)}
          renderItem={renderGameCard}
          numColumns={useDeviceCapabilityStore.getState().deviceType === 'tv' ? 3 : 2}
          columnWrapperStyle={styles.row}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="gamepad-variant" size={64} color={kidsColors.textMuted} />
              <Text style={styles.emptyText}>No games found</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={kidsColors.accent} />
          }
        />

        {/* Create Game FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('GameCreator')}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.85}
        >
          <Icon name="plus" size={28} color={kidsColors.textOnDark} />
          <Text style={styles.fabText}>Create</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </KidsThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
  },
  listContent: {
    paddingBottom: 100,
  },
  welcomeBanner: {
    backgroundColor: kidsColors.accent,
    paddingBottom: kidsSpacing.lg,
    borderBottomLeftRadius: kidsBorderRadius.xxl,
    borderBottomRightRadius: kidsBorderRadius.xxl,
    marginBottom: kidsSpacing.md,
  },
  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: kidsSpacing.md,
    paddingTop: kidsSpacing.md,
  },
  backBtn: {
    padding: kidsSpacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
  },
  shareBtn: {
    padding: kidsSpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: kidsBorderRadius.full,
  },
  starsCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.sm,
    borderRadius: kidsBorderRadius.full,
  },
  starsText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
  welcomeContent: {
    alignItems: 'center',
    paddingVertical: kidsSpacing.md,
  },
  welcomeIconRow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: kidsSpacing.sm,
  },
  welcomeGreeting: {
    fontSize: kidsFontSize.xxl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textOnDark,
    marginBottom: kidsSpacing.xs,
  },
  welcomeSubtext: {
    fontSize: kidsFontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: kidsSpacing.xl,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: kidsSpacing.md,
    marginHorizontal: kidsSpacing.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: kidsBorderRadius.lg,
    paddingVertical: kidsSpacing.sm,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textOnDark,
    marginTop: 2,
  },
  quickStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  quickStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.card,
    marginHorizontal: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.sm,
    borderRadius: kidsBorderRadius.lg,
    gap: kidsSpacing.sm,
    ...kidsShadows.card,
  },
  searchInput: {
    flex: 1,
    fontSize: kidsFontSize.md,
    color: kidsColors.textPrimary,
    paddingVertical: 4,
  },
  categoryList: {
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.md,
    gap: kidsSpacing.sm,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.sm,
    borderRadius: kidsBorderRadius.full,
    backgroundColor: kidsColors.card,
    borderWidth: 1.5,
    borderColor: kidsColors.border,
    marginRight: kidsSpacing.sm,
    ...kidsShadows.card,
  },
  categoryIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textPrimary,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: kidsSpacing.md,
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.sm,
  },
  ageLabel: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textSecondary,
  },
  ageChip: {
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.xs,
    borderRadius: kidsBorderRadius.full,
    backgroundColor: kidsColors.card,
    borderWidth: 1,
    borderColor: kidsColors.border,
  },
  ageChipActive: {
    backgroundColor: kidsColors.accent,
    borderColor: kidsColors.accent,
  },
  ageChipText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textPrimary,
  },
  ageChipTextActive: {
    color: kidsColors.textOnDark,
  },
  gameCount: {
    fontSize: kidsFontSize.xs,
    color: kidsColors.textMuted,
    paddingHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.sm,
  },
  row: {
    paddingHorizontal: kidsSpacing.md,
    gap: kidsSpacing.md,
    marginBottom: kidsSpacing.md,
  },
  gameCard: {
    flex: 1,
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.lg,
    overflow: 'hidden',
    ...kidsShadows.card,
  },
  cardTopSection: {
    alignItems: 'center',
    paddingTop: kidsSpacing.lg,
    paddingBottom: kidsSpacing.md,
    position: 'relative',
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    paddingHorizontal: kidsSpacing.sm,
    paddingBottom: kidsSpacing.md,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    marginBottom: kidsSpacing.xs,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: kidsSpacing.xs,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 3,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTime: {
    fontSize: kidsFontSize.xs,
    color: kidsColors.textMuted,
    fontWeight: kidsFontWeight.medium,
  },
  cardAccentBar: {
    height: 3,
  },
  newBadge: {
    position: 'absolute',
    top: kidsSpacing.xs,
    right: kidsSpacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: kidsBorderRadius.sm,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textOnDark,
    letterSpacing: 0.5,
  },
  scoreBadge: {
    position: 'absolute',
    top: kidsSpacing.xs,
    right: kidsSpacing.xs,
  },
  customBadge: {
    position: 'absolute',
    top: kidsSpacing.xs,
    left: kidsSpacing.xs,
    backgroundColor: kidsColors.accent + '20',
    padding: 4,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.lg,
  },
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    backgroundColor: kidsColors.card,
    paddingVertical: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg,
    ...kidsShadows.card,
  },
  progressText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.accent,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: kidsSpacing.xxl,
  },
  emptyText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textMuted,
    marginTop: kidsSpacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: kidsColors.accent,
    paddingHorizontal: kidsSpacing.lg,
    paddingVertical: kidsSpacing.md,
    borderRadius: kidsBorderRadius.full,
    ...kidsShadows.float,
  },
  fabText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
});

export default KidsHubScreen;
