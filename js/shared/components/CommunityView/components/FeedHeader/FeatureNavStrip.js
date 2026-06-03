import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ICON_MAP from '../../../../utils/iconMap';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { hapticLight } from '../../../../services/haptics';
import {
  colors, spacing, borderRadius, fontWeight,
} from '../../../../theme/colors';
import useContextualInsights from '../../../../hooks/useContextualInsights';
import PressableScale from '../../../shared/PressableScale';
import { communitiesApi, notificationsApi } from '../../../../services/socialApi';

/**
 * FeatureNavStrip — primary feature discovery grid for the community
 * feed header.
 *
 * Why grid instead of horizontal scroll:
 *   The previous shipped version was a horizontal-scroll strip of 7
 *   small pill chips with edge fades.  Per-user UX feedback
 *   (2026-05-20): the horizontal scroll hid most features, made each
 *   feature feel like a low-priority chip rather than a real
 *   destination, and required users to know features existed to find
 *   them.  This redesign renders all 8 primary tiles as a 4-column
 *   wrap grid where every feature has equal visual weight.  The
 *   remaining 8 features live behind the final "More" tile which
 *   opens AllFeatures.
 *
 * Layout:
 *   - 2 rows × 4 columns = 8 tiles always visible (no scroll).
 *   - Slots 1–7: signal-personalized features (Games/Encounters/
 *     Resonance pinned, then ranked by active contextual insights).
 *   - Slot 8: "More" → AllFeatures sheet.
 *
 * Each tile:
 *   - Coloured icon background (item.color + alpha) for visual weight.
 *   - Icon centered, label below — square-ish footprint.
 *   - Tappable hit target ~80×92 px ≥ Apple HIG / Material 44pt min.
 */

const ALL_FEATURES = [
  // Core identity (always slots 1-3)
  { icon: 'controller-classic', iconType: 'community', label: 'Games', color: '#FF6B6B', screen: 'GameHub' },
  { icon: 'explore', iconType: 'material', label: 'Encounters', color: '#6C63FF', screen: 'Encounters' },
  { icon: 'wallet', iconType: 'community', label: 'Resonance', color: '#FFD700', screen: 'ResonanceDashboard' },
  // Remaining features (candidates for slots 4-7)
  { icon: 'flask', iconType: 'community', label: 'Experiments', color: '#7C4DFF', screen: 'ExperimentDiscovery' },
  { icon: 'rocket-launch', iconType: 'community', label: 'Campaigns', color: '#8B5CF6', screen: 'Campaigns' },
  { icon: 'trophy', iconType: 'ion', label: 'Achieve', color: '#F59E0B', screen: 'Achievements' },
  { icon: 'earth', iconType: 'community', label: 'Regions', color: '#3B82F6', screen: 'Regions' },
  { icon: 'inbox-multiple', iconType: 'community', label: 'Inbox', color: '#FD1D1D', screen: 'Inbox' },
  // User-requested 2026-06-03: surface ChannelSetup from People feed
  // so connected adapters (Telegram/Discord/Slack/WhatsApp/...) are
  // discoverable without going through AllFeatures or deeplinks.
  { icon: 'link-variant', iconType: 'community', label: 'Channels', color: '#25D366', screen: 'ChannelSetup' },
  { icon: 'account-group', iconType: 'community', label: 'Communities', color: '#06B6D4', screen: 'Communities' },
  { icon: 'dna', iconType: 'community', label: 'Evolution', color: '#10B981', screen: 'AgentEvolution' },
  { icon: 'clipboard-check', iconType: 'community', label: 'Tasks', color: '#00D9FF', screen: 'Tasks' },
  { icon: 'code-tags', iconType: 'community', label: 'Coding', color: '#9D4EDD', screen: 'CodingAgent' },
  { icon: 'calendar-star', iconType: 'community', label: 'Season', color: '#F472B6', screen: 'Season' },
  { icon: 'lan-connect', iconType: 'community', label: 'Network', color: '#FCAF45', screen: 'FederatedFeed' },
  { icon: 'code-braces', iconType: 'community', label: 'Recipes', color: '#0078ff', screen: 'Recipes' },
  { icon: 'search', iconType: 'ion', label: 'Search', color: '#CCCCCC', screen: 'Search' },
];

const PINNED_COUNT = 3;   // Games, Encounters, Resonance
const PRIMARY_TILES = 7;  // 7 features + "More" = 8 tiles (2×4 grid)

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
  onboarding: 'Campaigns',
};

function buildPersonalizedList(signals) {
  const pinned = ALL_FEATURES.slice(0, PINNED_COUNT);
  const candidates = ALL_FEATURES.slice(PINNED_COUNT);

  if (!signals || signals.length === 0) {
    return pinned.concat(candidates.slice(0, PRIMARY_TILES - PINNED_COUNT));
  }

  const screenPriority = {};
  for (const sig of signals) {
    const screen = SIGNAL_TO_SCREEN[sig.type];
    if (screen) {
      screenPriority[screen] = Math.max(screenPriority[screen] || 0, sig.priority || 1);
    }
  }

  const ranked = candidates.map((f, idx) => ({
    feature: f,
    boost: screenPriority[f.screen] || 0,
    order: idx,
  }));
  ranked.sort((a, b) => b.boost - a.boost || a.order - b.order);

  return pinned.concat(ranked.slice(0, PRIMARY_TILES - PINNED_COUNT).map((r) => r.feature));
}

// User-reported 2026-06-03 09:40: tapping More / other tiles while
// the community page is still loading was unreliable.  Root cause:
// the parent passed `() => handleNavigate(item.screen)` inline, a
// brand-new function every render.  React.memo() therefore could
// not skip re-renders, and a re-render triggered by signals /
// feed loading mid-tap killed TouchableOpacity's in-flight press.
// Fix: parent now passes a stable handler + screen prop; the tile
// useCallback-wraps its own press so React.memo can actually memo.
const FeatureTile = React.memo(({ item, onPress, isMore }) => {
  const Icon = ICON_MAP[item.iconType] || MaterialCommunityIcons;
  const tint = isMore ? colors.textMuted : item.color;
  const handlePress = React.useCallback(() => {
    if (typeof onPress === 'function') onPress(item.screen);
  }, [onPress, item.screen]);
  // Polish round 3 2026-06-03: PressableScale gives every tile a
  // subtle spring on press so the grid feels alive on touch.  haptic
  // is false because the parent's handleNavigate already fires
  // hapticLight on tap — no double-pulse.
  return (
    <PressableScale
      onPress={handlePress}
      style={styles.tile}
      scaleTo={0.94}
      haptic={false}
      accessibilityLabel={item.label}
      rippleColor={tint + '33'}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: tint + '1F',
            borderColor: tint + '55',
          },
        ]}
      >
        <Icon name={item.icon} size={26} color={tint} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {item.label}
      </Text>
    </PressableScale>
  );
});

const FeatureNavStrip = () => {
  const navigation = useNavigation();
  const { signals } = useContextualInsights();
  const features = useMemo(() => buildPersonalizedList(signals), [signals]);

  // Polish round 3 perf 2026-06-03: warm the API cache for the
  // likely-next tile destinations so tapping a tile feels instant.
  // Communities + Notifications are the most-tapped tiles per UX-audit;
  // both are 30s-TTL cached in services/apiCache so a duplicate fetch
  // on screen mount is a cache hit.  Fire-and-forget; errors swallowed.
  useEffect(() => {
    try { communitiesApi?.list?.({ limit: 5 })?.catch?.(() => {}); } catch (_) {}
    try { notificationsApi?.unreadCount?.()?.catch?.(() => {}); } catch (_) {}
  }, []);

  const handleNavigate = useCallback(
    (screen) => {
      try { hapticLight(); } catch (_) {}
      navigation.navigate(screen);
    },
    [navigation],
  );

  const handleMore = useCallback(() => {
    try { hapticLight(); } catch (_) {}
    navigation.navigate('AllFeatures');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {features.map((item) => (
          <FeatureTile
            key={item.screen}
            item={item}
            onPress={handleNavigate}
          />
        ))}
        <FeatureTile
          item={{
            icon: 'dots-grid',
            iconType: 'community',
            label: 'More',
            color: colors.textMuted,
            screen: 'AllFeatures',
          }}
          isMore
          onPress={handleMore}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  tile: {
    width: '23%', // 4 cols with small gutter — 23% × 4 + gutters fits screen edge to edge
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 6,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
});

export default FeatureNavStrip;
