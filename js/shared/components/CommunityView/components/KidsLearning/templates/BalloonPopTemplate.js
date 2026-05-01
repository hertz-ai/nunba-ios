import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
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

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const BALLOON_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#2ECC71', '#9B59B6'];
const AMP_THRESHOLD = 0.3;
const ENCOURAGEMENTS = [
  'Great job! Keep going!',
  'You did it! Next word!',
  'Amazing voice! So loud!',
  'Fantastic! You popped them all!',
  'Wonderful! Try the next one!',
];

/**
 * BalloonPopTemplate - "Repeat After Me" balloon pop game.
 *
 * Each letter of a word is displayed inside a colorful floating balloon.
 * The child speaks into the mic; sustained amplitude pops balloons left-to-right.
 * Louder voice = faster pop chain.
 *
 * Props:
 * - config: { title, questions: [{ word, hint }], difficulty, category }
 * - onComplete: (result) => void
 * - onAnswer: (isCorrect) => void
 */

// Individual balloon component
const Balloon = ({letter, color, index, isPopped, totalBalloons}) => {
  const bobAnim = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const popOpacity = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    // Gentle bobbing animation
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: -12,
          duration: 1200 + index * 200,
          useNativeDriver: true,
        }),
        Animated.timing(bobAnim, {
          toValue: 12,
          duration: 1200 + index * 200,
          useNativeDriver: true,
        }),
      ]),
    );
    bobLoop.start();

    return () => {
      mountedRef.current = false;
      bobLoop.stop();
    };
  }, []);

  useEffect(() => {
    if (isPopped) {
      Animated.parallel([
        Animated.spring(popScale, {
          toValue: 1.5,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(popOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isPopped]);

  const balloonWidth = Math.min(60, (SCREEN_WIDTH - 40) / totalBalloons);

  return (
    <Animated.View
      style={[
        styles.balloon,
        {
          width: balloonWidth,
          height: balloonWidth * 1.3,
          backgroundColor: color,
          transform: [
            {translateY: bobAnim},
            {scale: popScale},
          ],
          opacity: popOpacity,
        },
      ]}>
      <Text style={[styles.balloonLetter, {fontSize: balloonWidth * 0.4}]}>
        {letter}
      </Text>
      {/* Balloon knot */}
      <View style={[styles.balloonKnot, {backgroundColor: color}]} />
      <View style={[styles.balloonString, {height: balloonWidth * 0.5}]} />
    </Animated.View>
  );
};

const BalloonPopTemplate = ({config, onComplete, onAnswer}) => {
  const questions = config?.questions || [];
  const questionIndexRef = useRef(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [poppedCount, setPoppedCount] = useState(0);
  const [score, setScore] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [speechStreak, setSpeechStreak] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const wordStartTimeRef = useRef(Date.now());
  const popTimerRef = useRef(null);
  const lastPopTimeRef = useRef(0);
  const streakRef = useRef(0);

  const {amplitude, isListening, startListening, stopListening} =
    useMicAmplitude(1.0);

  const currentQuestion = questions[questionIndex] || {word: 'HELLO', hint: 'A greeting'};
  const letters = currentQuestion.word.toUpperCase().split('');

  // Celebration scale animation
  const celebrationScale = useRef(new Animated.Value(0)).current;

  // Voice level bar animation
  const voiceLevelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(voiceLevelAnim, {
      toValue: amplitude,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [amplitude]);

  // Start mic on mount
  useEffect(() => {
    startTimeRef.current = Date.now();
    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        startListening();
        setGameStarted(true);
      }
    }, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
      stopListening();
    };
  }, []);

  // Pop chain logic based on amplitude
  useEffect(() => {
    if (!gameStarted || showCelebration) return;

    if (amplitude > AMP_THRESHOLD && poppedCount < letters.length) {
      // Calculate pop interval: lerp from 800ms at 0.3 to 200ms at 1.0
      const normalizedAmp = Math.min((amplitude - AMP_THRESHOLD) / (1.0 - AMP_THRESHOLD), 1.0);
      const popInterval = 800 - normalizedAmp * 600; // 800ms -> 200ms

      streakRef.current += 1;
      if (mountedRef.current) {
        setSpeechStreak(streakRef.current);
      }

      const now = Date.now();
      if (now - lastPopTimeRef.current >= popInterval) {
        lastPopTimeRef.current = now;
        setPoppedCount(prev => {
          const next = prev + 1;
          return Math.min(next, letters.length);
        });
      }
    } else if (amplitude <= AMP_THRESHOLD) {
      // Voice dropped, pause chain
      streakRef.current = 0;
    }
  }, [amplitude, gameStarted, showCelebration, poppedCount, letters.length]);

  // Check if all balloons popped
  useEffect(() => {
    if (poppedCount >= letters.length && letters.length > 0 && !showCelebration) {
      if (!mountedRef.current) return;

      const wordTime = Date.now() - wordStartTimeRef.current;
      const timeBonus = Math.max(0, 10 - Math.floor(wordTime / 1000));
      const streakBonus = Math.min(5, Math.floor(streakRef.current / 10));
      const wordScore = 10 + timeBonus + streakBonus;

      setScore(prev => prev + wordScore);
      setTotalCorrect(prev => prev + 1);
      setShowCelebration(true);
      onAnswer(true);

      // Celebration animation
      Animated.sequence([
        Animated.spring(celebrationScale, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(celebrationScale, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!mountedRef.current) return;

        const nextIndex = questionIndexRef.current + 1;
        if (nextIndex >= questions.length) {
          // Game over
          if (!completedRef.current) {
            completedRef.current = true;
            const totalTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
            onComplete({
              score: score + wordScore,
              total: questions.length,
              correct: totalCorrect + 1,
              wrong: questions.length - (totalCorrect + 1),
              timeSpent: totalTime,
            });
          }
        } else {
          // Next word
          questionIndexRef.current = nextIndex;
          setQuestionIndex(nextIndex);
          setPoppedCount(0);
          setShowCelebration(false);
          wordStartTimeRef.current = Date.now();
          lastPopTimeRef.current = 0;
          streakRef.current = 0;
        }
      });
    }
  }, [poppedCount, letters.length]);

  // Memoize balloon colors
  const balloonColors = useMemo(
    () => letters.map((_, i) => BALLOON_COLORS[i % BALLOON_COLORS.length]),
    [currentQuestion.word],
  );

  const voiceBarHeight = voiceLevelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (questions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🎈</Text>
        <Text style={styles.emptyText}>No words to practice!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header: progress */}
      <View style={styles.header}>
        <Text style={styles.progressText}>
          {questionIndex + 1} / {questions.length}
        </Text>
        <Text style={styles.scoreText}>Score: {score}</Text>
      </View>

      {/* Hint */}
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>{currentQuestion.hint}</Text>
      </View>

      {/* Word display */}
      <View style={styles.wordContainer}>
        <Text style={styles.wordLabel}>Say it loud:</Text>
        <Text style={styles.wordText}>{currentQuestion.word.toUpperCase()}</Text>
      </View>

      {/* Balloons area */}
      <View style={styles.balloonsArea}>
        <View style={styles.balloonsRow}>
          {letters.map((letter, index) => (
            <Balloon
              key={`${questionIndex}-${index}`}
              letter={letter}
              color={balloonColors[index]}
              index={index}
              isPopped={index < poppedCount}
              totalBalloons={letters.length}
            />
          ))}
        </View>
      </View>

      {/* Voice level indicator */}
      <View style={styles.voiceMeterContainer}>
        <View style={styles.voiceMeterTrack}>
          <Animated.View
            style={[
              styles.voiceMeterFill,
              {height: voiceBarHeight},
            ]}
          />
        </View>
        <Text style={styles.voiceMeterLabel}>
          {amplitude > AMP_THRESHOLD ? '🗣️' : '🤫'}
        </Text>
        <Text style={styles.micStatus}>
          {isListening
            ? amplitude > AMP_THRESHOLD
              ? 'Popping!'
              : 'Speak up!'
            : 'Starting mic...'}
        </Text>
      </View>

      {/* Speech streak indicator */}
      {speechStreak > 5 && (
        <View style={styles.streakBadge}>
          <Text style={styles.streakText}>
            🔥 Streak: {speechStreak}
          </Text>
        </View>
      )}

      {/* Celebration overlay */}
      {showCelebration && (
        <Animated.View
          style={[
            styles.celebrationOverlay,
            {transform: [{scale: celebrationScale}]},
          ]}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={styles.celebrationText}>
            {ENCOURAGEMENTS[questionIndex % ENCOURAGEMENTS.length]}
          </Text>
        </Animated.View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: kidsSpacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.sm,
  },
  progressText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
  scoreText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.accent,
  },
  hintContainer: {
    backgroundColor: kidsColors.hintBg,
    marginHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.md,
    borderRadius: kidsBorderRadius.md,
    marginBottom: kidsSpacing.sm,
  },
  hintText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textPrimary,
    textAlign: 'center',
  },
  wordContainer: {
    alignItems: 'center',
    marginBottom: kidsSpacing.md,
  },
  wordLabel: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
    marginBottom: kidsSpacing.xs,
  },
  wordText: {
    fontSize: kidsFontSize.xxl || 32,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    letterSpacing: 4,
  },
  balloonsArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: kidsSpacing.md,
  },
  balloonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
  },
  balloon: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    ...kidsShadows.card,
  },
  balloonLetter: {
    fontWeight: kidsFontWeight.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  balloonKnot: {
    position: 'absolute',
    bottom: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.8,
  },
  balloonString: {
    position: 'absolute',
    bottom: -30,
    width: 1.5,
    backgroundColor: '#999',
  },
  voiceMeterContainer: {
    alignItems: 'center',
    paddingBottom: kidsSpacing.lg,
  },
  voiceMeterTrack: {
    width: 30,
    height: 80,
    backgroundColor: '#E0E0E0',
    borderRadius: kidsBorderRadius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: kidsSpacing.xs,
  },
  voiceMeterFill: {
    width: '100%',
    backgroundColor: '#2ECC71',
    borderRadius: kidsBorderRadius.md,
  },
  voiceMeterLabel: {
    fontSize: 24,
  },
  micStatus: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
    marginTop: 2,
  },
  streakBadge: {
    position: 'absolute',
    top: 60,
    right: kidsSpacing.md,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: kidsSpacing.sm,
    paddingVertical: kidsSpacing.xs,
    borderRadius: kidsBorderRadius.round || 20,
  },
  streakText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: '#FFFFFF',
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: kidsSpacing.md,
  },
  celebrationText: {
    fontSize: kidsFontSize.xl || 24,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: kidsSpacing.lg,
  },
});

export default BalloonPopTemplate;
