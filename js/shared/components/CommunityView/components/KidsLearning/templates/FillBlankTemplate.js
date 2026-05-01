import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, Animated, StyleSheet, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  kidsColors,
  kidsSpacing,
  kidsBorderRadius,
  kidsFontSize,
  kidsFontWeight,
  kidsShadows,
} from '../../../../../theme/kidsColors';
import OptionButton from '../shared/OptionButton';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import GameLivesBar from '../shared/GameLivesBar';
import KidsCharacter from '../shared/KidsCharacter';
import VisualHint from '../shared/VisualHint';
import {getEmojiForText} from '../shared/emojiMap';

/**
 * FillBlankTemplate - Fill in the blank game.
 *
 * Shows a sentence/equation with a highlighted blank. The child selects the
 * correct word from 4 option buttons. After answering, the completed sentence
 * is revealed. Implements real-time difficulty adaptation.
 *
 * Props:
 * - config: { content: { questions: [{ text, blank, options, concept, hint }] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 */
const FillBlankTemplate = ({config, onAnswer, onComplete}) => {
  const questions = config?.content?.questions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [optionStates, setOptionStates] = useState({});
  const [lives, setLives] = useState(3);
  const [charState, setCharState] = useState('idle');
  const [showVisualHint, setShowVisualHint] = useState(true);

  // Animations
  const sentenceAnim = useRef(new Animated.Value(0)).current;
  const blankPulse = useRef(new Animated.Value(1)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const completedAnim = useRef(new Animated.Value(0)).current;

  // Feedback overlay
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);

  // Timing
  const questionStartTime = useRef(Date.now());
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const currentQuestion = questions[currentIndex] || {};

  // Animate sentence in on question change
  useEffect(() => {
    sentenceAnim.setValue(0);
    completedAnim.setValue(0);
    Animated.timing(sentenceAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Start pulsing the blank indicator
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(blankPulse, {
          toValue: 1.08,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(blankPulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    questionStartTime.current = Date.now();
    setSelectedAnswer(null);
    setAnswered(false);
    setOptionStates({});
    setShowHint(false);
    hintAnim.setValue(0);

    return () => pulse.stop();
  }, [currentIndex]);

  // Show hint if adaptive difficulty triggers
  useEffect(() => {
    if (consecutiveWrong >= 3 && !showHint && currentQuestion.hint) {
      setShowHint(true);
      Animated.timing(hintAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [consecutiveWrong, currentIndex]);

  // Get display options -- if child is struggling, reduce to 2 options
  const getDisplayOptions = useCallback(() => {
    const opts = currentQuestion.options || [];
    if (consecutiveWrong >= 3 && opts.length > 2) {
      // Keep the correct answer and one distractor
      const correct = currentQuestion.blank;
      const distractors = opts.filter(o => o !== correct);
      const oneDistractor =
        distractors[Math.floor(Math.random() * distractors.length)];
      const reduced = [correct, oneDistractor].sort(() => Math.random() - 0.5);
      return reduced;
    }
    return opts;
  }, [currentQuestion, consecutiveWrong]);

  const [displayOptions, setDisplayOptions] = useState([]);

  useEffect(() => {
    setDisplayOptions(getDisplayOptions());
  }, [currentIndex, consecutiveWrong]);

  const handleSelect = useCallback(
    option => {
      if (answered) return;

      const responseTimeMs = Date.now() - questionStartTime.current;
      const isCorrect = option === currentQuestion.blank;

      setSelectedAnswer(option);
      setAnswered(true);

      // Update option states for visual feedback
      const newStates = {};
      displayOptions.forEach(opt => {
        if (opt === currentQuestion.blank) {
          newStates[opt] = 'correct';
        } else if (opt === option && !isCorrect) {
          newStates[opt] = 'incorrect';
        } else {
          newStates[opt] = 'disabled';
        }
      });
      setOptionStates(newStates);

      // Animate character
      if (isCorrect) {
        setCharState('celebrate');
        setTimeout(() => {
          if (mountedRef.current) setCharState('idle');
        }, 1500);
        setConsecutiveWrong(0);
      } else {
        setCharState('encourage');
        setTimeout(() => {
          if (mountedRef.current) setCharState('idle');
        }, 1500);
        setLives(prev => Math.max(0, prev - 1));
        setConsecutiveWrong(prev => prev + 1);
      }

      // Record result
      setResults(prev => [...prev, isCorrect]);

      // Show feedback
      setFeedbackCorrect(isCorrect);
      setFeedbackVisible(true);

      // Report answer
      onAnswer(isCorrect, currentQuestion.concept, responseTimeMs);

      // Animate completed sentence
      Animated.timing(completedAnim, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }).start();
    },
    [answered, currentQuestion, displayOptions, onAnswer],
  );

  const handleFeedbackDismiss = useCallback(() => {
    setFeedbackVisible(false);

    // Move to next question after feedback
    setTimeout(() => {
      if (!mountedRef.current) return;
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onComplete();
      }
    }, 400);
  }, [currentIndex, questions.length, onComplete]);

  // Render the sentence with the blank highlighted
  const renderSentence = () => {
    const text = currentQuestion.text || '';
    const parts = text.split('___');

    return (
      <Animated.View
        style={[
          styles.sentenceContainer,
          {
            opacity: sentenceAnim,
            transform: [
              {
                translateY: sentenceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          },
        ]}>
        <Text style={styles.sentenceText}>
          {parts[0]}
          {answered ? (
            <Text style={styles.blankFilledText}>{currentQuestion.blank}</Text>
          ) : (
            <Text style={styles.blankPlaceholder}> ______ </Text>
          )}
          {parts[1] || ''}
        </Text>
      </Animated.View>
    );
  };

  if (questions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="alert-circle-outline" size={48} color={kidsColors.textMuted} />
        <Text style={styles.emptyText}>No questions available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* GameLivesBar replaces ProgressDots */}
      <GameLivesBar
        lives={lives}
        score={results.filter(r => r).length}
        currentLevel={currentIndex + 1}
        totalLevels={questions.length}
        streak={0}
      />

      {/* Kids Character */}
      <View style={{alignItems: 'center', marginBottom: 8}}>
        <KidsCharacter seed={`fill-${currentIndex}`} state={charState} size={72} />
      </View>

      {/* Visual Hint on first question */}
      <VisualHint
        type="tap"
        visible={showVisualHint && currentIndex === 0}
        onDismiss={() => setShowVisualHint(false)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Instruction */}
        <View style={styles.instructionRow}>
          <Icon
            name="pencil-circle"
            size={28}
            color={kidsColors.accent}
          />
          <Text style={styles.instructionText}>
            Fill in the blank!
          </Text>
        </View>

        {/* Hero visual emoji */}
        <View style={{alignItems: 'center', marginBottom: 12}}>
          <Text style={{fontSize: 56}}>
            {currentQuestion.emoji || getEmojiForText(currentQuestion.blank) || getEmojiForText(currentQuestion.text) || '\u2753'}
          </Text>
        </View>

        {/* Sentence with blank */}
        <View style={styles.sentenceCard}>
          {renderSentence()}

          {/* Bouncing arrow pointing at the blank */}
          {!answered && (
            <View style={{alignItems: 'center', marginTop: -8, marginBottom: 4}}>
              <Animated.Text
                style={{
                  fontSize: 28,
                  transform: [
                    {
                      translateY: blankPulse.interpolate({
                        inputRange: [1, 1.08],
                        outputRange: [0, 6],
                      }),
                    },
                  ],
                }}>
                {'\uD83D\uDC47'}
              </Animated.Text>
            </View>
          )}

          {/* Blank indicator pulsing */}
          {!answered && (
            <Animated.View
              style={[
                styles.blankIndicator,
                {transform: [{scale: blankPulse}]},
              ]}>
              <Icon name="help-circle" size={24} color={kidsColors.accent} />
              <Text style={styles.blankIndicatorText}>
                Choose the right word
              </Text>
            </Animated.View>
          )}

          {/* Completed sentence reveal */}
          {answered && (
            <Animated.View
              style={[
                styles.completedBadge,
                {
                  opacity: completedAnim,
                  transform: [
                    {
                      scale: completedAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <Text style={{fontSize: 20}}>
                {feedbackCorrect ? '\uD83C\uDF89' : '\uD83D\uDCAA'}
              </Text>
              <Icon
                name={feedbackCorrect ? 'check-circle' : 'information'}
                size={20}
                color={
                  feedbackCorrect ? kidsColors.correct : kidsColors.accent
                }
              />
              <Text
                style={[
                  styles.completedText,
                  {
                    color: feedbackCorrect
                      ? kidsColors.correct
                      : kidsColors.accent,
                  },
                ]}>
                {feedbackCorrect
                  ? 'Great job!'
                  : `The answer is "${currentQuestion.blank}"`}
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Hint (shows when struggling) */}
        {showHint && currentQuestion.hint && (
          <Animated.View
            style={[
              styles.hintCard,
              {
                opacity: hintAnim,
                transform: [
                  {
                    translateY: hintAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}>
            <Icon
              name="lightbulb-on-outline"
              size={24}
              color={kidsColors.star}
            />
            <Text style={styles.hintText}>{currentQuestion.hint}</Text>
          </Animated.View>
        )}

        {/* Difficulty indicator */}
        {consecutiveWrong >= 3 && (
          <View style={styles.difficultyNote}>
            <Icon name="heart" size={16} color={kidsColors.correct} />
            <Text style={styles.difficultyNoteText}>
              Here are fewer choices to help you!
            </Text>
          </View>
        )}

        {/* Options with emoji */}
        <View style={styles.optionsContainer}>
          {displayOptions.map((option, index) => (
            <OptionButton
              key={`${currentIndex}-${option}`}
              label={option}
              emoji={getEmojiForText(option)}
              onPress={() => handleSelect(option)}
              state={optionStates[option] || 'default'}
              color={kidsColors.card}
              size="large"
            />
          ))}
        </View>
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
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.xs,
  },
  instructionText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
  sentenceCard: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.lg,
    marginBottom: kidsSpacing.lg,
    ...kidsShadows.card,
  },
  sentenceContainer: {
    paddingVertical: kidsSpacing.md,
  },
  sentenceText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textPrimary,
    lineHeight: 40,
    textAlign: 'center',
  },
  blankPlaceholder: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.accent,
    textDecorationLine: 'underline',
    textDecorationColor: kidsColors.accent,
  },
  blankFilledText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.correct,
    backgroundColor: kidsColors.correctLight,
  },
  blankIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    marginTop: kidsSpacing.md,
  },
  blankIndicatorText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.accent,
    fontWeight: kidsFontWeight.medium,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    marginTop: kidsSpacing.md,
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.md,
    borderRadius: kidsBorderRadius.full,
    backgroundColor: kidsColors.correctLight,
    alignSelf: 'center',
  },
  completedText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.semibold,
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
  difficultyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    marginBottom: kidsSpacing.sm,
  },
  difficultyNoteText: {
    fontSize: kidsFontSize.xs,
    color: kidsColors.textSecondary,
    fontStyle: 'italic',
  },
  optionsContainer: {
    gap: kidsSpacing.md,
  },
});

export default FillBlankTemplate;
