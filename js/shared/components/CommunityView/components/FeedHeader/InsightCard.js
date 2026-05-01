import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableWithoutFeedback, Animated, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import usePressAnimation from '../../../../hooks/usePressAnimation';
import { hapticLight } from '../../../../services/haptics';
import useDeviceCapabilityStore from '../../../../deviceCapabilityStore';
import TVFocusableItem from '../../../shared/TVFocusableItem';
import ICON_MAP from '../../../../utils/iconMap';
import { colors, borderRadius, shadows, spacing } from '../../../../theme/colors';

const InsightCard = ({ signal, index = 0 }) => {
  const navigation = useNavigation();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.95);
  const deviceType = useDeviceCapabilityStore((s) => s.deviceType);
  const isTV = deviceType === 'tv';

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    const delay = index * 80;
    const animation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 120,
        friction: 10,
        delay,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [signal.id, index]);

  const handlePress = () => {
    hapticLight();
    if (signal.screen) {
      navigation.navigate(signal.screen, signal.data?.params || {});
    }
  };

  const IconComponent = ICON_MAP[signal.iconType] || ICON_MAP.material;
  const isUrgent = signal.type === 'challenges_ending' || signal.type === 'notifications_unread';

  const content = (
    <Animated.View
      style={[
        styles.card,
        animatedStyle,
        {
          borderLeftColor: signal.color,
          opacity: fadeAnim,
          transform: [
            ...animatedStyle.transform,
            { translateX: slideAnim },
          ],
        },
      ]}
    >
      {/* Urgent pulsing dot */}
      {isUrgent && <PulsingDot color={signal.color} />}

      <View style={styles.iconRow}>
        <View style={[styles.iconBg, { backgroundColor: signal.color + '22' }]}>
          <IconComponent name={signal.icon} size={18} color={signal.color} />
        </View>
        <Text style={styles.title} numberOfLines={1}>{signal.title}</Text>
      </View>
      <Text style={styles.subtitle} numberOfLines={2}>{signal.subtitle}</Text>
    </Animated.View>
  );

  if (isTV) {
    return (
      <TVFocusableItem
        onPress={handlePress}
        style={styles.wrapper}
        scaleFactor={1.08}
        focusBorderColor={signal.color}
      >
        {content}
      </TVFocusableItem>
    );
  }

  return (
    <TouchableWithoutFeedback
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={handlePress}
    >
      <View style={styles.wrapper}>
        {content}
      </View>
    </TouchableWithoutFeedback>
  );
};

// Pulsing dot for urgent signals
const PulsingDot = ({ color }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.pulsingDot,
        {
          backgroundColor: color,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginRight: spacing.sm,
  },
  card: {
    width: 140,
    height: 76,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'space-between',
    ...shadows.card,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },
  pulsingDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default InsightCard;
