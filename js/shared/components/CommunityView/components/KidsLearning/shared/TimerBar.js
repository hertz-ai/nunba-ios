import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Animated, StyleSheet} from 'react-native';
import {kidsColors, kidsSpacing} from '../../../../../theme/kidsColors';

/**
 * TimerBar - Animated countdown timer bar with smooth 60fps animation.
 *
 * Uses width interpolation (non-native driver needed for layout props).
 * Color transitions from green (full) -> yellow (half) -> red (low).
 * Includes mountedRef guard for unmount safety.
 *
 * Props:
 * - duration: number (seconds)
 * - running: boolean
 * - onTimeUp: () => void
 * - height: number (default 6)
 */
const TimerBar = ({duration = 30, running = true, onTimeUp, height = 6}) => {
  const progress = useRef(new Animated.Value(1)).current;
  const animRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (running) {
      progress.setValue(1);
      animRef.current = Animated.timing(progress, {
        toValue: 0,
        duration: duration * 1000,
        useNativeDriver: false,
      });
      animRef.current.start(({finished}) => {
        if (finished && mountedRef.current && onTimeUp) onTimeUp();
      });
    } else {
      if (animRef.current) animRef.current.stop();
    }

    return () => {
      if (animRef.current) animRef.current.stop();
    };
  }, [running, duration, onTimeUp]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const widthInterp = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const colorInterp = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 1],
    outputRange: [kidsColors.incorrect, kidsColors.incorrect, kidsColors.star, kidsColors.correct],
  });

  return (
    <View style={[styles.container, {height}]}>
      <Animated.View
        style={[
          styles.fill,
          {width: widthInterp, backgroundColor: colorInterp, height},
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: kidsColors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: kidsSpacing.md,
  },
  fill: {
    borderRadius: 3,
  },
});

export default TimerBar;
