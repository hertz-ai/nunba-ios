import React from 'react';
import {
  View, Text, TouchableWithoutFeedback, Animated, StyleSheet,
} from 'react-native';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import usePressAnimation from '../../../hooks/usePressAnimation';
import { hapticLight } from '../../../services/haptics';
import SkeletonLoader from './Gamification/SkeletonLoader';
import ICON_MAP from '../../../utils/iconMap';
import { colors, borderRadius, shadows, spacing } from '../../../theme/colors';

/**
 * ContextBridge — contextual navigation card linking screens.
 *
 * @param {string} variant - 'inline' | 'banner' | 'chip'
 * @param {string} targetScreen - navigation screen name
 * @param {object} params - navigation params
 * @param {string} icon - icon name
 * @param {string} iconType - 'material' | 'community' | 'ion'
 * @param {string} color - accent color
 * @param {string} title - main text
 * @param {string} subtitle - secondary text (inline/banner only)
 * @param {boolean} loading - show skeleton
 */
const ContextBridge = ({
  variant = 'inline',
  targetScreen,
  params,
  icon,
  iconType = 'material',
  color = colors.accent,
  title,
  subtitle,
  loading = false,
}) => {
  const navigation = useNavigation();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.97);
  const IconComponent = ICON_MAP[iconType] || MaterialIcons;

  const handlePress = () => {
    hapticLight();
    if (targetScreen) navigation.navigate(targetScreen, params || {});
  };

  if (loading) {
    if (variant === 'chip') return <SkeletonLoader width={100} height={30} borderRadius={15} />;
    return <SkeletonLoader width={wp('90%')} height={variant === 'banner' ? 56 : 48} borderRadius={12} />;
  }

  if (variant === 'chip') {
    return (
      <TouchableWithoutFeedback onPressIn={onPressIn} onPressOut={onPressOut} onPress={handlePress}>
        <Animated.View style={[styles.chip, { borderColor: color + '40' }, animatedStyle]}>
          <IconComponent name={icon} size={14} color={color} />
          <Text style={[styles.chipText, { color }]}>{title}</Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  }

  if (variant === 'banner') {
    return (
      <TouchableWithoutFeedback onPressIn={onPressIn} onPressOut={onPressOut} onPress={handlePress}>
        <Animated.View style={[styles.banner, { backgroundColor: color + '18', borderColor: color + '33' }, animatedStyle]}>
          <View style={[styles.bannerIconBg, { backgroundColor: color + '22' }]}>
            <IconComponent name={icon} size={18} color={color} />
          </View>
          <View style={styles.bannerTextWrap}>
            <Text style={[styles.bannerTitle, { color }]} numberOfLines={1}>{title}</Text>
            {subtitle && <Text style={styles.bannerSubtitle} numberOfLines={1}>{subtitle}</Text>}
          </View>
          <MaterialIcons name="chevron-right" size={20} color={color} />
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  }

  // Default: inline
  return (
    <TouchableWithoutFeedback onPressIn={onPressIn} onPressOut={onPressOut} onPress={handlePress}>
      <Animated.View style={[styles.inline, animatedStyle]}>
        <View style={[styles.inlineIconBg, { backgroundColor: color + '22' }]}>
          <IconComponent name={icon} size={16} color={color} />
        </View>
        <View style={styles.inlineTextWrap}>
          <Text style={styles.inlineTitle} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.inlineSubtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  // --- Chip ---
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // --- Banner ---
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: wp('4%'),
    marginVertical: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  bannerIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // --- Inline ---
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: wp('4%'),
    marginVertical: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.sm,
  },
  inlineIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineTextWrap: {
    flex: 1,
  },
  inlineTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inlineSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
});

export default ContextBridge;
