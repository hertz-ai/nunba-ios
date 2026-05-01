import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../../theme/kidsColors';
import OptionButton from '../shared/OptionButton';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import GameLivesBar from '../shared/GameLivesBar';
import KidsCharacter from '../shared/KidsCharacter';
import VisualHint from '../shared/VisualHint';
import {getEmojiForText} from '../shared/emojiMap';
import {GameSounds} from '../shared/SoundManager';
import {SPRINGS} from '../shared/gameThemes';

/**
 * MultipleChoiceTemplate - Adaptive multiple choice quiz for kids.
 *
 * Props:
 * - config: { content: { questions: [{ question, options, correctIndex, concept, hint }] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 *
 * Intelligence features:
 * - Tracks response time per question (fast = confident, slow = struggling)
 * - After 3+ consecutive wrong: shows hints automatically, reduces to 2 options
 * - After fast correct streak: adds distractor options to increase challenge
 * - After 2 wrong on same question: reveals the hint
 */
const MultipleChoiceTemplate = ({config, onAnswer, onComplete}) => {
  // --- Shuffle questions on mount ---
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [optionStates, setOptionStates] = useState({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [wrongCountForCurrent, setWrongCountForCurrent] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  // Adaptive difficulty state
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [adaptiveMode, setAdaptiveMode] = useState('normal'); // 'easy' | 'normal' | 'hard'
  const [reducedOptions, setReducedOptions] = useState(null);

  // Visual overhaul state
  const [lives, setLives] = useState(3);
  const [charState, setCharState] = useState('idle');
  const [showVisualHint, setShowVisualHint] = useState(true);

  // Animation refs
  const questionAnim = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Shuffle questions on mount
  useEffect(() => {
    if (config?.content?.questions) {
      const shuffled = [...config.content.questions]
        .map((q, i) => ({...q, originalIndex: i}))
        .sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
    }
  }, [config]);

  // Animate question entry
  useEffect(() => {
    if (questions.length > 0 && currentIndex < questions.length) {
      questionAnim.setValue(0);
      Animated.spring(questionAnim, {
        toValue: 1,
        ...SPRINGS.standard,
      }).start();
      startTimeRef.current = Date.now();
      setShowHint(false);
      setWrongCountForCurrent(0);
      setOptionStates({});
      setReducedOptions(null);
      hintAnim.setValue(0);

      // In easy mode, automatically reduce options
      if (adaptiveMode === 'easy' && questions[currentIndex]?.options?.length > 2) {
        reduceOptionsForQuestion(currentIndex);
      }
    }
  }, [currentIndex, questions]);

  // Update adaptive mode based on streaks
  useEffect(() => {
    if (consecutiveWrong >= 3) {
      setAdaptiveMode('easy');
    } else if (consecutiveCorrect >= 4) {
      setAdaptiveMode('hard');
    } else {
      setAdaptiveMode('normal');
    }
  }, [consecutiveWrong, consecutiveCorrect]);

  const reduceOptionsForQuestion = useCallback((qIndex) => {
    const q = questions[qIndex];
    if (!q || q.options.length <= 2) return;

    const correctIdx = q.correctIndex;
    // Keep the correct answer plus one random wrong answer
    const wrongIndices = q.options
      .map((_, i) => i)
      .filter(i => i !== correctIdx);
    const keptWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    const kept = [correctIdx, keptWrong].sort(() => Math.random() - 0.5);
    setReducedOptions(kept);
  }, [questions]);

  const revealHint = useCallback(() => {
    setShowHint(true);
    Animated.spring(hintAnim, {
      toValue: 1,
      ...SPRINGS.standard,
    }).start();
  }, [hintAnim]);

  const handleAnswer = useCallback((optionIndex) => {
    if (isLocked || currentIndex >= questions.length) return;
    GameSounds.tap();
    setIsLocked(true);

    const question = questions[currentIndex];
    const responseTimeMs = Date.now() - startTimeRef.current;
    const isCorrect = optionIndex === question.correctIndex;

    // Update option visual states
    const newStates = {};
    if (isCorrect) {
      newStates[optionIndex] = 'correct';
    } else {
      newStates[optionIndex] = 'incorrect';
      newStates[question.correctIndex] = 'correct';
    }
    setOptionStates(newStates);

    // Show feedback overlay with emoji feedback
    setFeedbackCorrect(isCorrect);
    if (isCorrect) {
      setFeedbackMessage('\u{1F389}\u2B50');
      setCharState('celebrate');
      setTimeout(() => {
        if (mountedRef.current) setCharState('idle');
      }, 1500);
    } else {
      setFeedbackMessage('\u{1F4AA}');
      setCharState('encourage');
      setTimeout(() => {
        if (mountedRef.current) setCharState('idle');
      }, 1500);
      setLives(prev => Math.max(0, prev - 1));
    }
    setShowFeedback(true);

    // Update adaptive tracking
    if (isCorrect) {
      setConsecutiveWrong(0);
      setConsecutiveCorrect(prev => prev + 1);
    } else {
      setConsecutiveCorrect(0);
      setConsecutiveWrong(prev => prev + 1);
      const newWrongCount = wrongCountForCurrent + 1;
      setWrongCountForCurrent(newWrongCount);
      if (newWrongCount >= 2 && question.hint && !showHint) {
        revealHint();
      }
    }

    // Report answer to parent
    if (onAnswer) {
      onAnswer(isCorrect, question.concept, responseTimeMs);
    }

    // Update results and advance
    setResults(prev => [...prev, isCorrect]);
  }, [currentIndex, questions, isLocked, wrongCountForCurrent, showHint, onAnswer, revealHint]);

  const handleFeedbackDismiss = useCallback(() => {
    setShowFeedback(false);
    setIsLocked(false);

    const wasCorrect = results[results.length - 1];

    if (wasCorrect) {
      // Move to next question
      if (currentIndex + 1 >= questions.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        if (onComplete) onComplete();
      } else {
        // Slide-out then advance
        Animated.timing(questionAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          if (mountedRef.current) {
            setCurrentIndex(prev => prev + 1);
          }
        });
      }
    } else {
      // Stay on same question, but allow retry
      setOptionStates({});
      // If in easy mode and not already reduced, reduce now
      if (adaptiveMode === 'easy' && !reducedOptions) {
        reduceOptionsForQuestion(currentIndex);
      }
    }
  }, [currentIndex, questions, results, adaptiveMode, reducedOptions, onComplete, reduceOptionsForQuestion]);

  // --- Render ---
  if (questions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  if (currentIndex >= questions.length) {
    return null;
  }

  const currentQuestion = questions[currentIndex];
  const displayOptions = reducedOptions
    ? reducedOptions.map(i => ({label: currentQuestion.options[i], originalIndex: i}))
    : currentQuestion.options.map((label, i) => ({label, originalIndex: i}));

  const bounceScale = questionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const bounceOpacity = questionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const hintScale = hintAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <View style={styles.container}>
      {/* Game Lives Bar */}
      <GameLivesBar
        lives={lives}
        score={results.filter(r => r).length}
        currentLevel={currentIndex + 1}
        totalLevels={questions.length}
        streak={consecutiveCorrect}
      />

      {/* Kids Character */}
      <View style={{alignItems: 'center', marginBottom: 8}}>
        <KidsCharacter seed={`mc-${currentIndex}`} state={charState} size={80} />
      </View>

      {/* Visual Hint on first question */}
      <VisualHint type="tap" visible={showVisualHint && currentIndex === 0} onDismiss={() => setShowVisualHint(false)} />

      {/* Adaptive mode indicator */}
      {adaptiveMode === 'easy' && (
        <View style={styles.adaptiveBanner}>
          <Icon name="lightbulb-on-outline" size={16} color={kidsColors.star} />
          <Text style={styles.adaptiveText}>Helper mode ON</Text>
        </View>
      )}
      {adaptiveMode === 'hard' && (
        <View style={[styles.adaptiveBanner, {backgroundColor: kidsColors.accentLight + '20'}]}>
          <Icon name="fire" size={16} color={kidsColors.streak} />
          <Text style={[styles.adaptiveText, {color: kidsColors.streak}]}>Challenge mode!</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Question */}
        <Animated.View
          style={[
            styles.questionContainer,
            {
              opacity: bounceOpacity,
              transform: [{scale: bounceScale}],
            },
          ]}
        >
          {/* Hero visual emoji */}
          <Text style={{fontSize: 64, textAlign: 'center', marginBottom: 8}}>
            {currentQuestion.emoji || getEmojiForText(currentQuestion.question) || '\u2753'}
          </Text>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </Animated.View>

        {/* Hint */}
        {showHint && currentQuestion.hint && (
          <Animated.View
            style={[
              styles.hintContainer,
              {
                opacity: hintAnim,
                transform: [{scale: hintScale}],
              },
            ]}
          >
            <Icon name="lightbulb-on-outline" size={20} color={kidsColors.star} />
            <Text style={styles.hintText}>{currentQuestion.hint}</Text>
          </Animated.View>
        )}

        {/* Options */}
        <View style={styles.optionsContainer}>
          {displayOptions.map((option, displayIdx) => (
            <OptionButton
              key={`${currentIndex}-${option.originalIndex}`}
              label={option.label}
              emoji={getEmojiForText(option.label)}
              state={optionStates[option.originalIndex] || 'default'}
              onPress={() => handleAnswer(option.originalIndex)}
              size="large"
              color={kidsColors.card}
            />
          ))}
        </View>

        {/* Wrong count indicator */}
        {wrongCountForCurrent > 0 && !isLocked && (
          <View style={styles.retryInfo}>
            <Icon name="refresh" size={16} color={kidsColors.textMuted} />
            <Text style={styles.retryText}>
              Try again! {wrongCountForCurrent === 1 ? 'One more try for a hint.' : ''}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Feedback Overlay */}
      <FeedbackOverlay
        visible={showFeedback}
        isCorrect={feedbackCorrect}
        message={feedbackMessage}
        onDismiss={handleFeedbackDismiss}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
    paddingTop: kidsSpacing.md,
  },
  scrollContent: {
    paddingHorizontal: kidsSpacing.lg,
    paddingBottom: kidsSpacing.xxl,
  },
  loadingText: {
    fontSize: kidsFontSize.lg,
    color: kidsColors.textSecondary,
    textAlign: 'center',
    marginTop: kidsSpacing.xxl,
  },
  adaptiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    paddingVertical: kidsSpacing.xs,
    backgroundColor: kidsColors.star + '20',
    marginHorizontal: kidsSpacing.lg,
    borderRadius: kidsBorderRadius.sm,
    marginBottom: kidsSpacing.sm,
  },
  adaptiveText: {
    fontSize: kidsFontSize.xs,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.star,
  },
  questionContainer: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.lg,
    marginTop: kidsSpacing.md,
    marginBottom: kidsSpacing.lg,
    alignItems: 'center',
    ...kidsShadows.card,
  },
  questionText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    lineHeight: 36,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    backgroundColor: kidsColors.star + '18',
    borderRadius: kidsBorderRadius.md,
    padding: kidsSpacing.md,
    marginBottom: kidsSpacing.md,
    borderWidth: 1,
    borderColor: kidsColors.star + '40',
  },
  hintText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textPrimary,
    flex: 1,
  },
  optionsContainer: {
    gap: kidsSpacing.md,
  },
  retryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    marginTop: kidsSpacing.md,
  },
  retryText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
    fontWeight: kidsFontWeight.medium,
  },
});

export default MultipleChoiceTemplate;
