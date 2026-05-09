/**
 * UnreadDot — Instagram-style pulsing dot.  Returns null when not
 * visible so callers can pass `visible={isUnread}` without conditional
 * wrappers.  The pulsing halo is opacity+scale only (cheap on Android).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { colors, TIMINGS } from '../../theme/colors';

const UnreadDot = ({ visible = true, size = 8, color }) => {
  if (!visible) return null;
  const c = color || colors.accent;
  return (
    <View style={{ width: size, height: size }}>
      <Animatable.View
        animation={{
          0: { scale: 1, opacity: 0.85 },
          1: { scale: 1.6, opacity: 0 },
        }}
        iterationCount="infinite"
        duration={TIMINGS.pulseMs}
        easing="ease-out"
        useNativeDriver
        style={[
          styles.halo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c,
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  halo: { position: 'absolute' },
  dot:  { position: 'absolute' },
});

export default UnreadDot;
