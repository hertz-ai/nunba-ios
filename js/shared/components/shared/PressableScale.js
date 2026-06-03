import React, { useRef, useCallback } from 'react';
import { Animated, Pressable, Platform } from 'react-native';
import { hapticLight } from '../../services/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PressableScale = ({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.96,
  haptic = true,
  disabled = false,
  hitSlop = { top: 8, bottom: 8, left: 8, right: 8 },
  rippleColor = 'rgba(255,255,255,0.10)',
  borderlessRipple = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
  ...rest
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animateIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 80,
      bounciness: 0,
    }).start();
  }, [scale, scaleTo]);

  const animateOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [scale]);

  const handlePress = useCallback(
    (e) => {
      if (disabled) return;
      if (haptic && Platform.OS !== 'web') hapticLight();
      onPress && onPress(e);
    },
    [onPress, haptic, disabled]
  );

  return (
    <AnimatedPressable
      onPressIn={animateIn}
      onPressOut={animateOut}
      onPress={handlePress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      android_ripple={{ color: rippleColor, borderless: borderlessRipple }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};

export default PressableScale;
