/**
 * FilterChips — Reddit-style horizontal pill bar with optional unread
 * counts.  Single-select; the parent owns `value` and gets `onChange`.
 */
import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';

const FilterChips = ({ items = [], value, onChange }) => (
  // 2026-06-20: explicit style with flexGrow:0 — without it, a
  // horizontal ScrollView used in a column-flex parent (InboxScreen,
  // CommunitiesScreen, FriendsScreen) stretched vertically to fill
  // remaining height, turning each pill into a tall narrow column.
  // Verified on Xiaomi tablet portrait screenshot.
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.scroll}
    contentContainerStyle={styles.row}
  >
    {items.map((item) => {
      const active = item.value === value;
      const count = typeof item.count === 'number' ? item.count : null;
      return (
        <TouchableOpacity
          key={item.value}
          onPress={() => onChange && onChange(item.value)}
          activeOpacity={0.75}
          style={[styles.chip, active && styles.chipActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
        >
          <Text
            style={[styles.label, active && styles.labelActive]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {count != null && count > 0 ? (
            <View style={[styles.badge, active && styles.badgeActive]}>
              <Text
                style={[styles.badgeText, active && styles.badgeTextActive]}
              >
                {count > 99 ? '99+' : count}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.textOnDark,
  },
  badge: {
    marginLeft: 6,
    backgroundColor: colors.surfaceOverlay,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.pill,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: colors.textOnDark,
  },
});

export default FilterChips;
