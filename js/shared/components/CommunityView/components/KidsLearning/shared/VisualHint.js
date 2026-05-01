/**
 * VisualHint — Language-independent gesture tutorial overlay for React Native.
 *
 * Shows an animated hand icon demonstrating HOW to interact with the game.
 * Auto-dismisses after 2.5 seconds or on any tap.
 * No text — purely visual instruction for kids who can't read.
 *
 * NOTE: Requires `react-native-svg` — install via:
 *   npm install react-native-svg
 *   cd ios && pod install  (iOS only)
 *
 * Props:
 *   type:      'tap' | 'drag' | 'flip' | 'count' | 'match'
 *   visible:   boolean
 *   onDismiss: () => void
 */

import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, TouchableWithoutFeedback} from 'react-native';
import Svg, {Ellipse, Path, Rect} from 'react-native-svg';

// ── Animation builders per hint type ──────────────────────────────
// Each returns an Animated.CompositeAnimation that loops, operating
// on the provided translateX, translateY, scale, rotate, and opacity values.

function buildTapAnimation({translateY, scale, opacity}) {
  return Animated.loop(
    Animated.sequence([
      // 0% → 30%: press down
      Animated.parallel([
        Animated.timing(translateY, {toValue: 8, duration: 360, easing: Easing.out(Easing.ease), useNativeDriver: true}),
        Animated.timing(scale, {toValue: 0.9, duration: 360, easing: Easing.out(Easing.ease), useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.9, duration: 360, useNativeDriver: true}),
      ]),
      // 30% → 50%: bounce up
      Animated.parallel([
        Animated.timing(translateY, {toValue: 0, duration: 240, easing: Easing.out(Easing.ease), useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1.1, duration: 240, easing: Easing.out(Easing.ease), useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 1, duration: 240, useNativeDriver: true}),
      ]),
      // 50% → 100%: settle
      Animated.parallel([
        Animated.timing(scale, {toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 1, duration: 600, useNativeDriver: true}),
      ]),
    ]),
  );
}

function buildDragAnimation({translateX, translateY, scale, opacity}) {
  return Animated.loop(
    Animated.sequence([
      // Start left
      Animated.parallel([
        Animated.timing(translateX, {toValue: -20, duration: 1, easing: Easing.out(Easing.ease), useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.8, duration: 1, useNativeDriver: true}),
      ]),
      // Press down at left
      Animated.parallel([
        Animated.timing(translateY, {toValue: 6, duration: 600, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 0.95, duration: 600, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 1, duration: 600, useNativeDriver: true}),
      ]),
      // Drag to right
      Animated.parallel([
        Animated.timing(translateX, {toValue: 20, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true}),
      ]),
      // Release
      Animated.parallel([
        Animated.timing(translateY, {toValue: 0, duration: 400, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1, duration: 400, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.8, duration: 400, useNativeDriver: true}),
      ]),
    ]),
  );
}

function buildFlipAnimation({translateY, rotate, scale, opacity}) {
  return Animated.loop(
    Animated.sequence([
      // Press down
      Animated.parallel([
        Animated.timing(translateY, {toValue: 8, duration: 400, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 0.9, duration: 400, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.9, duration: 400, useNativeDriver: true}),
      ]),
      // Flip wrist
      Animated.parallel([
        Animated.timing(translateY, {toValue: 0, duration: 400, useNativeDriver: true}),
        Animated.timing(rotate, {toValue: 15, duration: 400, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 1, duration: 400, useNativeDriver: true}),
      ]),
      // Lift
      Animated.parallel([
        Animated.timing(translateY, {toValue: -4, duration: 400, useNativeDriver: true}),
        Animated.timing(rotate, {toValue: 0, duration: 400, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 1, duration: 400, useNativeDriver: true}),
      ]),
      // Settle
      Animated.timing(translateY, {toValue: 0, duration: 400, useNativeDriver: true}),
    ]),
  );
}

function buildCountAnimation({translateX, translateY, opacity}) {
  return Animated.loop(
    Animated.sequence([
      // Point top-left
      Animated.parallel([
        Animated.timing(translateX, {toValue: -16, duration: 1, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: -8, duration: 1, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.6, duration: 1, useNativeDriver: true}),
      ]),
      // Point center
      Animated.parallel([
        Animated.timing(translateX, {toValue: 0, duration: 600, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: 4, duration: 600, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 1, duration: 600, useNativeDriver: true}),
      ]),
      // Point right
      Animated.parallel([
        Animated.timing(translateX, {toValue: 16, duration: 600, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: -4, duration: 600, useNativeDriver: true}),
      ]),
      // Point bottom-right
      Animated.parallel([
        Animated.timing(translateX, {toValue: 8, duration: 600, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: 8, duration: 600, useNativeDriver: true}),
      ]),
      // Return
      Animated.parallel([
        Animated.timing(translateX, {toValue: -16, duration: 600, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: -8, duration: 600, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.6, duration: 600, useNativeDriver: true}),
      ]),
    ]),
  );
}

function buildMatchAnimation({translateX, scale, opacity}) {
  return Animated.loop(
    Animated.sequence([
      // Start left
      Animated.parallel([
        Animated.timing(translateX, {toValue: -24, duration: 1, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1, duration: 1, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 1, duration: 1, useNativeDriver: true}),
      ]),
      // Press left
      Animated.parallel([
        Animated.timing(scale, {toValue: 0.9, duration: 600, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.9, duration: 600, useNativeDriver: true}),
      ]),
      // Move to center
      Animated.parallel([
        Animated.timing(translateX, {toValue: 0, duration: 400, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1, duration: 400, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 1, duration: 400, useNativeDriver: true}),
      ]),
      // Move to right, press
      Animated.parallel([
        Animated.timing(translateX, {toValue: 24, duration: 400, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 0.9, duration: 400, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.9, duration: 400, useNativeDriver: true}),
      ]),
      // Confirm
      Animated.parallel([
        Animated.timing(scale, {toValue: 1.1, duration: 200, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 1, duration: 200, useNativeDriver: true}),
      ]),
      // Reset
      Animated.timing(scale, {toValue: 1, duration: 400, useNativeDriver: true}),
    ]),
  );
}

const ANIMATION_BUILDERS = {
  tap: buildTapAnimation,
  drag: buildDragAnimation,
  flip: buildFlipAnimation,
  count: buildCountAnimation,
  match: buildMatchAnimation,
};

// ── SVG Hand Pointer ──────────────────────────────────────────────
function HandPointer({size = 56}) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      {/* Hand shape */}
      <Path
        d="M32 8c-1.5 0-3 1.2-3 3v22l-5.5-5.5c-1.2-1.2-3.2-1.2-4.4 0s-1.2 3.2 0 4.4L32 44.8l12.9-12.9c1.2-1.2 1.2-3.2 0-4.4s-3.2-1.2-4.4 0L35 33V11c0-1.8-1.5-3-3-3z"
        fill="#FECA57"
        stroke="#F0932B"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Finger */}
      <Ellipse cx={32} cy={10} rx={4} ry={6} fill="#FECA57" stroke="#F0932B" strokeWidth={1.5} />
      {/* Wrist */}
      <Rect x={27} y={42} width={10} height={14} rx={5} fill="#FECA57" stroke="#F0932B" strokeWidth={1.5} />
      {/* Shine */}
      <Ellipse cx={30} cy={14} rx={1.5} ry={3} fill="rgba(255,255,255,0.4)" />
    </Svg>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function VisualHint({type = 'tap', visible = true, onDismiss}) {
  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotateVal = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const animRef = useRef(null);

  // Fade in/out
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  // Hint-specific looping animation
  useEffect(() => {
    if (!visible) return;

    // Reset all values
    translateX.setValue(0);
    translateY.setValue(0);
    scale.setValue(1);
    rotateVal.setValue(0);
    opacity.setValue(1);

    const builder = ANIMATION_BUILDERS[type] || ANIMATION_BUILDERS.tap;
    const anim = builder({translateX, translateY, scale, rotate: rotateVal, opacity});
    animRef.current = anim;
    anim.start();

    return () => {
      if (animRef.current) {
        animRef.current.stop();
      }
    };
  }, [visible, type, translateX, translateY, scale, rotateVal, opacity]);

  // Auto-dismiss after 2.5s
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 2500);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  const rotateInterpolation = rotateVal.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  return (
    <Animated.View style={[styles.overlay, {opacity: fadeAnim}]}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <Animated.View style={styles.touchArea}>
          <Animated.View
            style={{
              opacity,
              transform: [
                {translateX},
                {translateY},
                {scale},
                {rotate: rotateInterpolation},
              ],
            }}>
            <HandPointer size={56} />
          </Animated.View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 20,
  },
  touchArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
