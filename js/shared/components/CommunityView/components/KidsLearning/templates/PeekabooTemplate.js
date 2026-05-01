import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  kidsColors,
  kidsSpacing,
  kidsBorderRadius,
  kidsFontSize,
  kidsFontWeight,
  kidsShadows,
} from '../../../../../theme/kidsColors';
import useMicAmplitude from '../../../../../hooks/useMicAmplitude';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const AMP_THRESHOLD = 0.4;
const SUSTAIN_MS = 300;
const TOTAL_ROUNDS = 8;
const BLINK_INTERVAL = 500;

const HIDING_SPOT_SETS = {
  3: ['📦', '🛋️', '🪴'],
  4: ['📦', '🛋️', '🪴', '🗄️'],
  5: ['📦', '🛋️', '🪴', '🗄️', '🧺'],
};

const CHARACTER = '🐭';

const ENCOURAGEMENTS = [
  'You found me!',
  'Great ears and eyes!',
  'Too quick for me!',
  'You are amazing!',
  'Caught again!',
  'Wow, so fast!',
  'Nice catch!',
  'Super detective!',
];

/**
 * PeekabooTemplate - Tom & Jerry peek-a-boo game.
 *
 * Character hides behind objects. Child sustains voice (amplitude > 0.4 for 300ms)
 * to make the character peek out, then taps the correct hiding spot.
 * Voice stops -> character hides again.
 *
 * Props:
 * - config: { title, questions: [...], difficulty, category }
 * - onComplete: (result) => void
 * - onAnswer: (isCorrect) => void
 */

const HidingSpot = ({emoji, index, isPeeking, isCharacterHere, onTap, shakeAnim, spotSize}) => {
  const peekAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(true);
  const blinkTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, []);

  // Peek animation
  useEffect(() => {
    Animated.spring(peekAnim, {
      toValue: isPeeking && isCharacterHere ? 1 : 0,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [isPeeking, isCharacterHere]);

  // Eye blink when peeking
  useEffect(() => {
    if (isPeeking && isCharacterHere) {
      const doBlink = () => {
        if (!mountedRef.current) return;
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
        blinkTimerRef.current = setTimeout(doBlink, BLINK_INTERVAL);
      };
      blinkTimerRef.current = setTimeout(doBlink, BLINK_INTERVAL);
    } else {
      if (blinkTimerRef.current) {
        clearTimeout(blinkTimerRef.current);
        blinkTimerRef.current = null;
      }
    }

    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [isPeeking, isCharacterHere]);

  const peekTranslateX = peekAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spotSize * 0.35],
  });

  return (
    <Animated.View style={{transform: [{translateX: shakeAnim}]}}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onTap(index)}
        style={[styles.hidingSpot, {width: spotSize, height: spotSize}]}>
        {/* The hiding object */}
        <Text style={[styles.hidingEmoji, {fontSize: spotSize * 0.5}]}>
          {emoji}
        </Text>

        {/* Character peeking from behind */}
        {isCharacterHere && (
          <Animated.View
            style={[
              styles.characterPeek,
              {
                transform: [{translateX: peekTranslateX}],
                opacity: peekAnim,
              },
            ]}>
            <Animated.Text
              style={[
                styles.characterEmoji,
                {fontSize: spotSize * 0.35, opacity: blinkAnim},
              ]}>
              {CHARACTER}
            </Animated.Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const PeekabooTemplate = ({config, onComplete, onAnswer}) => {
  const difficulty = config?.difficulty || 1;
  const customSpots = config?.questions?.[0]?.hidingSpots;
  const numSpots = customSpots
    ? customSpots.length
    : difficulty <= 1
    ? 3
    : difficulty <= 2
    ? 4
    : 5;
  const peekTimeout = config?.questions?.[0]?.peekTimeout || 0;

  const hidingSpots = useMemo(() => {
    if (customSpots) return customSpots;
    return (HIDING_SPOT_SETS[numSpots] || HIDING_SPOT_SETS[3]);
  }, [numSpots, customSpots]);

  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [characterSpot, setCharacterSpot] = useState(-1);
  const [isPeeking, setIsPeeking] = useState(false);
  const [roundResult, setRoundResult] = useState(null); // 'correct' | 'wrong' | null
  const [gameStarted, setGameStarted] = useState(false);

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const sustainStartRef = useRef(0);
  const roundRef = useRef(0);
  const peekTimeoutRef = useRef(null);

  // Shake animations for each spot
  const shakeAnims = useRef(
    hidingSpots.map(() => new Animated.Value(0)),
  ).current;

  // Result animation
  const resultScale = useRef(new Animated.Value(0)).current;

  const {amplitude, isListening, startListening, stopListening} =
    useMicAmplitude(1.0);

  const totalRounds = config?.questions?.[0]?.rounds || TOTAL_ROUNDS;

  // Initialize game
  useEffect(() => {
    startTimeRef.current = Date.now();
    const timeout = setTimeout(() => {
      if (!mountedRef.current) return;
      startListening();
      setGameStarted(true);
      randomizeSpot();
    }, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      if (peekTimeoutRef.current) clearTimeout(peekTimeoutRef.current);
      stopListening();
    };
  }, []);

  const randomizeSpot = useCallback(() => {
    const spot = Math.floor(Math.random() * hidingSpots.length);
    setCharacterSpot(spot);
    setIsPeeking(false);
    setRoundResult(null);
  }, [hidingSpots.length]);

  // Voice sustain detection for peeking
  useEffect(() => {
    if (!gameStarted || roundResult) return;

    if (amplitude > AMP_THRESHOLD) {
      if (sustainStartRef.current === 0) {
        sustainStartRef.current = Date.now();
      } else if (Date.now() - sustainStartRef.current >= SUSTAIN_MS) {
        if (!isPeeking && mountedRef.current) {
          setIsPeeking(true);

          // Optional peek timeout (for speed rounds)
          if (peekTimeout > 0) {
            peekTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && !roundResult) {
                setIsPeeking(false);
                sustainStartRef.current = 0;
              }
            }, peekTimeout);
          }
        }
      }
    } else {
      sustainStartRef.current = 0;
      if (isPeeking && mountedRef.current) {
        setIsPeeking(false);
        if (peekTimeoutRef.current) {
          clearTimeout(peekTimeoutRef.current);
          peekTimeoutRef.current = null;
        }
      }
    }
  }, [amplitude, gameStarted, isPeeking, roundResult, peekTimeout]);

  const handleTap = useCallback(
    (spotIndex) => {
      if (roundResult || !isPeeking) return;

      const isCorrect = spotIndex === characterSpot;

      if (isCorrect) {
        setRoundResult('correct');
        setScore(prev => prev + 1);
        onAnswer(true);

        // Show celebration
        Animated.sequence([
          Animated.spring(resultScale, {
            toValue: 1,
            friction: 4,
            tension: 80,
            useNativeDriver: true,
          }),
          Animated.delay(1000),
          Animated.timing(resultScale, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (!mountedRef.current) return;
          advanceRound();
        });
      } else {
        setRoundResult('wrong');
        onAnswer(false);

        // Shake the tapped spot
        const shakeAnim = shakeAnims[spotIndex];
        if (shakeAnim) {
          Animated.sequence([
            Animated.timing(shakeAnim, {toValue: 8, duration: 50, useNativeDriver: true}),
            Animated.timing(shakeAnim, {toValue: -8, duration: 50, useNativeDriver: true}),
            Animated.timing(shakeAnim, {toValue: 6, duration: 50, useNativeDriver: true}),
            Animated.timing(shakeAnim, {toValue: -6, duration: 50, useNativeDriver: true}),
            Animated.timing(shakeAnim, {toValue: 0, duration: 50, useNativeDriver: true}),
          ]).start();
        }

        // Reset after a short delay — let them try again
        const timeout = setTimeout(() => {
          if (mountedRef.current) {
            setRoundResult(null);
          }
        }, 800);
        return () => clearTimeout(timeout);
      }
    },
    [isPeeking, characterSpot, roundResult],
  );

  const advanceRound = useCallback(() => {
    const nextRound = roundRef.current + 1;
    if (nextRound >= totalRounds) {
      if (!completedRef.current) {
        completedRef.current = true;
        const totalTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        onComplete({
          score: score + 1, // include current round
          total: totalRounds,
          correct: score + 1,
          wrong: totalRounds - (score + 1),
          timeSpent: totalTime,
        });
      }
    } else {
      roundRef.current = nextRound;
      setRound(nextRound);
      sustainStartRef.current = 0;
      randomizeSpot();
    }
  }, [totalRounds, score, randomizeSpot]);

  const spotSize = Math.min(
    100,
    (SCREEN_WIDTH - kidsSpacing.md * 2 - (hidingSpots.length - 1) * 10) /
      hidingSpots.length,
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🐱</Text>
        <Text style={styles.titleText}>
          {config?.title || 'Peekaboo!'}
        </Text>
        <Text style={styles.headerEmoji}>🐭</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <Text style={styles.roundText}>
          Round {round + 1} / {totalRounds}
        </Text>
        <Text style={styles.scoreText}>
          Caught: {score} {CHARACTER}
        </Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructionContainer}>
        <Text style={styles.instructionText}>
          {!isPeeking
            ? '🎤 Make noise to make the mouse peek!'
            : '👆 Quick! Tap where the mouse is hiding!'}
        </Text>
      </View>

      {/* Voice indicator */}
      <View style={styles.voiceIndicator}>
        <View
          style={[
            styles.voiceDot,
            {
              backgroundColor:
                amplitude > AMP_THRESHOLD ? '#2ECC71' : '#E0E0E0',
              transform: [{scale: 1 + amplitude * 0.5}],
            },
          ]}
        />
        <Text style={styles.voiceLabel}>
          {isListening
            ? amplitude > AMP_THRESHOLD
              ? isPeeking
                ? 'Peeking! Tap now!'
                : 'Keep going...'
              : 'Speak louder!'
            : 'Starting...'}
        </Text>
      </View>

      {/* Hiding spots grid */}
      <View style={styles.spotsContainer}>
        <View style={styles.spotsRow}>
          {hidingSpots.map((emoji, index) => (
            <HidingSpot
              key={`${round}-${index}`}
              emoji={emoji}
              index={index}
              isPeeking={isPeeking}
              isCharacterHere={characterSpot === index}
              onTap={handleTap}
              shakeAnim={shakeAnims[index]}
              spotSize={spotSize}
            />
          ))}
        </View>
      </View>

      {/* Round result overlay */}
      {roundResult === 'correct' && (
        <Animated.View
          style={[
            styles.resultOverlay,
            {transform: [{scale: resultScale}]},
          ]}>
          <Text style={styles.resultEmoji}>🎉</Text>
          <Text style={styles.resultText}>
            {ENCOURAGEMENTS[round % ENCOURAGEMENTS.length]}
          </Text>
        </Animated.View>
      )}

      {roundResult === 'wrong' && (
        <View style={styles.wrongHint}>
          <Text style={styles.wrongText}>Not there! Keep looking! 👀</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
    paddingTop: kidsSpacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.sm,
  },
  headerEmoji: {
    fontSize: 32,
  },
  titleText: {
    fontSize: kidsFontSize.xl || 24,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.sm,
  },
  roundText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textPrimary,
  },
  scoreText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.accent,
  },
  instructionContainer: {
    backgroundColor: kidsColors.hintBg,
    marginHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.md,
    borderRadius: kidsBorderRadius.md,
    marginBottom: kidsSpacing.md,
  },
  instructionText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    fontWeight: kidsFontWeight.medium,
  },
  voiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.lg,
  },
  voiceDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  voiceLabel: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
  },
  spotsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: kidsSpacing.md,
  },
  spotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  hidingSpot: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.lg || 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: kidsColors.border,
    overflow: 'hidden',
    ...kidsShadows.card,
  },
  hidingEmoji: {
    textAlign: 'center',
  },
  characterPeek: {
    position: 'absolute',
    right: -5,
    bottom: 5,
  },
  characterEmoji: {
    textAlign: 'center',
  },
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  resultEmoji: {
    fontSize: 64,
    marginBottom: kidsSpacing.md,
  },
  resultText: {
    fontSize: kidsFontSize.xl || 24,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
  },
  wrongHint: {
    position: 'absolute',
    bottom: 40,
    left: kidsSpacing.md,
    right: kidsSpacing.md,
    backgroundColor: '#FFE8E8',
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.md,
    borderRadius: kidsBorderRadius.md,
    alignItems: 'center',
  },
  wrongText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: '#E74C3C',
  },
});

export default PeekabooTemplate;
