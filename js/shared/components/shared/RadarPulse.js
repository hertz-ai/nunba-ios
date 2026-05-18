/**
 * RadarPulse — concentric expanding rings that signal "we're
 * scanning" without spinning a dull ActivityIndicator.  Three
 * staggered rings each loop scale 0 → 1.0 with opacity 0.6 → 0
 * over 1800ms.
 *
 * Why users would love this (Part X.4.2 Encounters surface):
 *   - BLE proximity scanning is otherwise invisible — the user
 *     can't tell if the app is searching.  A radar pulse is a
 *     universally-understood "scanning" affordance (Find My,
 *     AirPods, Tinder discovery).
 *   - The staggered rings convey RHYTHM — the app is alive,
 *     working in the background.
 *
 * Multi-hat self-critique:
 *   - Designer: 3 rings, staggered 600ms apart, so there's always
 *     a ring mid-expansion.  Color = accent green to match the
 *     'Encounter' surface theme.
 *   - PM: the visual reduces perceived wait time vs a blank
 *     "scanning…" label.  Important for the 5-10 second window
 *     between user enabling discoverable and first match arriving.
 *   - A11y: animation is decorative; accessibilityLabel='' so
 *     screen readers don't repeatedly announce the pulse.  A
 *     SEPARATE Text node (caller's responsibility) carries the
 *     'Scanning for nearby people…' string.
 *   - Engineer: Animated.loop with useNativeDriver=true on
 *     transforms.  Stops cleanly when active=false (callers
 *     toggle on enable, off on disable).
 *
 * Props:
 *   - active    : boolean — when false, no pulse renders (no chrome
 *                 wasted on stationary states).
 *   - size?     : px diameter of the largest ring (default 200)
 *   - color?    : ring color (default accent green)
 *   - children? : optional centered content (icon, status text)
 *
 * Plan ref: Part X.4.2 + Part X.7.1 (P8 tests).
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

const ACCENT = '#00e89d';
const RING_DURATION = 1800;
const RING_COUNT = 3;
const RING_STAGGER = RING_DURATION / RING_COUNT;

const RadarPulse = ({
  active = true,
  size = 200,
  color = ACCENT,
  children,
  testID = 'RadarPulse',
}) => {
  const animations = useRef(
    Array.from({ length: RING_COUNT }, () => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    if (!active) return undefined;
    const loops = animations.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * RING_STAGGER),
          Animated.parallel([
            Animated.timing(a.scale, {
              toValue: 1,
              duration: RING_DURATION,
              useNativeDriver: true,
              easing: Easing.out(Easing.ease),
            }),
            Animated.timing(a.opacity, {
              toValue: 0,
              duration: RING_DURATION,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(a.scale, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(a.opacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [active, animations]);

  if (!active) return null;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      testID={testID}
      pointerEvents="none"
      accessibilityLabel=""
    >
      {animations.map((a, i) => (
        <Animated.View
          key={i}
          testID={`${testID}.ring.${i}`}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: color,
              transform: [{ scale: a.scale }],
              opacity: a.opacity,
            },
          ]}
        />
      ))}
      {children ? (
        <View style={styles.center} testID={`${testID}.center`}>
          {children}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RadarPulse;
