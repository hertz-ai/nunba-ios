/**
 * GameLivesBar — Game-like progress header for React Native.
 *
 * Renders hearts (lives), star counter, level label, and streak indicator.
 * Visual-only — no text that requires reading English.
 *
 * NOTE: Requires `react-native-svg` — install via:
 *   npm install react-native-svg
 *   cd ios && pod install  (iOS only)
 *
 * Props:
 *   lives:        number (remaining, max 3)
 *   score:        number (current correct count)
 *   currentLevel: number (current question index + 1)
 *   totalLevels:  number
 *   streak:       number
 */

import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Ellipse, Path, Rect} from 'react-native-svg';
import {
  kidsColors,
  kidsBorderRadius,
  kidsSpacing,
  kidsFontWeight,
} from '../../../../../theme/kidsColors';

// ── SVG Heart icon ────────────────────────────────────────────────
function HeartIcon({filled = true, size = 22}) {
  return (
    <View style={{width: size, height: size, opacity: filled ? 1 : 0.2}}>
      <Svg viewBox="0 0 24 24" width={size} height={size}>
        <Path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill={filled ? '#FF6B6B' : '#DFE6E9'}
          stroke={filled ? '#D63031' : '#B2BEC3'}
          strokeWidth={0.8}
        />
        {filled && (
          <Ellipse
            cx={8.5}
            cy={7}
            rx={2.5}
            ry={1.8}
            fill="rgba(255,255,255,0.4)"
            transform="rotate(-20 8.5 7)"
          />
        )}
      </Svg>
    </View>
  );
}

// ── SVG Star icon ─────────────────────────────────────────────────
function StarIcon({size = 20}) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
        fill="#FDCB6E"
        stroke="#F0932B"
        strokeWidth={0.8}
      />
      <Ellipse
        cx={10}
        cy={9}
        rx={2}
        ry={1.5}
        fill="rgba(255,255,255,0.3)"
        transform="rotate(-15 10 9)"
      />
    </Svg>
  );
}

// ── SVG Fire icon ─────────────────────────────────────────────────
function FireIcon({size = 18}) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M12 23c-4.97 0-9-3.58-9-8 0-2.52 1.17-5.56 3.47-9.02a.96.96 0 011.63.11L10 9l2.6-5.2a.96.96 0 011.72 0L17 9l1.9-2.91a.96.96 0 011.63-.11C22.83 9.44 24 12.48 24 15c0 4.42-4.03 8-9 8z"
        fill="#FF4500"
        opacity={0.9}
      />
      <Path
        d="M12 23c-2.76 0-5-2.24-5-5 0-1.44.68-3.11 2-5l3 4 3-4c1.32 1.89 2 3.56 2 5 0 2.76-2.24 5-5 5z"
        fill="#FECA57"
      />
    </Svg>
  );
}

// ── Animated streak pulse wrapper ─────────────────────────────────
function PulseWrapper({children}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 750,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scaleAnim]);

  return (
    <Animated.View style={{transform: [{scale: scaleAnim}]}}>
      {children}
    </Animated.View>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function GameLivesBar({
  lives = 3,
  score = 0,
  currentLevel = 1,
  totalLevels = 10,
  streak = 0,
}) {
  const maxLives = 3;

  return (
    <View style={styles.container}>
      {/* Hearts */}
      <View style={styles.heartsRow}>
        {[...Array(maxLives)].map((_, i) => (
          <HeartIcon key={i} filled={i < lives} size={22} />
        ))}
      </View>

      {/* Level indicator */}
      <View style={styles.levelBadge}>
        <Text style={styles.levelCurrent}>{currentLevel}</Text>
        <Text style={styles.levelTotal}>/{totalLevels}</Text>
      </View>

      {/* Score + streak */}
      <View style={styles.scoreRow}>
        {/* Star score */}
        <View style={styles.starGroup}>
          <StarIcon size={20} />
          <Text style={styles.scoreText}>{score}</Text>
        </View>

        {/* Streak fire (only when streak >= 2) */}
        {streak >= 2 && (
          <PulseWrapper>
            <View style={styles.streakGroup}>
              <FireIcon size={18} />
              <Text style={styles.streakText}>{streak}</Text>
            </View>
          </PulseWrapper>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: kidsSpacing.sm,
    paddingVertical: kidsSpacing.xs,
    marginBottom: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg,
    backgroundColor: '#F7F5FF', // surfaceLight equivalent
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.35)', // cardBorder equivalent
  },
  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: kidsBorderRadius.md,
    // Solid fallback for gradientPrimary (linear-gradient not available natively)
    backgroundColor: kidsColors.accent,
    shadowColor: '#6C5CE7',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  levelCurrent: {
    color: '#fff',
    fontWeight: kidsFontWeight.extrabold,
    fontSize: 14,
    lineHeight: 16,
  },
  levelTotal: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: kidsFontWeight.semibold,
    fontSize: 11,
    lineHeight: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  scoreText: {
    fontWeight: kidsFontWeight.extrabold,
    fontSize: 16,
    color: kidsColors.star,
  },
  streakGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  streakText: {
    fontWeight: kidsFontWeight.extrabold,
    fontSize: 14,
    color: kidsColors.streakFire,
  },
});
