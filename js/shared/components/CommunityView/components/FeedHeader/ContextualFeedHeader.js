import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, LayoutAnimation,
  UIManager, Platform, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useContextualInsights from '../../../../hooks/useContextualInsights';
import useNotificationStore from '../../../../notificationStore';
import InsightCard from './InsightCard';
import InsightCardSkeleton from './InsightCardSkeleton';
import FeatureNavStrip from './FeatureNavStrip';
import { hapticSuccess, hapticLight } from '../../../../services/haptics';
import { ConfettiOverlay } from '../Gamification';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../../../theme/colors';
import { NativeModules } from 'react-native';
import PressableScale from '../../../shared/PressableScale';
import { ensureCurrentUser, subscribeCurrentUser } from '../../../../services/currentUser';

// Polish round 3 2026-06-03: instead of a generic account-circle
// outline icon, the QuickAccessBar profile slot now renders a
// colored circle with the user's first initial when known.
// Mimics Instagram / Slack / Discord fallback avatar pattern when
// no profile pic URL is available locally.  Falls back to the icon
// while currentUser is still resolving.
const AVATAR_PALETTE = [
  '#6C63FF', '#FF6B6B', '#F59E0B', '#10B981',
  '#3B82F6', '#EC4899', '#7C4DFF', '#FCAF45',
];
const initialOf = (u) => {
  const raw = u?.name || u?.username || u?.email || '';
  const head = String(raw).split('@')[0].trim();
  return head ? head.charAt(0).toUpperCase() : '';
};
const paletteIndex = (s) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n % AVATAR_PALETTE.length;
};

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const QuickAccessBar = () => {
  const navigation = useNavigation();
  // #198 — bell icon now shows an unread badge that lives in the
  // shared zustand notificationStore (live-updated by WAMP via
  // realtimeService).  Filled bell when unread > 0, outline when 0.
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const hasUnread = unreadCount > 0;
  const tap = (screen) => { hapticLight(); navigation.navigate(screen); };

  const [me, setMe] = useState(() => ensureCurrentUser());
  useEffect(() => {
    const unsub = subscribeCurrentUser((u) => setMe({ ...u }));
    return unsub;
  }, []);
  const initial = initialOf(me);
  const avatarColor = initial ? AVATAR_PALETTE[paletteIndex(initial + (me?.email || ''))] : null;
  return (
    <View style={styles.quickAccess}>
      <PressableScale style={styles.quickBtn} onPress={() => tap('Search')} accessibilityLabel="Search" haptic={false} rippleColor="rgba(255,255,255,0.15)">
        <Icon name="magnify" size={22} color={colors.textSecondary} />
      </PressableScale>
      <PressableScale
        style={styles.quickBtn}
        onPress={() => tap('Notifications')}
        accessibilityLabel={hasUnread
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'}
        haptic={false}
        rippleColor="rgba(255,255,255,0.15)"
      >
        <View>
          <Icon
            name={hasUnread ? 'bell' : 'bell-outline'}
            size={22}
            color={hasUnread ? colors.primary : colors.textSecondary}
          />
          {hasUnread && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {unreadCount > 99 ? '99+' : String(unreadCount)}
              </Text>
            </View>
          )}
        </View>
      </PressableScale>
      <PressableScale
        style={[styles.quickBtn, initial && avatarColor ? { backgroundColor: avatarColor } : null]}
        accessibilityLabel={initial ? `Profile, ${me?.name || me?.username || ''}` : 'Profile'}
        haptic={false}
        rippleColor="rgba(255,255,255,0.18)"
        onPress={() => {
          try {
            if (NativeModules?.OnboardingModule?.getUser_id) {
              NativeModules.OnboardingModule.getUser_id((uid) => {
                navigation.navigate('Profile', { userId: Number(uid) || 0, isOwnProfile: true });
              });
              return;
            }
          } catch (_) {}
          navigation.navigate('Profile');
        }}
      >
        {initial ? (
          <Text style={styles.avatarInitial}>{initial}</Text>
        ) : (
          <Icon name="account-circle-outline" size={22} color={colors.textSecondary} />
        )}
      </PressableScale>
    </View>
  );
};

// Gen-Z subline that pairs with the time-aware `greeting` string.
// Each window is intentionally short + casual.
const moodForHour = (h) => {
  if (h < 5)  return '✨ late-night vibes';
  if (h < 12) return '☕ start strong today';
  if (h < 17) return '🚀 keep the streak going';
  if (h < 21) return '🌇 wrap up something good';
  return '🌙 wind down with one rep';
};

const ContextualFeedHeader = () => {
  const { signals, greeting, refreshing, celebrationEvent } = useContextualInsights();
  const prevSignalCount = useRef(signals.length);

  // Animate layout when signals change
  useEffect(() => {
    if (prevSignalCount.current !== signals.length) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      prevSignalCount.current = signals.length;
    }
  }, [signals.length]);

  // Trigger haptic feedback on celebration events
  useEffect(() => {
    if (celebrationEvent) {
      hapticSuccess();
    }
  }, [celebrationEvent]);

  const renderInsightCard = ({ item, index }) => (
    <InsightCard signal={item} index={index} />
  );

  return (
    <View style={styles.container}>
      {/* Celebration overlay */}
      <ConfettiOverlay
        visible={!!celebrationEvent}
        onComplete={() => {}}
      />

      {/* Greeting + quick-access icons (Search, Notifications, Profile).
          User feedback 2026-06-03: "looks like a bad developer
          developed this view" + "make it look like Google B2C +
          Gen Z appealing".  Big hero greeting + time-aware emoji
          + casual subline replaces the small gray label.  Material
          You scale: 32px hero / 14px subline, generous spacing. */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingTextWrap}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}
          </Text>
          <Text style={styles.subGreeting} numberOfLines={1}>
            {moodForHour(new Date().getHours())}
          </Text>
        </View>
        <QuickAccessBar />
      </View>

      {/* Feature nav — always visible, YouTube-style chip bar */}
      <FeatureNavStrip />

      {/* Contextual insight cards — only when signals exist.
          Skeleton previously rendered 3 empty rectangles while loading,
          but most users have no signals to show so the rectangles were
          the only thing in this section.  User-reported 2026-06-02:
          "while loading the community page i see three rectangles".
          The section is now invisible until real signals land. */}
      {signals.length > 0 ? (
        <FlatList
          horizontal
          data={signals}
          keyExtractor={(item) => item.id}
          renderItem={renderInsightCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  greetingTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  subGreeting: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  quickAccess: {
    flexDirection: 'row',
    gap: 4,
  },
  quickBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // #198 — small red count badge over the bell icon; sits in the
  // top-right corner of the bell's 22px icon, doesn't push layout
  // since the parent View wraps the Icon and Badge in a relative
  // positioning context.
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.error || '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    textAlign: 'center',
  },
  // Profile avatar fallback: initial in white on a per-user color
  // tint.  No image lookup needed; works from currentUser cache.
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});

export default ContextualFeedHeader;
