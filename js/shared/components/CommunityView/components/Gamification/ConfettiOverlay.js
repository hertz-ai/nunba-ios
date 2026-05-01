import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#00e89d',
  '#FFD700',
  '#00D9FF',
  '#9D4EDD',
  '#FF6B35',
  '#EF4444',
  '#10B981',
];

const NUM_CONFETTI = 50;

const ConfettiPiece = ({ delay, color, startX }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 100;
    const duration = 2500 + Math.random() * 1500;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT + 50,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX + drift,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: Math.random() * 10,
          duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(duration * 0.7),
          Animated.timing(opacity, {
            toValue: 0,
            duration: duration * 0.3,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [delay, startX, translateY, translateX, rotate, opacity]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 10],
    outputRange: ['0deg', '3600deg'],
  });

  const size = 8 + Math.random() * 8;
  const isRound = Math.random() > 0.5;

  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          backgroundColor: color,
          width: size,
          height: isRound ? size : size * 2,
          borderRadius: isRound ? size / 2 : 2,
          transform: [
            { translateY },
            { translateX },
            { rotate: rotateInterpolate },
          ],
          opacity,
        },
      ]}
    />
  );
};

const ConfettiOverlay = ({
  visible = false,
  duration = 4000,
  onComplete,
}) => {
  const containerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      containerOpacity.setValue(1);

      const timeout = setTimeout(() => {
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          onComplete && onComplete();
        });
      }, duration);

      return () => clearTimeout(timeout);
    }
  }, [visible, duration, containerOpacity, onComplete]);

  if (!visible) return null;

  const confettiPieces = Array.from({ length: NUM_CONFETTI }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 500,
    startX: Math.random() * SCREEN_WIDTH,
  }));

  return (
    <Animated.View
      style={[styles.container, { opacity: containerOpacity }]}
      pointerEvents="none"
    >
      {confettiPieces.map((piece) => (
        <ConfettiPiece
          key={piece.id}
          color={piece.color}
          delay={piece.delay}
          startX={piece.startX}
        />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  confetti: {
    position: 'absolute',
    top: 0,
  },
});

export default ConfettiOverlay;
