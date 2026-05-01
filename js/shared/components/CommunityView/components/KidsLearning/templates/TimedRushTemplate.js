import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  kidsColors,
  kidsSpacing,
  kidsBorderRadius,
  kidsFontSize,
  kidsFontWeight,
  kidsShadows,
} from '../../../../../theme/kidsColors';
import {SPRINGS} from '../shared/gameThemes';
import OptionButton from '../shared/OptionButton';
import ProgressDots from '../shared/ProgressDots';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import TimerBar from '../shared/TimerBar';

/**
 * TimedRushTemplate - Speed challenge game template.
 *
 * Answer as many questions as possible within a time limit.
 * Supports procedural arithmetic generation or pre-defined questions.
 * Adapts difficulty based on child's performance streak.
 *
 * Props:
 * - config: { content: { timeLimit, questionGenerator, difficulty, questions } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 */

const OPS_MAP = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
};

const OPS_LABELS = {
  '+': '+',
  '-': '-',
  '*': 'x',
};

function generateArithmeticQuestion(difficulty, adaptedDifficulty) {
  const {minA, maxA, minB, maxB, ops} = difficulty;
  const scale = adaptedDifficulty; // 0.5 = easier, 1 = normal, 1.5 = harder

  const scaledMaxA = Math.max(minA + 1, Math.round(maxA * scale));
  const scaledMaxB = Math.max(minB + 1, Math.round(maxB * scale));

  const op = ops[Math.floor(Math.random() * ops.length)];
  let a = Math.floor(Math.random() * (scaledMaxA - minA + 1)) + minA;
  let b = Math.floor(Math.random() * (scaledMaxB - minB + 1)) + minB;

  // For subtraction, ensure non-negative result
  if (op === '-' && a < b) {
    [a, b] = [b, a];
  }

  const correctAnswer = OPS_MAP[op](a, b);
  const opLabel = OPS_LABELS[op] || op;
  const questionText = `${a} ${opLabel} ${b} = ?`;
  const concept = `math:${a}${op}${b}`;

  // Generate distractors
  const distractors = new Set();
  distractors.add(correctAnswer);
  while (distractors.size < 4) {
    const offset = Math.floor(Math.random() * 5) + 1;
    const sign = Math.random() > 0.5 ? 1 : -1;
    const distractor = correctAnswer + offset * sign;
    if (distractor >= 0) {
      distractors.add(distractor);
    }
  }

  const options = Array.from(distractors).sort(() => Math.random() - 0.5);
  const correctIndex = options.indexOf(correctAnswer);

  return {
    question: questionText,
    options: options.map(String),
    correctIndex,
    concept,
  };
}

const TimedRushTemplate = ({config, onAnswer, onComplete}) => {
  const content = config?.content || {};
  const timeLimit = content.timeLimit || 60;
  const isArithmetic = content.questionGenerator === 'arithmetic';
  const staticQuestions = content.questions || [];
  const difficulty = content.difficulty || {
    minA: 1,
    maxA: 10,
    minB: 1,
    maxB: 10,
    ops: ['+'],
  };

  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [optionStates, setOptionStates] = useState([
    'default',
    'default',
    'default',
    'default',
  ]);
  const [showHint, setShowHint] = useState(false);
  const [streak, setStreak] = useState(0); // positive = correct streak, negative = wrong streak

  // Adaptive difficulty
  const [adaptedDifficulty, setAdaptedDifficulty] = useState(1.0);
  const consecutiveWrong = useRef(0);
  const consecutiveCorrect = useRef(0);
  const questionStartTime = useRef(Date.now());
  const staticIndex = useRef(0);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Animations
  const questionAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(1)).current;
  const countdownAnim = useRef(new Animated.Value(0)).current;

  // Generate next question
  const getNextQuestion = useCallback(() => {
    if (isArithmetic) {
      return generateArithmeticQuestion(difficulty, adaptedDifficulty);
    }
    if (staticQuestions.length === 0) return null;
    const idx = staticIndex.current % staticQuestions.length;
    staticIndex.current += 1;
    return staticQuestions[idx];
  }, [isArithmetic, difficulty, adaptedDifficulty, staticQuestions]);

  // Load first question and start
  const startGame = useCallback(() => {
    setGameStarted(true);
    const q = getNextQuestion();
    setCurrentQuestion(q);
    questionStartTime.current = Date.now();
    animateQuestionIn();
  }, [getNextQuestion]);

  useEffect(() => {
    // Auto-start after short countdown
    const timer = setTimeout(() => {
      startGame();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const animateQuestionIn = useCallback(() => {
    questionAnim.setValue(0);
    Animated.spring(questionAnim, {
      toValue: 1,
      ...SPRINGS.rush,
    }).start();
  }, [questionAnim]);

  const animateScore = useCallback(() => {
    Animated.sequence([
      Animated.spring(scoreAnim, {
        toValue: 1.3,
        ...SPRINGS.quick,
      }),
      Animated.spring(scoreAnim, {
        toValue: 1,
        ...SPRINGS.playful,
      }),
    ]).start();
  }, [scoreAnim]);

  // Handle answer selection
  const handleAnswer = useCallback(
    selectedIndex => {
      if (!currentQuestion || gameOver) return;

      const responseTimeMs = Date.now() - questionStartTime.current;
      const isCorrect = selectedIndex === currentQuestion.correctIndex;

      // Update option states briefly
      const newStates = ['disabled', 'disabled', 'disabled', 'disabled'];
      newStates[currentQuestion.correctIndex] = 'correct';
      if (!isCorrect) {
        newStates[selectedIndex] = 'incorrect';
      }
      setOptionStates(newStates);

      // Report answer
      if (onAnswer) {
        onAnswer(isCorrect, currentQuestion.concept, responseTimeMs);
      }

      // Update stats
      setTotalAnswered(prev => prev + 1);
      if (isCorrect) {
        setScore(prev => prev + 1);
        setCorrectCount(prev => prev + 1);
        consecutiveCorrect.current += 1;
        consecutiveWrong.current = 0;
        setStreak(prev => (prev >= 0 ? prev + 1 : 1));
        animateScore();
      } else {
        consecutiveWrong.current += 1;
        consecutiveCorrect.current = 0;
        setStreak(prev => (prev <= 0 ? prev - 1 : -1));
      }

      // Adapt difficulty
      if (consecutiveWrong.current >= 3) {
        setAdaptedDifficulty(prev => Math.max(0.5, prev - 0.2));
        setShowHint(true);
      } else if (consecutiveCorrect.current >= 3 && responseTimeMs < 3000) {
        setAdaptedDifficulty(prev => Math.min(2.0, prev + 0.15));
        setShowHint(false);
      } else {
        setShowHint(false);
      }

      // Quick transition to next question
      setTimeout(() => {
        if (!mountedRef.current) return;
        const next = getNextQuestion();
        setCurrentQuestion(next);
        setOptionStates(['default', 'default', 'default', 'default']);
        questionStartTime.current = Date.now();
        animateQuestionIn();
      }, 350);
    },
    [currentQuestion, gameOver, onAnswer, getNextQuestion, animateQuestionIn, animateScore],
  );

  // Timer finished
  const handleTimeUp = useCallback(() => {
    setGameOver(true);
  }, []);

  // Final complete
  const handleFinish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  // Render countdown / start screen
  if (!gameStarted) {
    return (
      <View style={styles.container}>
        <View style={styles.startScreen}>
          <Icon name="timer-outline" size={80} color={kidsColors.accent} />
          <Text style={styles.startTitle}>Get Ready!</Text>
          <Text style={styles.startSubtitle}>
            Answer as many as you can in {timeLimit} seconds!
          </Text>
        </View>
      </View>
    );
  }

  // Render game over screen
  if (gameOver) {
    const accuracy =
      totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    return (
      <View style={styles.container}>
        <View style={styles.gameOverContainer}>
          <Icon name="trophy" size={80} color={kidsColors.star} />
          <Text style={styles.gameOverTitle}>Time's Up!</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{score}</Text>
              <Text style={styles.statLabel}>Correct</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalAnswered}</Text>
              <Text style={styles.statLabel}>Answered</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{accuracy}%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
          </View>
          {score >= 10 && (
            <View style={styles.achievementBadge}>
              <Icon name="star" size={24} color={kidsColors.star} />
              <Text style={styles.achievementText}>Speed Star!</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinish}
            activeOpacity={0.8}>
            <Text style={styles.finishButtonText}>Continue</Text>
            <Icon
              name="arrow-right"
              size={24}
              color={kidsColors.textOnDark}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render game play
  const questionScale = questionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });
  const questionOpacity = questionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Timer Bar */}
      <TimerBar
        duration={timeLimit}
        running={gameStarted && !gameOver}
        onTimeUp={handleTimeUp}
        height={8}
      />

      {/* Score Header */}
      <View style={styles.scoreHeader}>
        <View style={styles.scoreLeft}>
          <Icon name="check-circle" size={20} color={kidsColors.correct} />
          <Animated.Text
            style={[styles.scoreText, {transform: [{scale: scoreAnim}]}]}>
            {score}
          </Animated.Text>
        </View>
        {streak >= 3 && (
          <View style={styles.streakBadge}>
            <Icon name="fire" size={18} color={kidsColors.streakFire} />
            <Text style={styles.streakText}>{streak} streak!</Text>
          </View>
        )}
        <View style={styles.scoreRight}>
          <Text style={styles.totalText}>{totalAnswered} answered</Text>
        </View>
      </View>

      {/* Hint banner */}
      {showHint && currentQuestion && (
        <View style={styles.hintBanner}>
          <Icon name="lightbulb-on" size={18} color={kidsColors.star} />
          <Text style={styles.hintText}>
            Take your time! Think carefully about each answer.
          </Text>
        </View>
      )}

      {/* Question Area */}
      {currentQuestion && (
        <Animated.View
          style={[
            styles.questionArea,
            {transform: [{scale: questionScale}], opacity: questionOpacity},
          ]}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>

          {/* Options Grid */}
          <View style={styles.optionsGrid}>
            {currentQuestion.options.map((option, index) => (
              <View key={`${totalAnswered}-${index}`} style={styles.optionWrapper}>
                <OptionButton
                  label={option}
                  onPress={() => handleAnswer(index)}
                  state={optionStates[index]}
                  size="large"
                  color={kidsColors.palette[index % kidsColors.palette.length]}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Difficulty indicator */}
      <View style={styles.difficultyBar}>
        <Text style={styles.difficultyLabel}>
          Level:{' '}
          {adaptedDifficulty <= 0.7
            ? 'Easy'
            : adaptedDifficulty >= 1.3
            ? 'Hard'
            : 'Normal'}
        </Text>
        <View style={styles.difficultyDots}>
          {[0.5, 0.8, 1.0, 1.3, 1.6].map((level, i) => (
            <View
              key={i}
              style={[
                styles.difficultyDot,
                {
                  backgroundColor:
                    adaptedDifficulty >= level
                      ? kidsColors.accent
                      : kidsColors.border,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
    paddingTop: kidsSpacing.sm,
  },
  // Start screen
  startScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kidsSpacing.xl,
  },
  startTitle: {
    fontSize: kidsFontSize.display,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.accent,
    marginTop: kidsSpacing.lg,
  },
  startSubtitle: {
    fontSize: kidsFontSize.lg,
    color: kidsColors.textSecondary,
    textAlign: 'center',
    marginTop: kidsSpacing.sm,
  },
  // Score header
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: kidsSpacing.lg,
    paddingVertical: kidsSpacing.md,
  },
  scoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
  },
  scoreText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.correct,
  },
  scoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.backgroundTertiary,
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.xs,
    borderRadius: kidsBorderRadius.full,
    gap: 4,
  },
  streakText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.streakFire,
  },
  // Hint banner
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.hintBg,
    marginHorizontal: kidsSpacing.lg,
    padding: kidsSpacing.sm,
    borderRadius: kidsBorderRadius.md,
    gap: kidsSpacing.sm,
    borderWidth: 1,
    borderColor: kidsColors.star,
  },
  hintText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
    flex: 1,
  },
  // Question area
  questionArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: kidsSpacing.lg,
  },
  questionText: {
    fontSize: kidsFontSize.display,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    marginBottom: kidsSpacing.xl,
  },
  optionsGrid: {
    gap: kidsSpacing.md,
  },
  optionWrapper: {
    marginBottom: kidsSpacing.xs,
  },
  // Difficulty bar
  difficultyBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: kidsSpacing.md,
    gap: kidsSpacing.sm,
  },
  difficultyLabel: {
    fontSize: kidsFontSize.xs,
    color: kidsColors.textMuted,
  },
  difficultyDots: {
    flexDirection: 'row',
    gap: 4,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Game over
  gameOverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kidsSpacing.xl,
  },
  gameOverTitle: {
    fontSize: kidsFontSize.display,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.accent,
    marginTop: kidsSpacing.md,
    marginBottom: kidsSpacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.lg,
    ...kidsShadows.card,
    marginBottom: kidsSpacing.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: kidsFontSize.xxl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.accent,
  },
  statLabel: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
    marginTop: kidsSpacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: kidsColors.border,
    marginHorizontal: kidsSpacing.sm,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.hintBg,
    paddingHorizontal: kidsSpacing.lg,
    paddingVertical: kidsSpacing.md,
    borderRadius: kidsBorderRadius.full,
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.lg,
    borderWidth: 2,
    borderColor: kidsColors.star,
  },
  achievementText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.star,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: kidsColors.accent,
    paddingVertical: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.xl,
    gap: kidsSpacing.sm,
    ...kidsShadows.button,
  },
  finishButtonText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
});

export default TimedRushTemplate;
