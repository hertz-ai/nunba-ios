/**
 * StoryRing — gradient ring around an Avatar/Image to signal an
 * unviewed story; flat gray ring once viewed.  Wraps any `children`
 * (typically an Avatar or Image element).
 *
 * Visual states:
 *   - hasStory && !viewed → rainbow gradient ring (Instagram-style)
 *   - hasStory && viewed  → flat gray ring
 *   - !hasStory           → no ring rendered, children returned as-is
 *
 * Ring thickness scales with `size`:
 *   - size <= 48  → 2 px
 *   - size <= 96  → 3 px
 *   - size  > 96  → 4 px
 *
 * Uses react-native-linear-gradient when installed; falls back to a
 * solid border so the component renders correctly even if the lib
 * isn't bundled (single dependency, dynamic require keeps tests
 * working without the native module).
 *
 * Plan ref: Part X.3.2 (sunny-gliding-eich.md).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';

let LinearGradient = null;
try {
  // Dynamic require — react-native-linear-gradient is optional.  When
  // absent (or under jest without the native module), the fallback
  // border path below renders correctly.
  // eslint-disable-next-line global-require
  LinearGradient = require('react-native-linear-gradient').default;
} catch (_e) {
  LinearGradient = null;
}

const COLORS_UNVIEWED = ['#FF6B6B', '#FFA94D', '#F4D03F', '#7DC74C', '#5DADE2', '#A569BD'];
const COLORS_VIEWED = ['#888888', '#888888'];

const StoryRing = ({
  hasStory = false,
  viewed = false,
  size = 56,
  innerBackground = '#0E1114',
  children,
}) => {
  if (!hasStory) return children || null;

  const thickness = size <= 48 ? 2 : size <= 96 ? 3 : 4;
  const innerGap = 2;
  const outerSize = size + (thickness + innerGap) * 2;
  const innerSize = size + innerGap * 2;

  const ringStyle = {
    width: outerSize,
    height: outerSize,
    borderRadius: outerSize / 2,
    padding: thickness,
  };
  const innerStyle = {
    width: innerSize,
    height: innerSize,
    borderRadius: innerSize / 2,
    padding: innerGap,
    backgroundColor: innerBackground,
  };

  const content = (
    <View style={[styles.inner, innerStyle]} testID="StoryRing.inner">
      {children}
    </View>
  );

  if (LinearGradient) {
    return (
      <LinearGradient
        colors={viewed ? COLORS_VIEWED : COLORS_UNVIEWED}
        style={[styles.ring, ringStyle]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        testID="StoryRing.gradient"
      >
        {content}
      </LinearGradient>
    );
  }

  // Fallback: solid colored border when LinearGradient is unavailable.
  return (
    <View
      testID="StoryRing.fallback"
      style={[
        styles.ring,
        ringStyle,
        { backgroundColor: viewed ? COLORS_VIEWED[0] : COLORS_UNVIEWED[0] },
      ]}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StoryRing;
