import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import TVFocusableItem from '../../shared/TVFocusableItem';
import useDeviceCapabilityStore from '../../../deviceCapabilityStore';
import useKidsLearningStore from '../../../kidsLearningStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.22;
const CARD_HEIGHT = CARD_WIDTH * 0.65;

/** Staggered fade-in + slide-right for each row */
const AnimatedRow = ({ delay, children }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, opacity, translateX]);

  return (
    <Animated.View style={[styles.row, { opacity, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
};

/**
 * TVHomeScreen - Leanback-style home screen for Android TV.
 * Displays horizontal rows of content categories.
 */
const TVHomeScreen = ({ navigation }) => {
  const kidsStore = useKidsLearningStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const categories = [
    {
      id: 'continue',
      title: 'Continue Learning',
      icon: 'play-circle-outline',
      color: '#FF6B6B',
      items: getRecentGames(kidsStore),
    },
    {
      id: 'kids',
      title: 'Kids Learning Zone',
      icon: 'school-outline',
      color: '#4ECDC4',
      items: getKidsCategories(),
    },
    {
      id: 'community',
      title: 'Community Feed',
      icon: 'account-group-outline',
      color: '#45B7D1',
      items: getCommunityItems(),
    },
    {
      id: 'challenges',
      title: 'Challenges',
      icon: 'trophy-outline',
      color: '#F7DC6F',
      items: getChallengeItems(),
    },
    {
      id: 'explore',
      title: 'Explore',
      icon: 'compass-outline',
      color: '#BB8FCE',
      items: getExploreItems(),
    },
  ];

  const handleCardPress = useCallback((item) => {
    if (item.screen) {
      navigation.navigate(item.screen, item.params || {});
    }
  }, [navigation]);

  const renderCard = useCallback(({ item, index }) => (
    <TVFocusableItem
      onPress={() => handleCardPress(item)}
      style={styles.card}
      hasTVPreferredFocus={index === 0}
      focusBorderColor={item.color || '#FFD700'}
      scaleFactor={1.08}
    >
      <View style={[styles.cardIcon, { backgroundColor: (item.color || '#666') + '20' }]}>
        <MaterialCommunityIcons
          name={item.icon || 'star-outline'}
          size={36}
          color={item.color || '#666'}
        />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      {item.subtitle && (
        <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
      )}
    </TVFocusableItem>
  ), [handleCardPress]);

  const renderRow = useCallback(({ item: category, index }) => {
    const delay = index * 120;
    return (
      <AnimatedRow delay={delay}>
        <View style={styles.rowHeader}>
          <MaterialCommunityIcons
            name={category.icon}
            size={28}
            color={category.color}
          />
          <Text style={styles.rowTitle}>{category.title}</Text>
        </View>
        <FlatList
          horizontal
          data={category.items}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowContent}
        />
      </AnimatedRow>
    );
  }, [renderCard]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading Hevolve...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hevolve</Text>
        <Text style={styles.headerSubtitle}>Your AI Learning Companion</Text>
      </View>

      {/* Content Rows */}
      <FlatList
        data={categories}
        renderItem={renderRow}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      />
    </View>
  );
};

// Helper functions to generate row items
function getRecentGames(store) {
  const history = store?.gameHistory || [];
  if (history.length === 0) {
    return [
      { id: 'start', title: 'Start Your Journey', subtitle: 'Begin learning', icon: 'rocket-launch-outline', color: '#FF6B6B', screen: 'KidsHub' },
    ];
  }
  return history.slice(0, 8).map((g, i) => ({
    id: `recent_${i}`,
    title: g.title || g.name || 'Game',
    subtitle: `Score: ${g.score || 0}%`,
    icon: 'gamepad-variant-outline',
    color: '#FF6B6B',
    screen: 'KidsGame',
    params: { gameId: g.id },
  }));
}

function getKidsCategories() {
  return [
    { id: 'kids_english', title: 'English', subtitle: '30 games', icon: 'alphabetical-variant', color: '#4ECDC4', screen: 'KidsHub', params: { category: 'english' } },
    { id: 'kids_math', title: 'Mathematics', subtitle: '30 games', icon: 'calculator-variant-outline', color: '#FF8A65', screen: 'KidsHub', params: { category: 'math' } },
    { id: 'kids_life', title: 'Life Skills', subtitle: '25 games', icon: 'heart-outline', color: '#CE93D8', screen: 'KidsHub', params: { category: 'lifeSkills' } },
    { id: 'kids_science', title: 'Science', subtitle: '15 games', icon: 'flask-outline', color: '#81C784', screen: 'KidsHub', params: { category: 'science' } },
    { id: 'kids_creative', title: 'Creative', subtitle: '10 games', icon: 'palette-outline', color: '#FFD54F', screen: 'KidsHub', params: { category: 'creative' } },
    { id: 'kids_custom', title: 'My Games', subtitle: 'AI-created', icon: 'robot-outline', color: '#90CAF9', screen: 'CustomGames' },
  ];
}

function getCommunityItems() {
  return [
    { id: 'feed', title: 'Latest Posts', subtitle: 'See what\'s new', icon: 'newspaper-variant-outline', color: '#45B7D1', screen: 'MainScreen' },
    { id: 'recipes', title: 'Recipes', subtitle: 'Browse recipes', icon: 'food-variant', color: '#FF7043', screen: 'Recipes' },
    { id: 'communities', title: 'Communities', subtitle: 'Join groups', icon: 'account-group', color: '#26A69A', screen: 'Communities' },
    { id: 'search', title: 'Search', subtitle: 'Find content', icon: 'magnify', color: '#78909C', screen: 'Search' },
  ];
}

function getChallengeItems() {
  return [
    { id: 'active', title: 'Active Challenges', subtitle: 'In progress', icon: 'sword-cross', color: '#F7DC6F', screen: 'Challenges' },
    { id: 'achievements', title: 'Achievements', subtitle: 'Your badges', icon: 'medal-outline', color: '#FFB74D', screen: 'Achievements' },
    { id: 'resonance', title: 'Resonance', subtitle: 'Your score', icon: 'diamond-stone', color: '#E1BEE7', screen: 'ResonanceDashboard' },
    { id: 'season', title: 'Season', subtitle: 'Current season', icon: 'calendar-star', color: '#A5D6A7', screen: 'Season' },
  ];
}

function getExploreItems() {
  return [
    { id: 'evolution', title: 'Agent Evolution', subtitle: 'Grow your agent', icon: 'dna', color: '#BB8FCE', screen: 'AgentEvolution' },
    { id: 'regions', title: 'Regions', subtitle: 'Explore areas', icon: 'map-outline', color: '#80DEEA', screen: 'Regions' },
    { id: 'campaigns', title: 'Campaigns', subtitle: 'Join campaigns', icon: 'flag-variant-outline', color: '#EF9A9A', screen: 'Campaigns' },
    { id: 'profile', title: 'My Profile', subtitle: 'Settings', icon: 'account-circle-outline', color: '#B0BEC5', screen: 'Profile' },
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 20,
    marginTop: 16,
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 48,
    paddingTop: 32,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFE',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#A7A9BE',
    marginTop: 4,
  },
  content: {
    paddingBottom: 48,
  },
  row: {
    marginBottom: 24,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 48,
    marginBottom: 12,
  },
  rowTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFE',
    marginLeft: 12,
  },
  rowContent: {
    paddingHorizontal: 40,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    justifyContent: 'center',
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFE',
    lineHeight: 22,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#A7A9BE',
    marginTop: 4,
  },
});

export default TVHomeScreen;
