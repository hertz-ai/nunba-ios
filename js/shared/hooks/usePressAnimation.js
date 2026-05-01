import { useRef, useCallback, useMemo } from 'react';
import { Animated } from 'react-native';

const usePressAnimation = (pressedScale = 0.95) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scaleValue, {
      toValue: pressedScale,
      tension: 150,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scaleValue, pressedScale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scaleValue, {
      toValue: 1,
      tension: 150,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scaleValue]);

  const animatedStyle = useMemo(() => ({ transform: [{ scale: scaleValue }] }), [scaleValue]);

  return { scaleValue, onPressIn, onPressOut, animatedStyle };
};

export default usePressAnimation;
