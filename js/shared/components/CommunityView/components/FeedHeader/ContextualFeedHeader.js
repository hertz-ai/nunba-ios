import React, { useEffect, useRef } from 'react';
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
  return (
    <View style={styles.quickAccess}>
      <TouchableOpacity style={styles.quickBtn} onPress={() => tap('Search')} accessibilityLabel="Search">
        <Icon name="magnify" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.quickBtn}
        onPress={() => tap('Notifications')}
        accessibilityLabel={hasUnread
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'}
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
      </TouchableOpacity>
      <TouchableOpacity style={styles.quickBtn} onPress={() => tap('Profile')} accessibilityLabel="Profile">
        <Icon name="account-circle-outline" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
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

      {/* Greeting + quick-access icons (Search, Notifications, Profile) */}
      <View style={styles.greetingRow}>
        <Text style={styles.greeting}>{greeting}</Text>
        <QuickAccessBar />
      </View>

      {/* Feature nav — always visible, YouTube-style chip bar */}
      <FeatureNavStrip />

      {/* Contextual insight cards — only when signals exist */}
      {refreshing && signals.length === 0 ? (
        <InsightCardSkeleton />
      ) : signals.length > 0 ? (
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
    marginBottom: spacing.sm,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    flex: 1,
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
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});

export default ContextualFeedHeader;
