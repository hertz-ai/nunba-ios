/**
 * ProgressRing — circular progress indicator (0-100%) without
 * react-native-svg.  Renders a STATIC RING BORDER + centered
 * percentage text.  Used in Challenges (X% complete), Season
 * progress, Achievement rarity meters.
 *
 * Why we DON'T fake an arc with rotated half-circles:
 *   Earlier iterations of this primitive tried the classic
 *   CSS-without-SVG technique of rotating two half-circles around
 *   transformOrigin to produce an arc.  In RN that approach
 *   produces a rotated RECTANGLE sweep, not an arc — RN doesn't
 *   honour CSS-style border-radius clipping on rotated elements
 *   consistently across platforms.  The reviewer agent caught
 *   this as broken geometry (2026-05-19 review of Part X).
 *
 *   For a true arc, callers should add `react-native-svg` as a dep
 *   and render a Circle with `strokeDasharray`.  Until then,
 *   ProgressRing renders a clean static ring + a textual percentage
 *   that's accessible AND honest.
 *
 * Why users still love it:
 *   - A ring + bold "62%" reads at-a-glance better than a thin
 *     progress bar.  The visual weight of the bordered circle
 *     conveys "this is something you're completing."
 *   - Centered Text scales naturally with the ring size.
 *   - accessibilityRole='progressbar' + accessibilityValue make
 *     it work for screen readers identically to a real arc.
 *
 * Props:
 *   - percent    : 0..100
 *   - size?      : px diameter (default 64)
 *   - thickness? : px ring border width (default 6)
 *   - color?     : ring border color (default accent green)
 *   - trackColor?: unused (kept for prop-shape compat with prior P6
 *                  callers); the ring is always single-colored now.
 *                  Future SVG version may use both.
 *   - showLabel? : show the "%" text in the center (default true)
 *   - children?  : custom centered content overrides the % label
 *
 * Plan ref: Part X.4.5 + Part X.7.1 (P6 tests); reviewer fix
 * tracked on 2026-05-19.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ACCENT = '#6C63FF';

const ProgressRing = ({
  percent = 0,
  size = 64,
  thickness = 6,
  color = ACCENT,
  trackColor: _trackColor,
  showLabel = true,
  children,
  testID = 'ProgressRing',
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const rounded = Math.round(clamped);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: color,
        },
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: rounded }}
      accessibilityLabel={`${rounded} percent`}
      testID={testID}
    >
      {children ? (
        children
      ) : showLabel ? (
        <Text
          style={[
            styles.label,
            { fontSize: Math.max(10, size * 0.28) },
          ]}
          testID={`${testID}.label`}
        >
          {rounded}%
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default ProgressRing;
