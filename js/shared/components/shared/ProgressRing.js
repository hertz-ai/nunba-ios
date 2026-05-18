/**
 * ProgressRing — circular progress indicator (0-100%) without
 * react-native-svg dependency.  Built from two overlaid semicircle
 * Views with rotation transforms (classic Material progress-circle
 * trick).  Used in Challenges (X% complete), Season progress,
 * Achievement rarity meters.
 *
 * Why users would love this (Part X.4.5 Gamification surface):
 *   - A ring that visually FILLS is more legible at a glance than
 *     a "62%" text label.  Activity rings (Apple Watch) proved
 *     this pattern dominates linear progress bars for short
 *     evaluations.
 *   - Color-coded by completion: gray-blue for in-progress, accent
 *     green when complete.
 *
 * Multi-hat self-critique:
 *   - Designer: two semicircles + rotation > SVG path math.  No
 *     extra native module to install/bundle.  Limitation: at very
 *     small sizes (< 32px) the visual fidelity drops; primitives
 *     using it should size ≥ 40px.
 *   - A11y: accessibilityLabel reports the percent; role=progressbar
 *     so screen readers announce as a progress indicator.
 *   - Engineer: pure View + transform; useNativeDriver-friendly if
 *     the caller animates the percent prop via an Animated.Value
 *     (future enhancement).
 *
 * Props:
 *   - percent    : 0..100
 *   - size?      : px diameter (default 64)
 *   - thickness? : px ring width (default 6)
 *   - color?     : ring fill (default accent)
 *   - trackColor?: ring background (default dark gray)
 *   - children?  : optional centered content (number / label)
 *
 * Plan ref: Part X.4.5 + Part X.7.1 (P6 tests).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';

const ACCENT = '#00e89d';
const TRACK = '#2A2A3E';

const ProgressRing = ({
  percent = 0,
  size = 64,
  thickness = 6,
  color = ACCENT,
  trackColor = TRACK,
  children,
  testID = 'ProgressRing',
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const inner = size - thickness * 2;
  const radius = size / 2;

  // Two semicircles overlaid + rotated based on progress.
  // 0-50%: left semicircle fully fills, right semicircle rotates 0→180°.
  // 50-100%: right semicircle fully filled (rotated 180°), left
  //   semicircle rotates 0→180° to reveal increasing color.
  const rotation = (clamped / 50) * 180;
  const firstHalf = clamped <= 50;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      accessibilityLabel={`${Math.round(clamped)} percent`}
      testID={testID}
    >
      {/* Track ring (background) */}
      <View
        style={[
          styles.track,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: thickness,
            borderColor: trackColor,
          },
        ]}
      />

      {/* Fill ring — built from rotated half-circle slices */}
      {firstHalf ? (
        <View
          style={[
            styles.halfLeft,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <View
            style={[
              styles.fillHalf,
              {
                width: size / 2,
                height: size,
                borderTopLeftRadius: radius,
                borderBottomLeftRadius: radius,
                borderTopWidth: thickness,
                borderLeftWidth: thickness,
                borderBottomWidth: thickness,
                borderColor: color,
                transform: [{ rotate: `${rotation}deg` }],
                transformOrigin: '100% 50%',
              },
            ]}
          />
        </View>
      ) : (
        <>
          <View
            style={[
              styles.halfLeft,
              { width: size / 2, height: size },
            ]}
          >
            <View
              style={[
                styles.fillHalf,
                {
                  width: size / 2,
                  height: size,
                  borderTopLeftRadius: radius,
                  borderBottomLeftRadius: radius,
                  borderTopWidth: thickness,
                  borderLeftWidth: thickness,
                  borderBottomWidth: thickness,
                  borderColor: color,
                },
              ]}
            />
          </View>
          <View
            style={[
              styles.halfRight,
              { left: size / 2, width: size / 2, height: size },
            ]}
          >
            <View
              style={[
                styles.fillHalf,
                {
                  width: size / 2,
                  height: size,
                  borderTopRightRadius: radius,
                  borderBottomRightRadius: radius,
                  borderTopWidth: thickness,
                  borderRightWidth: thickness,
                  borderBottomWidth: thickness,
                  borderColor: color,
                  transform: [{ rotate: `${rotation - 180}deg` }],
                  transformOrigin: '0% 50%',
                },
              ]}
            />
          </View>
        </>
      )}

      {/* Center content */}
      {children ? (
        <View style={[styles.center, { width: inner, height: inner }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
  },
  halfLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  halfRight: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  fillHalf: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProgressRing;
