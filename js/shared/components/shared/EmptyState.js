/**
 * EmptyState — Reddit-style centered empty placeholder.  Optional CTA
 * appears only when both `ctaLabel` and `onCta` are supplied so the
 * caller can render a passive empty state without a dangling button.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius } from '../../theme/colors';

const EmptyState = ({
  icon = 'inbox-outline',
  title = 'Nothing here yet',
  body,
  ctaLabel,
  onCta,
}) => (
  <View style={styles.wrap}>
    <View style={styles.iconCircle}>
      <MaterialCommunityIcons name={icon} size={48} color={colors.accent} />
    </View>
    <Text style={styles.title}>{title}</Text>
    {body ? <Text style={styles.body}>{body}</Text> : null}
    {ctaLabel && onCta ? (
      <TouchableOpacity
        style={styles.cta}
        onPress={onCta}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xxl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: borderRadius.pill,
  },
  ctaText: {
    color: colors.textOnDark,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default EmptyState;
