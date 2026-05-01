import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  Platform, StyleSheet,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useNavigation } from '@react-navigation/native';
import ICON_MAP from '../../../../utils/iconMap';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { hapticLight } from '../../../../services/haptics';
import {
  colors, spacing, borderRadius, fontSize, fontWeight, EASINGS,
} from '../../../../theme/colors';
import useContextualInsights from '../../../../hooks/useContextualInsights';

/* ── All 16 features (superset) ── */

const ALL_FEATURES = [
  // Core identity (always slots 1-3)
  { icon: 'controller-classic', iconType: 'community', label: 'Games', color: '#FF6B6B', screen: 'GameHub' },
  { icon: 'explore', iconType: 'material', label: 'Encounters', color: '#00e89d', screen: 'Encounters' },
  { icon: 'wallet', iconType: 'community', label: 'Resonance', color: '#FFD700', screen: 'ResonanceDashboard' },
  // Remaining features (candidates for slots 4-7)
  { icon: 'flask', iconType: 'community', label: 'Experiments', color: '#7C4DFF', screen: 'ExperimentDiscovery' },
  { icon: 'rocket-launch', iconType: 'community', label: 'Campaigns', color: '#8B5CF6', screen: 'Campaigns' },
  { icon: 'trophy', iconType: 'ion', label: 'Achieve', color: '#F59E0B', screen: 'Achievements' },
  { icon: 'earth', iconType: 'community', label: 'Regions', color: '#3B82F6', screen: 'Regions' },
  { icon: 'search', iconType: 'ion', label: 'Search', color: '#CCCCCC', screen: 'Search' },
  { icon: 'notifications', iconType: 'ion', label: 'Alerts', color: '#FF6B35', screen: 'Notifications' },
  { icon: 'account-group', iconType: 'community', label: 'Communities', color: '#06B6D4', screen: 'Communities' },
  { icon: 'dna', iconType: 'community', label: 'Evolution', color: '#10B981', screen: 'AgentEvolution' },
  { icon: 'account-circle', iconType: 'material', label: 'Profile', color: '#6B7280', screen: 'Profile' },
  { icon: 'code-braces', iconType: 'community', label: 'Recipes', color: '#0078ff', screen: 'Recipes' },
  { icon: 'clipboard-check', iconType: 'community', label: 'Tasks', color: '#00D9FF', screen: 'Tasks' },
  { icon: 'code-tags', iconType: 'community', label: 'Coding', color: '#9D4EDD', screen: 'CodingAgent' },
  { icon: 'calendar-star', iconType: 'community', label: 'Season', color: '#F472B6', screen: 'Season' },
  { icon: 'lan-connect', iconType: 'community', label: 'Network', color: '#00E89D', screen: 'FederatedFeed' },
];

const PINNED_COUNT = 3;   // Kids Zone, Encounters, Resonance
const VISIBLE_SLOTS = 7;  // total chips shown (excluding "See All")

/* Map signal types from contextAwarenessStore → feature screens */
const SIGNAL_TO_SCREEN = {
  kids_review: 'KidsHub',
  encounters_nearby: 'Encounters',
  streak_active: 'ResonanceDashboard',
  level_progress: 'ResonanceDashboard',
  experiment_trending: 'ExperimentDiscovery',
  challenges_ending: 'Challenges',
  achievement_near: 'Achievements',
  notifications_unread: 'Notifications',
  tasks_pending: 'Tasks',
  onboarding: 'Campaigns',  // onboarding nudge → Campaigns (get started)
};

/**
 * Build the personalized 7-chip list:
 *   slots 1-3 = pinned core features
 *   slots 4-7 = remaining features ranked by active signal priority, then static order
 */
function buildPersonalizedList(signals) {
  const pinned = ALL_FEATURES.slice(0, PINNED_COUNT);
  const candidates = ALL_FEATURES.slice(PINNED_COUNT);

  if (!signals || signals.length === 0) {
    return pinned.concat(candidates.slice(0, VISIBLE_SLOTS - PINNED_COUNT));
  }

  // Build a screen → max-priority lookup from active signals
  const screenPriority = {};
  for (const sig of signals) {
    const screen = SIGNAL_TO_SCREEN[sig.type];
    if (screen) {
      screenPriority[screen] = Math.max(screenPriority[screen] || 0, sig.priority || 1);
    }
  }

  // Sort candidates: signal-boosted first (by priority desc), then original order
  const ranked = candidates.map((f, idx) => ({
    feature: f,
    boost: screenPriority[f.screen] || 0,
    order: idx,
  }));
  ranked.sort((a, b) => b.boost - a.boost || a.order - b.order);

  return pinned.concat(ranked.slice(0, VISIBLE_SLOTS - PINNED_COUNT).map((r) => r.feature));
}

/* ── Glowing Chip (per-item, manages its own glow + press animation) ── */

const GlowChip = React.memo(({ item, index, onNavigate }) => {
  const glowAnim = useRef(new Animated.Value(0.25)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const Icon = ICON_MAP[item.iconType] || MaterialCommunityIcons;
  const isFeatured = index === 0;

  // iOS glow pulse
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const low = isFeatured ? 0.4 : 0.25;
    const high = isFeatured ? 0.8 : 0.55;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: high,
          duration: 1250,
          easing: EASINGS.smooth,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: low,
          duration: 1250,
          easing: EASINGS.smooth,
          useNativeDriver: false,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [glowAnim, isFeatured]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      tension: 150,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 150,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    try { hapticLight(); } catch (_) {}
    onNavigate(item.screen);
  }, [item.screen, onNavigate]);

  const iosGlowStyle = Platform.OS === 'ios' ? {
    shadowColor: item.color,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: isFeatured ? 12 : 8,
    shadowOpacity: glowAnim,
  } : {};

  const androidGlowProps = Platform.OS === 'android' ? {
    animation: 'pulse',
    iterationCount: 'infinite',
    duration: isFeatured ? 2000 : 2500,
    useNativeDriver: true,
  } : {};

  const Wrapper = Platform.OS === 'android' ? Animatable.View : View;

  return (
    <View>
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, iosGlowStyle]}>
        <TouchableOpacity
          style={[
            styles.chip,
            {
              backgroundColor: item.color + '12',
              borderColor: item.color + '30',
            },
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <Icon name={item.icon} size={16} color={item.color} />
          <Text style={styles.chipLabel}>{item.label}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

/* ── See All tail chip ── */

const SeeAllChip = React.memo(({ onPress }) => (
  <View>
    <TouchableOpacity style={styles.seeAllChip} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name="dots-grid" size={14} color={colors.textMuted} />
      <Text style={styles.seeAllLabel}>See All</Text>
    </TouchableOpacity>
  </View>
));

/* ── Main Strip ── */

const FeatureNavStrip = () => {
  const navigation = useNavigation();
  const { signals } = useContextualInsights();

  // Recompute personalized list only when signals change
  const features = useMemo(() => buildPersonalizedList(signals), [signals]);

  const handleNavigate = useCallback((screen) => {
    navigation.navigate(screen);
  }, [navigation]);

  const handleSeeAll = useCallback(() => {
    hapticLight();
    navigation.navigate('AllFeatures');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {features.map((item, index) => (
          <GlowChip
            key={item.screen}
            item={item}
            index={index}
            onNavigate={handleNavigate}
          />
        ))}
        <SeeAllChip onPress={handleSeeAll} />
      </ScrollView>

      {/* Edge fades */}
      <View style={[styles.edgeFade, styles.edgeFadeLeft]} pointerEvents="none" />
      <View style={[styles.edgeFade, styles.edgeFadeRight]} pointerEvents="none" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    gap: 6,
    // Android elevation for glow
    ...Platform.select({
      android: { elevation: 4 },
      ios: {},
    }),
  },
  chipLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  seeAllChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: 6,
  },
  seeAllLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },
  edgeFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 24,
    zIndex: 1,
  },
  edgeFadeLeft: {
    left: 0,
    backgroundColor: colors.background,
    opacity: 0.7,
    // Gradient illusion: solid at edge, transparent inward
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  edgeFadeRight: {
    right: 0,
    backgroundColor: colors.background,
    opacity: 0.7,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
});

export default FeatureNavStrip;
