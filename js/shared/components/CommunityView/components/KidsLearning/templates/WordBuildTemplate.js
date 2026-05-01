import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../../theme/kidsColors';
import {SPRINGS} from '../shared/gameThemes';
import ProgressDots from '../shared/ProgressDots';
import FeedbackOverlay from '../shared/FeedbackOverlay';

/**
 * WordBuildTemplate - Spell words from scattered letters.
 *
 * Props:
 * - config: { content: { words: [{ word, hint, concept, extraLetters }] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 *
 * Gameplay:
 * - Shows blank slots for each letter of the word
 * - Below: scattered letter tiles (word letters + extra distractor letters)
 * - Child taps letters in order to fill the slots left-to-right
 * - Tap a filled slot to remove that letter back to the pool
 * - When all slots filled, auto-check correctness
 *
 * Intelligence features:
 * - After 3+ consecutive wrong: removes extra distractor letters
 * - After 2 wrong on same word: reveals the hint and first letter
 * - After fast correct streak: adds more distractor letters
 * - Records concept and response time per word
 */
const WordBuildTemplate = ({config, onAnswer, onComplete}) => {
  const [words, setWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [filledSlots, setFilledSlots] = useState([]);
  const [availableLetters, setAvailableLetters] = useState([]);
  const [results, setResults] = useState([]);
  const [showHint, setShowHint] = useState(false);
  const [wrongCountForWord, setWrongCountForWord] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [slotStates, setSlotStates] = useState([]);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Adaptive difficulty state
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [adaptiveMode, setAdaptiveMode] = useState('normal');

  // Animation refs
  const containerAnim = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const slotAnims = useRef([]);
  const letterBounceAnims = useRef({});
  const startTimeRef = useRef(Date.now());
  const wrongCountRef = useRef(0);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Initialize words
  useEffect(() => {
    if (config?.content?.words) {
      const shuffledWords = [...config.content.words].sort(() => Math.random() - 0.5);
      setWords(shuffledWords);
    }
  }, [config]);

  // Setup current word
  useEffect(() => {
    if (words.length > 0 && currentWordIndex < words.length) {
      const wordObj = words[currentWordIndex];
      const wordLetters = wordObj.word.toLowerCase().split('');
      const extra = wordObj.extraLetters || [];

      // In easy mode, reduce or remove extra letters
      let distractors = [...extra];
      if (adaptiveMode === 'easy') {
        distractors = []; // Remove all distractors in easy mode
      } else if (adaptiveMode === 'hard') {
        // Add more random distractors
        const alphabet = 'abcdefghijklmnopqrstuvwxyz';
        const additionalCount = Math.min(3, wordLetters.length);
        for (let i = 0; i < additionalCount; i++) {
          const randLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
          distractors.push(randLetter);
        }
      }

      // Combine word letters + distractors, then shuffle
      const allLetters = [...wordLetters, ...distractors].map((letter, idx) => ({
        id: `${letter}-${idx}`,
        letter: letter.toUpperCase(),
        originalLetter: letter,
        used: false,
      }));
      const shuffledLetters = allLetters.sort(() => Math.random() - 0.5);

      setAvailableLetters(shuffledLetters);
      setFilledSlots(new Array(wordLetters.length).fill(null));
      setSlotStates(new Array(wordLetters.length).fill('empty'));
      setShowHint(false);
      setWrongCountForWord(0);
      hintAnim.setValue(0);

      // Initialize slot animations
      slotAnims.current = wordLetters.map(() => new Animated.Value(0));
      // Initialize letter bounce animations
      letterBounceAnims.current = {};
      shuffledLetters.forEach(l => {
        letterBounceAnims.current[l.id] = new Animated.Value(1);
      });

      // Bounce in
      containerAnim.setValue(0);
      Animated.spring(containerAnim, {
        toValue: 1,
        ...SPRINGS.standard,
      }).start();

      startTimeRef.current = Date.now();

      // In easy mode after 2 wrong attempts, reveal first letter as a hint
      if (adaptiveMode === 'easy' && wrongCountRef.current >= 2) {
        revealFirstLetter(wordLetters, shuffledLetters);
      }
      // Reset ref for new word (but keep value if same word retrying via adaptiveMode change)
      wrongCountRef.current = 0;
    }
  }, [currentWordIndex, words, adaptiveMode]);

  // Update adaptive mode
  useEffect(() => {
    if (consecutiveWrong >= 3) {
      setAdaptiveMode('easy');
    } else if (consecutiveCorrect >= 4) {
      setAdaptiveMode('hard');
    } else {
      setAdaptiveMode('normal');
    }
  }, [consecutiveWrong, consecutiveCorrect]);

  const revealFirstLetter = useCallback((wordLetters, letters) => {
    if (!wordLetters || wordLetters.length === 0) return;
    const firstLetter = wordLetters[0].toUpperCase();
    const matchingLetter = letters.find(l => l.letter === firstLetter && !l.used);
    if (matchingLetter) {
      // Auto-place the first letter
      setFilledSlots(prev => {
        const newSlots = [...prev];
        newSlots[0] = matchingLetter;
        return newSlots;
      });
      setAvailableLetters(prev =>
        prev.map(l => l.id === matchingLetter.id ? {...l, used: true} : l),
      );
      setSlotStates(prev => {
        const newStates = [...prev];
        newStates[0] = 'filled';
        return newStates;
      });
    }
  }, []);

  const revealHint = useCallback(() => {
    setShowHint(true);
    Animated.spring(hintAnim, {
      toValue: 1,
      ...SPRINGS.standard,
    }).start();
  }, [hintAnim]);

  const handleLetterTap = useCallback((letter) => {
    if (isLocked || letter.used) return;

    // Find the first empty slot
    const emptySlotIdx = filledSlots.findIndex(s => s === null);
    if (emptySlotIdx === -1) return;

    // Bounce animation on the letter
    const bounce = letterBounceAnims.current[letter.id];
    if (bounce) {
      Animated.sequence([
        Animated.timing(bounce, {toValue: 0.8, duration: 80, useNativeDriver: true}),
        Animated.spring(bounce, {toValue: 1, ...SPRINGS.bouncy}),
      ]).start();
    }

    // Animate slot fill
    const slotAnim = slotAnims.current[emptySlotIdx];
    if (slotAnim) {
      slotAnim.setValue(0);
      Animated.spring(slotAnim, {
        toValue: 1,
        ...SPRINGS.snappy,
      }).start();
    }

    // Place letter in slot
    const newSlots = [...filledSlots];
    newSlots[emptySlotIdx] = letter;
    setFilledSlots(newSlots);

    // Mark letter as used
    setAvailableLetters(prev =>
      prev.map(l => l.id === letter.id ? {...l, used: true} : l),
    );

    // Update slot state
    const newStates = [...slotStates];
    newStates[emptySlotIdx] = 'filled';
    setSlotStates(newStates);

    // Check if word is complete
    if (newSlots.every(s => s !== null)) {
      checkWord(newSlots);
    }
  }, [isLocked, filledSlots, slotStates]);

  const handleSlotTap = useCallback((slotIdx) => {
    if (isLocked) return;
    const letter = filledSlots[slotIdx];
    if (!letter) return;

    // Remove letter from slot
    const newSlots = [...filledSlots];
    newSlots[slotIdx] = null;
    setFilledSlots(newSlots);

    // Mark letter as available again
    setAvailableLetters(prev =>
      prev.map(l => l.id === letter.id ? {...l, used: false} : l),
    );

    // Reset slot state
    const newStates = [...slotStates];
    newStates[slotIdx] = 'empty';
    setSlotStates(newStates);
  }, [isLocked, filledSlots, slotStates]);

  const checkWord = useCallback((slots) => {
    setIsLocked(true);
    const wordObj = words[currentWordIndex];
    const builtWord = slots.map(s => s.originalLetter).join('');
    const isCorrect = builtWord === wordObj.word.toLowerCase();
    const responseTimeMs = Date.now() - startTimeRef.current;
    const concept = wordObj.concept || `spell:${wordObj.word}`;

    // Visual feedback on slots
    const newStates = slots.map((s, i) => {
      if (isCorrect) return 'correct';
      return s.originalLetter === wordObj.word[i].toLowerCase() ? 'correct' : 'incorrect';
    });
    setSlotStates(newStates);

    // Update adaptive tracking
    if (isCorrect) {
      setConsecutiveWrong(0);
      setConsecutiveCorrect(prev => prev + 1);
      setFeedbackCorrect(true);
      setFeedbackMessage(responseTimeMs < 4000 ? 'Speed speller!' : 'Well spelled!');
    } else {
      setConsecutiveCorrect(0);
      setConsecutiveWrong(prev => prev + 1);
      const newWrongCount = wrongCountForWord + 1;
      setWrongCountForWord(newWrongCount);
      wrongCountRef.current = newWrongCount;
      if (newWrongCount >= 2 && wordObj.hint && !showHint) {
        revealHint();
      }
      setFeedbackCorrect(false);
      setFeedbackMessage('');
    }

    setResults(prev => [...prev, isCorrect]);
    setShowFeedback(true);

    if (onAnswer) {
      onAnswer(isCorrect, concept, responseTimeMs);
    }
  }, [words, currentWordIndex, wrongCountForWord, showHint, onAnswer, revealHint]);

  const handleFeedbackDismiss = useCallback(() => {
    setShowFeedback(false);
    setIsLocked(false);

    const wasCorrect = results[results.length - 1];

    if (wasCorrect) {
      if (currentWordIndex + 1 >= words.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        if (onComplete) onComplete();
      } else {
        setCurrentWordIndex(prev => prev + 1);
      }
    } else {
      // Reset slots for retry
      setFilledSlots(new Array(words[currentWordIndex].word.length).fill(null));
      setAvailableLetters(prev => prev.map(l => ({...l, used: false})));
      setSlotStates(new Array(words[currentWordIndex].word.length).fill('empty'));
      startTimeRef.current = Date.now();

      // In easy mode, auto-fill first letter on retry
      if (adaptiveMode === 'easy') {
        const wordLetters = words[currentWordIndex].word.toLowerCase().split('');
        setTimeout(() => {
          if (!mountedRef.current) return;
          const firstLetter = wordLetters[0].toUpperCase();
          setAvailableLetters(prev => {
            const match = prev.find(l => l.letter === firstLetter && !l.used);
            if (match) {
              setFilledSlots(slots => {
                const newSlots = [...slots];
                newSlots[0] = match;
                return newSlots;
              });
              setSlotStates(states => {
                const newStates = [...states];
                newStates[0] = 'filled';
                return newStates;
              });
              return prev.map(l => l.id === match.id ? {...l, used: true} : l);
            }
            return prev;
          });
        }, 200);
      }
    }
  }, [results, currentWordIndex, words, adaptiveMode, onComplete]);

  // --- Render ---
  if (words.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading words...</Text>
      </View>
    );
  }

  if (currentWordIndex >= words.length) {
    return null;
  }

  const currentWord = words[currentWordIndex];
  const containerScale = containerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });
  const hintScale = hintAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <View style={styles.container}>
      {/* Progress */}
      <ProgressDots total={words.length} current={currentWordIndex} results={results.filter(r => r).slice(0, currentWordIndex)} />

      {/* Adaptive mode indicator */}
      {adaptiveMode === 'easy' && (
        <View style={styles.adaptiveBanner}>
          <Icon name="lightbulb-on-outline" size={16} color={kidsColors.star} />
          <Text style={styles.adaptiveText}>Fewer letters to choose from!</Text>
        </View>
      )}
      {adaptiveMode === 'hard' && (
        <View style={[styles.adaptiveBanner, {backgroundColor: kidsColors.accentLight + '20'}]}>
          <Icon name="fire" size={16} color={kidsColors.streak} />
          <Text style={[styles.adaptiveText, {color: kidsColors.streak}]}>Extra letters challenge!</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <Animated.View style={{transform: [{scale: containerScale}], opacity: containerAnim}}>
          {/* Word prompt */}
          <View style={styles.promptContainer}>
            <Icon name="pencil-outline" size={24} color={kidsColors.accent} />
            <Text style={styles.promptText}>Spell the word!</Text>
          </View>

          {/* Hint */}
          {showHint && currentWord.hint && (
            <Animated.View
              style={[
                styles.hintContainer,
                {opacity: hintAnim, transform: [{scale: hintScale}]},
              ]}
            >
              <Icon name="lightbulb-on-outline" size={20} color={kidsColors.star} />
              <Text style={styles.hintText}>Hint: {currentWord.hint}</Text>
            </Animated.View>
          )}

          {/* Blank Slots */}
          <View style={styles.slotsContainer}>
            {filledSlots.map((slot, idx) => {
              const slotAnim = slotAnims.current[idx] || new Animated.Value(0);
              const scale = slotAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              });
              const state = slotStates[idx];
              const bgColor =
                state === 'correct'
                  ? kidsColors.correctLight
                  : state === 'incorrect'
                    ? kidsColors.incorrectLight
                    : slot
                      ? kidsColors.accentLight + '20'
                      : kidsColors.card;
              const borderColor =
                state === 'correct'
                  ? kidsColors.correct
                  : state === 'incorrect'
                    ? kidsColors.incorrect
                    : slot
                      ? kidsColors.accent
                      : kidsColors.border;

              return (
                <TouchableOpacity
                  key={`slot-${idx}`}
                  style={[
                    styles.letterSlot,
                    {backgroundColor: bgColor, borderColor},
                    !slot && idx === filledSlots.findIndex(s => s === null) && styles.letterSlotActive,
                  ]}
                  onPress={() => handleSlotTap(idx)}
                  disabled={!slot || isLocked}
                  activeOpacity={0.7}
                >
                  {slot ? (
                    <Animated.View style={{transform: [{scale}]}}>
                      <Text style={[
                        styles.letterSlotText,
                        state === 'correct' && {color: kidsColors.correct},
                        state === 'incorrect' && {color: kidsColors.incorrect},
                      ]}>
                        {slot.letter}
                      </Text>
                    </Animated.View>
                  ) : (
                    <Text style={styles.letterSlotPlaceholder}>_</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tap to remove instruction */}
          {filledSlots.some(s => s !== null) && !isLocked && (
            <Text style={styles.removeHint}>Tap a letter above to remove it</Text>
          )}

          {/* Scattered Letter Tiles */}
          <View style={styles.letterTilesContainer}>
            <Text style={styles.tilesLabel}>Available letters:</Text>
            <View style={styles.letterTilesGrid}>
              {availableLetters.map((letterObj, idx) => {
                const bounce = letterBounceAnims.current[letterObj.id] || new Animated.Value(1);
                const tileColor = kidsColors.palette[idx % kidsColors.palette.length];

                return (
                  <Animated.View
                    key={letterObj.id}
                    style={{transform: [{scale: bounce}]}}
                  >
                    <TouchableOpacity
                      style={[
                        styles.letterTile,
                        {
                          backgroundColor: letterObj.used ? kidsColors.border : tileColor,
                          opacity: letterObj.used ? 0.3 : 1,
                        },
                      ]}
                      onPress={() => handleLetterTap(letterObj)}
                      disabled={letterObj.used || isLocked}
                      activeOpacity={0.6}
                    >
                      <Text style={[
                        styles.letterTileText,
                        letterObj.used && {color: kidsColors.textMuted},
                      ]}>
                        {letterObj.letter}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* Wrong count */}
          {wrongCountForWord > 0 && !isLocked && (
            <View style={styles.wrongRow}>
              <Icon name="refresh" size={16} color={kidsColors.textMuted} />
              <Text style={styles.wrongText}>
                Attempt {wrongCountForWord + 1}{wrongCountForWord === 1 ? ' - hint coming soon!' : ''}
              </Text>
            </View>
          )}
        </Animated.View>
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
  promptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.lg,
  },
  promptText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    backgroundColor: kidsColors.star + '18',
    borderRadius: kidsBorderRadius.md,
    padding: kidsSpacing.md,
    marginBottom: kidsSpacing.lg,
    borderWidth: 1,
    borderColor: kidsColors.star + '40',
  },
  hintText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textPrimary,
    flex: 1,
  },
  slotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.sm,
    flexWrap: 'wrap',
  },
  letterSlot: {
    width: 52,
    height: 60,
    borderRadius: kidsBorderRadius.md,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    ...kidsShadows.card,
  },
  letterSlotActive: {
    borderColor: kidsColors.accent,
    borderWidth: 3,
    backgroundColor: kidsColors.accentLight + '10',
  },
  letterSlotText: {
    fontSize: kidsFontSize.xxl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.accent,
  },
  letterSlotPlaceholder: {
    fontSize: kidsFontSize.xxl,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textMuted,
  },
  removeHint: {
    fontSize: kidsFontSize.xs,
    color: kidsColors.textMuted,
    textAlign: 'center',
    marginBottom: kidsSpacing.lg,
    fontStyle: 'italic',
  },
  letterTilesContainer: {
    marginTop: kidsSpacing.md,
  },
  tilesLabel: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textSecondary,
    marginBottom: kidsSpacing.sm,
    textAlign: 'center',
  },
  letterTilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
  },
  letterTile: {
    width: 56,
    height: 56,
    borderRadius: kidsBorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...kidsShadows.button,
  },
  letterTileText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textOnDark,
  },
  wrongRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    marginTop: kidsSpacing.lg,
  },
  wrongText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
    fontWeight: kidsFontWeight.medium,
  },
});

export default WordBuildTemplate;
