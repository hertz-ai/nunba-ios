import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import useMicAmplitude from '../../../../../hooks/useMicAmplitude';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const GAME_HEIGHT = SCREEN_HEIGHT * 0.5;
const GROUND_Y = GAME_HEIGHT - 60;
const CHARACTER_SIZE = 50;
const OBSTACLE_WIDTH = 40;

const COLORS = {
  bg: '#E8F5E9',
  sky: '#87CEEB',
  ground: '#8BC34A',
  groundDark: '#689F38',
  character: '#FF6F00',
  characterEye: '#FFFFFF',
  obstacleHigh: '#F44336',
  obstacleLow: '#FF9800',
  textPrimary: '#333333',
  textMuted: '#888888',
  accent: '#4CAF50',
  purple: '#7C4DFF',
  pink: '#FF80AB',
  whisper: '#81D4FA',
  shout: '#FF8A65',
  scoreGold: '#FFD600',
};

function generateObstacles(count, difficulty) {
  const obstacles = [];
  const minSpacing = Math.max(180, 280 - difficulty * 30);
  let x = SCREEN_WIDTH + 100;

  for (let i = 0; i < count; i++) {
    const isHigh = Math.random() > 0.5;
    obstacles.push({
      id: i,
      x,
      type: isHigh ? 'high' : 'low', // high = jump, low = crouch
      cleared: false,
    });
    x += minSpacing + Math.random() * 100;
  }
  return obstacles;
}

const WhisperShoutTemplate = ({config, onComplete, onAnswer}) => {
  const difficulty = config?.difficulty || 1;
  const obstacleCount = config?.content?.obstacleCount || 10;
  const speed = Math.max(1.5, 2 + difficulty * 0.5);

  const {amplitude, isListening, startListening, stopListening} =
    useMicAmplitude(1.0);

  const [obstacles, setObstacles] = useState(() =>
    generateObstacles(obstacleCount, difficulty),
  );
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const frameRef = useRef(null);
  const obstaclesRef = useRef(obstacles);
  const scoreRef = useRef(0);
  const amplitudeRef = useRef(0);
  const gameOverRef = useRef(false);

  // Animated values
  const characterY = useRef(new Animated.Value(0)).current;
  const characterScale = useRef(new Animated.Value(1)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const bgBounce = useRef(new Animated.Value(0)).current;

  amplitudeRef.current = amplitude;
  obstaclesRef.current = obstacles;

  useEffect(() => {
    startListening();
    return () => {
      mountedRef.current = false;
      stopListening();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Start game after mic is ready
  useEffect(() => {
    if (isListening && !gameStarted) {
      setGameStarted(true);
      startTimeRef.current = Date.now();
    }
  }, [isListening, gameStarted]);

  // Character position based on amplitude
  useEffect(() => {
    if (gameOver) return;

    let targetY = 0; // normal walk
    let targetScale = 1;

    if (amplitude > 0.6) {
      // SHOUT = jump
      targetY = -80;
      targetScale = 1.2;
    } else if (amplitude < 0.2) {
      // WHISPER = crouch
      targetY = 20;
      targetScale = 0.6;
    }

    Animated.parallel([
      Animated.spring(characterY, {
        toValue: targetY,
        friction: 8,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(characterScale, {
        toValue: targetScale,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [amplitude, gameOver]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    let lastTime = Date.now();

    const gameLoop = () => {
      if (!mountedRef.current || gameOverRef.current) return;

      const now = Date.now();
      const delta = (now - lastTime) / 16; // normalize to ~60fps
      lastTime = now;

      // Move obstacles
      setObstacles(prev => {
        const updated = prev.map(obs => ({
          ...obs,
          x: obs.x - speed * delta,
        }));

        // Check collisions and scoring
        const charX = 80;
        const charTopY = GROUND_Y + amplitudeRef.current > 0.6 ? -80 : amplitudeRef.current < 0.2 ? 20 : 0;
        const isCrouching = amplitudeRef.current < 0.2;
        const isJumping = amplitudeRef.current > 0.6;

        updated.forEach(obs => {
          if (obs.cleared) return;

          // Obstacle is at character position
          if (obs.x < charX + CHARACTER_SIZE && obs.x + OBSTACLE_WIDTH > charX) {
            if (obs.type === 'high' && !isJumping) {
              // Hit a high wall without jumping
              gameOverRef.current = true;
              if (mountedRef.current) setGameOver(true);
              return;
            }
            if (obs.type === 'low' && !isCrouching) {
              // Hit a low beam without crouching
              gameOverRef.current = true;
              if (mountedRef.current) setGameOver(true);
              return;
            }
          }

          // Passed obstacle
          if (obs.x + OBSTACLE_WIDTH < charX && !obs.cleared) {
            obs.cleared = true;
            scoreRef.current += 1;
            if (mountedRef.current) {
              setScore(scoreRef.current);
              onAnswer(true);
            }
          }
        });

        // Check if all obstacles passed
        const allDone = updated.every(o => o.cleared || o.x < -OBSTACLE_WIDTH);
        if (allDone && !gameOverRef.current && !completedRef.current) {
          gameOverRef.current = true;
          if (mountedRef.current) setGameOver(true);
        }

        return updated;
      });

      frameRef.current = requestAnimationFrame(gameLoop);
    };

    frameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [gameStarted, gameOver, speed]);

  // Handle game over
  useEffect(() => {
    if (gameOver && !completedRef.current) {
      completedRef.current = true;
      const timeout = setTimeout(() => {
        if (!mountedRef.current) return;
        onComplete({
          score: scoreRef.current,
          total: obstacleCount,
          correct: scoreRef.current,
          wrong: obstacleCount - scoreRef.current,
          timeSpent: Math.round((Date.now() - startTimeRef.current) / 1000),
        });
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [gameOver]);

  // Voice state label
  const getVoiceState = () => {
    if (amplitude > 0.6) return {text: 'JUMP!', color: COLORS.shout, emoji: '\uD83D\uDE80'};
    if (amplitude < 0.2) return {text: 'Crouch...', color: COLORS.whisper, emoji: '\uD83E\uDDD8'};
    return {text: 'Walking', color: COLORS.accent, emoji: '\uD83D\uDEB6'};
  };
  const voiceState = getVoiceState();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Whisper & Shout</Text>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{score}/{obstacleCount}</Text>
        </View>
      </View>

      {/* Voice indicator */}
      <View style={[styles.voiceIndicator, {backgroundColor: voiceState.color + '30'}]}>
        <Text style={styles.voiceEmoji}>{voiceState.emoji}</Text>
        <Text style={[styles.voiceText, {color: voiceState.color}]}>
          {voiceState.text}
        </Text>
      </View>

      {/* Game area */}
      <View style={styles.gameArea}>
        {/* Sky */}
        <View style={styles.sky}>
          <Text style={styles.cloud}>{'\u2601\uFE0F'}</Text>
        </View>

        {/* Character */}
        <Animated.View
          style={[
            styles.character,
            {
              transform: [
                {translateY: characterY},
                {scale: characterScale},
              ],
              left: 60,
              bottom: 60,
            },
          ]}>
          <View style={styles.characterBody}>
            <View style={styles.characterEye} />
            <View style={[styles.characterEye, {right: 8}]} />
          </View>
          {amplitude > 0.6 && (
            <Text style={styles.jumpEffect}>{'\u2728'}</Text>
          )}
        </Animated.View>

        {/* Obstacles */}
        {obstacles.map(obs => {
          if (obs.x < -60 || obs.x > SCREEN_WIDTH + 60) return null;
          const isHigh = obs.type === 'high';
          return (
            <View
              key={obs.id}
              style={[
                styles.obstacle,
                {
                  left: obs.x,
                  bottom: isHigh ? 60 : 90,
                  height: isHigh ? 70 : 30,
                  width: OBSTACLE_WIDTH,
                  backgroundColor: isHigh
                    ? COLORS.obstacleHigh
                    : COLORS.obstacleLow,
                  borderRadius: isHigh ? 8 : 4,
                },
              ]}>
              <Text style={styles.obstacleLabel}>
                {isHigh ? '\u26A0\uFE0F' : '\u2796'}
              </Text>
            </View>
          );
        })}

        {/* Ground */}
        <View style={styles.ground}>
          <View style={styles.groundGrass} />
        </View>
      </View>

      {/* Game over overlay */}
      {gameOver && (
        <View style={styles.gameOverOverlay}>
          <Text style={styles.gameOverEmoji}>
            {scoreRef.current >= obstacleCount ? '\uD83C\uDF89' : '\uD83D\uDCA5'}
          </Text>
          <Text style={styles.gameOverText}>
            {scoreRef.current >= obstacleCount ? 'You Win!' : 'Game Over!'}
          </Text>
          <Text style={styles.gameOverScore}>
            Cleared: {scoreRef.current}/{obstacleCount}
          </Text>
        </View>
      )}

      {/* Instructions */}
      {!gameStarted && (
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>How to Play</Text>
          <View style={styles.instructionRow}>
            <Text style={styles.instructionEmoji}>{'\uD83E\uDD2B'}</Text>
            <Text style={styles.instructionText}>Whisper to crouch under low beams</Text>
          </View>
          <View style={styles.instructionRow}>
            <Text style={styles.instructionEmoji}>{'\uD83D\uDCE2'}</Text>
            <Text style={styles.instructionText}>Shout to jump over high walls</Text>
          </View>
        </View>
      )}

      {/* Amplitude meter */}
      <View style={styles.amplitudeMeter}>
        <Text style={styles.meterLabel}>Whisper</Text>
        <View style={styles.meterBar}>
          <View
            style={[
              styles.meterFill,
              {
                width: `${Math.min(amplitude * 100, 100)}%`,
                backgroundColor:
                  amplitude > 0.6
                    ? COLORS.shout
                    : amplitude < 0.2
                    ? COLORS.whisper
                    : COLORS.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.meterLabel}>Shout</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.accent,
  },
  scoreBadge: {
    backgroundColor: COLORS.scoreGold,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  voiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  voiceEmoji: {
    fontSize: 24,
  },
  voiceText: {
    fontSize: 18,
    fontWeight: '700',
  },
  gameArea: {
    height: GAME_HEIGHT,
    backgroundColor: COLORS.sky,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 8,
    borderRadius: 16,
  },
  sky: {
    position: 'absolute',
    top: 20,
    right: 40,
  },
  cloud: {
    fontSize: 40,
  },
  character: {
    position: 'absolute',
    zIndex: 10,
  },
  characterBody: {
    width: CHARACTER_SIZE,
    height: CHARACTER_SIZE,
    borderRadius: CHARACTER_SIZE / 2,
    backgroundColor: COLORS.character,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  characterEye: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.characterEye,
  },
  jumpEffect: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    fontSize: 20,
  },
  obstacle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  obstacleLabel: {
    fontSize: 16,
  },
  ground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: COLORS.ground,
  },
  groundGrass: {
    height: 8,
    backgroundColor: COLORS.groundDark,
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  gameOverEmoji: {
    fontSize: 60,
    marginBottom: 12,
  },
  gameOverText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  gameOverScore: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  instructions: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 2,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  instructionEmoji: {
    fontSize: 28,
  },
  instructionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  amplitudeMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  meterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  meterBar: {
    flex: 1,
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 8,
  },
});

export default WhisperShoutTemplate;
