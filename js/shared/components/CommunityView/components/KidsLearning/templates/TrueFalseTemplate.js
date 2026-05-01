import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView} from 'react-native';
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
import ProgressDots from '../shared/ProgressDots';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import TimerBar from '../shared/TimerBar';

/**
 * TrueFalseTemplate - True or False statement game.
 *
 * Shows a statement, child taps True or False. After answering, shows
 * explanation. Implements real-time difficulty adaptation: when struggling,
 * shows hints and removes timer pressure. When blazing through, adds a
 * countdown timer for extra challenge.
 *
 * Props:
 * - config: { content: { statements: [{ text, answer, concept, explanation }] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 */
const TrueFalseTemplate = ({config, onAnswer, onComplete}) => {
  const statements = config?.content?.statements || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [results, setResults] = useState([]);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [consecutiveRight, setConsecutiveRight] = useState(0);
  const [fastStreak, setFastStreak] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);

  // Animations
  const statementAnim = useRef(new Animated.Value(0)).current;
  const trueButtonScale = useRef(new Animated.Value(1)).current;
  const falseButtonScale = useRef(new Animated.Value(1)).current;
  const explanationAnim = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;

  // Feedback
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);

  // Timing
  const questionStartTime = useRef(Date.now());
  const mountedRef = useRef(true);
  const completedRef = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const currentStatement = statements[currentIndex] || {};

  // Animate new question in
  useEffect(() => {
    statementAnim.setValue(0);
    explanationAnim.setValue(0);
    hintAnim.setValue(0);
    iconBounce.setValue(0);

    Animated.parallel([
      Animated.spring(statementAnim, {
        toValue: 1,
        ...SPRINGS.standard,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(iconBounce, {
          toValue: 1,
          ...SPRINGS.bouncy,
        }),
      ]),
    ]).start();

    questionStartTime.current = Date.now();
    setAnswered(false);
    setSelectedAnswer(null);

    // Start timer if in challenge mode
    if (showTimer) {
      setTimerRunning(true);
    }

    return () => {
      setTimerRunning(false);
    };
  }, [currentIndex]);

  // Adaptive: enable timer when child is fast-streaking
  useEffect(() => {
    if (fastStreak >= 4 && !showTimer) {
      setShowTimer(true);
    }
  }, [fastStreak]);

  // Adaptive: show hint when struggling
  useEffect(() => {
    if (consecutiveWrong >= 3 && !answered) {
      Animated.timing(hintAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
      // Disable timer pressure if active
      setShowTimer(false);
      setTimerRunning(false);
    }
  }, [consecutiveWrong, currentIndex]);

  const getHintText = useCallback(() => {
    if (!currentStatement.text) return '';
    const answer = currentStatement.answer;
    // Give a gentle nudge toward the answer
    if (answer === true) {
      return 'Think about it... this one sounds right!';
    }
    return 'Hmm, something about this seems off...';
  }, [currentStatement]);

  const handleAnswer = useCallback(
    userAnswer => {
      if (answered) return;

      setTimerRunning(false);
      const responseTimeMs = Date.now() - questionStartTime.current;
      const isCorrect = userAnswer === currentStatement.answer;

      setSelectedAnswer(userAnswer);
      setAnswered(true);

      // Animate the selected button
      const targetScale =
        userAnswer === true ? trueButtonScale : falseButtonScale;
      Animated.sequence([
        Animated.spring(targetScale, {
          toValue: 0.9,
          ...SPRINGS.quick,
        }),
        Animated.spring(targetScale, {
          toValue: 1,
          ...SPRINGS.playful,
        }),
      ]).start();

      // Track adaptive state
      if (isCorrect) {
        setConsecutiveWrong(0);
        setConsecutiveRight(prev => prev + 1);
        if (responseTimeMs < 3000) {
          setFastStreak(prev => prev + 1);
        } else {
          setFastStreak(0);
        }
      } else {
        setConsecutiveRight(0);
        setFastStreak(0);
        setConsecutiveWrong(prev => prev + 1);
      }

      setResults(prev => [...prev, isCorrect]);

      // Show feedback
      setFeedbackCorrect(isCorrect);
      setFeedbackVisible(true);

      // Report
      onAnswer(isCorrect, currentStatement.concept, responseTimeMs);

      // Show explanation
      Animated.timing(explanationAnim, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }).start();
    },
    [answered, currentStatement, onAnswer],
  );

  const handleTimerUp = useCallback(() => {
    if (!answered) {
      // Treat timeout as wrong answer
      handleAnswer(null);
    }
  }, [answered, handleAnswer]);

  const handleFeedbackDismiss = useCallback(() => {
    setFeedbackVisible(false);

    setTimeout(() => {
      if (!mountedRef.current) return;
      if (currentIndex < statements.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete();
      }
    }, 600);
  }, [currentIndex, statements.length, onComplete]);

  const getButtonStyle = (buttonValue) => {
    if (!answered) return 'default';
    if (buttonValue === currentStatement.answer) return 'correct';
    if (buttonValue === selectedAnswer && buttonValue !== currentStatement.answer) return 'incorrect';
    return 'dimmed';
  };

  if (statements.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="alert-circle-outline" size={48} color={kidsColors.textMuted} />
        <Text style={styles.emptyText}>No statements available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress */}
      <ProgressDots
        total={statements.length}
        current={currentIndex}
        results={results}
      />

      {/* Challenge timer (appears when child is fast) */}
      {showTimer && (
        <View style={styles.timerContainer}>
          <TimerBar
            duration={15}
            running={timerRunning}
            onTimeUp={handleTimerUp}
            height={8}
          />
          <Text style={styles.timerLabel}>Speed Round!</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Question counter */}
        <Text style={styles.questionCounter}>
          {currentIndex + 1} of {statements.length}
        </Text>

        {/* Statement card */}
        <Animated.View
          style={[
            styles.statementCard,
            {
              opacity: statementAnim,
              transform: [
                {
                  scale: statementAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}>
          {/* Question icon */}
          <Animated.View
            style={[
              styles.questionIconContainer,
              {
                transform: [
                  {
                    scale: iconBounce.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                ],
              },
            ]}>
            <Icon
              name="head-question-outline"
              size={40}
              color={kidsColors.accent}
            />
          </Animated.View>

          <Text style={styles.statementLabel}>True or False?</Text>
          <Text style={styles.statementText}>{currentStatement.text}</Text>
        </Animated.View>

        {/* Hint (adaptive - shows when struggling) */}
        {consecutiveWrong >= 3 && !answered && (
          <Animated.View
            style={[
              styles.hintCard,
              {
                opacity: hintAnim,
                transform: [
                  {
                    translateY: hintAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [15, 0],
                    }),
                  },
                ],
              },
            ]}>
            <Icon
              name="lightbulb-on-outline"
              size={22}
              color={kidsColors.star}
            />
            <Text style={styles.hintText}>{getHintText()}</Text>
          </Animated.View>
        )}

        {/* True / False buttons */}
        <View style={styles.buttonsRow}>
          {/* TRUE button */}
          <Animated.View
            style={[
              styles.tfButtonWrapper,
              {transform: [{scale: trueButtonScale}]},
            ]}>
            <TouchableOpacity
              style={[
                styles.tfButton,
                styles.trueButton,
                getButtonStyle(true) === 'correct' && styles.tfButtonCorrect,
                getButtonStyle(true) === 'incorrect' && styles.tfButtonIncorrect,
                getButtonStyle(true) === 'dimmed' && styles.tfButtonDimmed,
              ]}
              onPress={() => handleAnswer(true)}
              disabled={answered}
              activeOpacity={0.7}>
              <Icon
                name="check-circle"
                size={48}
                color={
                  getButtonStyle(true) === 'correct'
                    ? kidsColors.textOnDark
                    : getButtonStyle(true) === 'dimmed'
                    ? kidsColors.textMuted
                    : kidsColors.correct
                }
              />
              <Text
                style={[
                  styles.tfButtonText,
                  {
                    color:
                      getButtonStyle(true) === 'correct'
                        ? kidsColors.textOnDark
                        : getButtonStyle(true) === 'dimmed'
                        ? kidsColors.textMuted
                        : kidsColors.correct,
                  },
                ]}>
                TRUE
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* FALSE button */}
          <Animated.View
            style={[
              styles.tfButtonWrapper,
              {transform: [{scale: falseButtonScale}]},
            ]}>
            <TouchableOpacity
              style={[
                styles.tfButton,
                styles.falseButton,
                getButtonStyle(false) === 'correct' && styles.tfButtonCorrect,
                getButtonStyle(false) === 'incorrect' && styles.tfButtonIncorrect,
                getButtonStyle(false) === 'dimmed' && styles.tfButtonDimmed,
              ]}
              onPress={() => handleAnswer(false)}
              disabled={answered}
              activeOpacity={0.7}>
              <Icon
                name="close-circle"
                size={48}
                color={
                  getButtonStyle(false) === 'correct'
                    ? kidsColors.textOnDark
                    : getButtonStyle(false) === 'incorrect'
                    ? kidsColors.textOnDark
                    : getButtonStyle(false) === 'dimmed'
                    ? kidsColors.textMuted
                    : kidsColors.incorrect
                }
              />
              <Text
                style={[
                  styles.tfButtonText,
                  {
                    color:
                      getButtonStyle(false) === 'correct'
                        ? kidsColors.textOnDark
                        : getButtonStyle(false) === 'incorrect'
                        ? kidsColors.textOnDark
                        : getButtonStyle(false) === 'dimmed'
                        ? kidsColors.textMuted
                        : kidsColors.incorrect,
                  },
                ]}>
                FALSE
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Explanation (shows after answering) */}
        {answered && currentStatement.explanation && (
          <Animated.View
            style={[
              styles.explanationCard,
              {
                opacity: explanationAnim,
                transform: [
                  {
                    translateY: explanationAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}>
            <Icon
              name="information"
              size={24}
              color={kidsColors.accent}
            />
            <Text style={styles.explanationText}>
              {currentStatement.explanation}
            </Text>
          </Animated.View>
        )}

        {/* Streak indicator */}
        {consecutiveRight >= 3 && (
          <View style={styles.streakBadge}>
            <Icon name="fire" size={20} color={kidsColors.streakFire} />
            <Text style={styles.streakText}>
              {consecutiveRight} in a row!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Feedback overlay */}
      <FeedbackOverlay
        visible={feedbackVisible}
        isCorrect={feedbackCorrect}
        onDismiss={handleFeedbackDismiss}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
    paddingTop: kidsSpacing.sm,
  },
  scrollContent: {
    paddingHorizontal: kidsSpacing.md,
    paddingBottom: kidsSpacing.xxl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: kidsSpacing.md,
  },
  emptyText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textMuted,
  },
  timerContainer: {
    marginHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.sm,
  },
  timerLabel: {
    textAlign: 'center',
    fontSize: kidsFontSize.xs,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.streakFire,
    marginTop: kidsSpacing.xs,
  },
  questionCounter: {
    textAlign: 'center',
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
    marginBottom: kidsSpacing.md,
  },
  statementCard: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.lg,
    marginBottom: kidsSpacing.lg,
    alignItems: 'center',
    ...kidsShadows.float,
  },
  questionIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: kidsColors.accentLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: kidsSpacing.md,
  },
  statementLabel: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.accent,
    marginBottom: kidsSpacing.md,
  },
  statementText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    backgroundColor: kidsColors.hintBg,
    borderRadius: kidsBorderRadius.lg,
    padding: kidsSpacing.md,
    marginBottom: kidsSpacing.md,
    borderLeftWidth: 4,
    borderLeftColor: kidsColors.star,
  },
  hintText: {
    flex: 1,
    fontSize: kidsFontSize.md,
    color: kidsColors.textPrimary,
    fontWeight: kidsFontWeight.medium,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: kidsSpacing.md,
    marginBottom: kidsSpacing.lg,
  },
  tfButtonWrapper: {
    flex: 1,
  },
  tfButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.xl,
    gap: kidsSpacing.sm,
    ...kidsShadows.button,
  },
  trueButton: {
    backgroundColor: kidsColors.correctLight,
    borderWidth: 3,
    borderColor: kidsColors.correct,
  },
  falseButton: {
    backgroundColor: kidsColors.incorrectLight,
    borderWidth: 3,
    borderColor: kidsColors.incorrect,
  },
  tfButtonCorrect: {
    backgroundColor: kidsColors.correct,
    borderColor: kidsColors.correct,
  },
  tfButtonIncorrect: {
    backgroundColor: kidsColors.incorrect,
    borderColor: kidsColors.incorrect,
  },
  tfButtonDimmed: {
    backgroundColor: kidsColors.cardHover,
    borderColor: kidsColors.border,
    opacity: 0.5,
  },
  tfButtonText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.extrabold,
    letterSpacing: 1,
  },
  explanationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: kidsSpacing.sm,
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.lg,
    padding: kidsSpacing.md,
    marginBottom: kidsSpacing.md,
    borderLeftWidth: 4,
    borderLeftColor: kidsColors.accent,
    ...kidsShadows.card,
  },
  explanationText: {
    flex: 1,
    fontSize: kidsFontSize.md,
    color: kidsColors.textPrimary,
    fontWeight: kidsFontWeight.medium,
    lineHeight: 24,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    alignSelf: 'center',
    backgroundColor: kidsColors.warmBg,
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.lg,
    borderRadius: kidsBorderRadius.full,
  },
  streakText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.streakFire,
  },
});

export default TrueFalseTemplate;
