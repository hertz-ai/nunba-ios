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
import {STEP, LEVEL, trueFalse as guide} from '../shared/gameGuide';
import holdUntilSpoken from '../shared/holdUntilSpoken';

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
// How many answers in a row were right.
const trailingRight = (results) => {
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i]; i--) n++;
  return n;
};

const TrueFalseTemplate = ({config, onAnswer, onComplete, onStep, level = LEVEL.START}) => {
  const statements = config?.content?.statements || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [results, setResults] = useState([]);
  // The shell's one ladder (shared/gameGuide): at LEVEL.MIN a hint and no
  // timer, at LEVEL.MAX a countdown for the challenge.  This template's own
  // ladder (3 misses / 4 fast answers) is gone.
  const struggling = level <= LEVEL.MIN;
  const showTimer = level >= LEVEL.MAX;
  const [timerRunning, setTimerRunning] = useState(false);

  // Animations
  const statementAnim = useRef(new Animated.Value(1)).current;
  const trueButtonScale = useRef(new Animated.Value(1)).current;
  const falseButtonScale = useRef(new Animated.Value(1)).current;
  const explanationAnim = useRef(new Animated.Value(1)).current;
  const hintAnim = useRef(new Animated.Value(1)).current;
  const iconBounce = useRef(new Animated.Value(1)).current;

  // Feedback
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);

  // Timing
  const questionStartTime = useRef(Date.now());
  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  // Defensive advance: TrueFalseTemplate owns its own advance timer so a
  // stuck/missed FeedbackOverlay dismissal cannot freeze gameplay on Q1.
  // (Live-driven 2026-06-02: overlay-only path got stuck on first answer.)
  const advanceTimerRef = useRef(null);
  const advancedForIndexRef = useRef(-1);

  useEffect(() => () => {
    mountedRef.current = false;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  const currentStatement = statements[currentIndex] || {};

  // Animate new question in
  useEffect(() => {
    statementAnim.setValue(1);
    explanationAnim.setValue(1);
    hintAnim.setValue(1);
    iconBounce.setValue(1);

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
    const st = statements[currentIndex];
    if (onStep && st && st.text) {
      // Every line an answer can need is prepared while the child thinks.
      const nextSt = statements[currentIndex + 1];
      const prepare = [guide.right(st), guide.explainMiss(!st.answer, st)]
        .concat(showTimer ? [guide.explainMiss(null, st)] : [])
        .concat(nextSt && nextSt.text ? [guide.ask(nextSt)] : []);
      onStep({kind: STEP.ASKED, itemId: st.concept || `tf-${currentIndex}`, say: guide.ask(st), prepare});
    }

    // Start timer if in challenge mode
    if (showTimer) {
      setTimerRunning(true);
    }

    return () => {
      setTimerRunning(false);
    };
  }, [currentIndex]);

  // At the easiest level: show the hint, and no timer pressure
  useEffect(() => {
    if (struggling && !answered) {
      Animated.timing(hintAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
      setTimerRunning(false);
    }
  }, [struggling, currentIndex]);

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

      let spoken;
      if (onStep) {
        const itemId = currentStatement.concept || `tf-${currentIndex}`;
        spoken = onStep(isCorrect
          ? {kind: STEP.RIGHT, itemId, concept: currentStatement.concept, say: guide.right(currentStatement)}
          : {kind: STEP.WRONG, itemId, chosen: userAnswer, wanted: currentStatement.answer,
             say: guide.explainMiss(userAnswer, currentStatement)});
      }

      setResults(prev => [...prev, isCorrect]);

      // Show feedback.  Guided, the answer and its explanation stay on screen
      // until the voice has said why; the overlay and the fixed 2.2s advance
      // cut an explained miss off mid-sentence.  Unguided keeps both.
      setFeedbackCorrect(isCorrect);
      if (!onStep) setFeedbackVisible(true);

      // Report
      onAnswer(isCorrect, currentStatement.concept, responseTimeMs);

      // Show explanation
      Animated.timing(explanationAnim, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }).start();

      // Defensive advance — owns its own timer so a missed overlay onDismiss
      // never freezes Q1. Idempotent against handleFeedbackDismiss (whichever
      // fires first wins via advancedForIndexRef).
      const indexAtAnswer = currentIndex;
      const advance = () => {
        if (!mountedRef.current) return;
        if (advancedForIndexRef.current >= indexAtAnswer) return;
        advancedForIndexRef.current = indexAtAnswer;
        setFeedbackVisible(false);
        if (indexAtAnswer < statements.length - 1) {
          setCurrentIndex(indexAtAnswer + 1);
        } else {
          if (completedRef.current) return;
          completedRef.current = true;
          onComplete();
        }
      };
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (onStep) {
        holdUntilSpoken(spoken, advance, () => mountedRef.current);
      } else {
        advanceTimerRef.current = setTimeout(advance, 2200);
      }
    },
    [answered, currentStatement, currentIndex, statements.length, onAnswer, onComplete, onStep],
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
      if (advancedForIndexRef.current >= currentIndex) return;
      advancedForIndexRef.current = currentIndex;
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
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
        {struggling && !answered && (
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
              testID="tf-true"
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
              testID="tf-false"
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
        {trailingRight(results) >= 3 && (
          <View style={styles.streakBadge}>
            <Icon name="fire" size={20} color={kidsColors.streakFire} />
            <Text style={styles.streakText}>
              {trailingRight(results)} in a row!
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
