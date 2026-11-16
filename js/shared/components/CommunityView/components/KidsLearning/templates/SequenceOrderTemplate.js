import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../../theme/kidsColors';
import ProgressDots from '../shared/ProgressDots';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import {SPRINGS} from '../shared/gameThemes';
import {STEP, LEVEL, sequenceOrder as guide} from '../shared/gameGuide';
import holdUntilSpoken from '../shared/holdUntilSpoken';

/**
 * SequenceOrderTemplate - Arrange items in the correct order.
 *
 * Props:
 * - config: { content: { sequences: [{ items: string[], concept: string }] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 *
 * Gameplay:
 * - Shows items in random order as tappable tiles
 * - Shows numbered slots at the top (1, 2, 3, ...)
 * - Child taps items in the correct sequence order to fill the slots
 * - Wrong tap: item shakes and the slot flashes red
 * - Correct tap: item slides into the next available slot
 *
 * Intelligence features:
 * - At the shell's easiest level: the next item glows
 * - After fast correct streak: removes number labels from slots
 * - Records concept and response time per sequence
 */
const SequenceOrderTemplate = ({config, onAnswer, onComplete, onStep, level = LEVEL.START}) => {
  const [sequences, setSequences] = useState([]);
  const [currentSeqIndex, setCurrentSeqIndex] = useState(0);
  const [shuffledItems, setShuffledItems] = useState([]);
  const [placedOrder, setPlacedOrder] = useState([]);
  const [results, setResults] = useState([]);
  const [wrongTapItem, setWrongTapItem] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Difficulty is the shell's one ladder (shared/gameGuide): at LEVEL.MIN the
  // next item glows, at LEVEL.MAX the slots lose their numbers.
  const difficulty = level <= LEVEL.MIN ? 'easy' : level >= LEVEL.MAX ? 'hard' : 'normal';
  const [wrongAttemptsForSeq, setWrongAttemptsForSeq] = useState(0);

  // Animation refs
  const containerAnim = useRef(new Animated.Value(1)).current;
  const slotAnims = useRef([]);
  const itemShakeAnims = useRef({});
  const startTimeRef = useRef(Date.now());
  const mountedRef = useRef(true);
  const completedRef = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Initialize
  useEffect(() => {
    if (config?.content?.sequences) {
      setSequences(config.content.sequences);
    }
  }, [config]);

  // Setup current sequence
  useEffect(() => {
    if (sequences.length > 0 && currentSeqIndex < sequences.length) {
      const seq = sequences[currentSeqIndex];
      const items = seq.items.map((label, idx) => ({
        id: idx,
        label,
        correctPosition: idx,
      }));
      // Shuffle for display
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      setShuffledItems(shuffled);
      setPlacedOrder([]);
      setWrongTapItem(null);
      setWrongAttemptsForSeq(0);

      // Initialize slot animations
      slotAnims.current = seq.items.map(() => new Animated.Value(1));
      // Initialize item shake animations
      itemShakeAnims.current = {};
      items.forEach(item => {
        itemShakeAnims.current[item.id] = new Animated.Value(1);
      });

      // Bounce in
      containerAnim.setValue(1);
      Animated.spring(containerAnim, {
        toValue: 1,
        ...SPRINGS.standard,
      }).start();

      startTimeRef.current = Date.now();
      if (onStep) {
        // The whole order read back is the longest line a sequence needs;
        // it is prepared while the child builds it.
        onStep({kind: STEP.ASKED, itemId: seq.concept || `sequence:${currentSeqIndex}`, say: guide.ask(seq),
                prepare: [guide.right(seq)]});
      }
    }
  }, [currentSeqIndex, sequences]);

  const shakeItem = useCallback((itemId) => {
    const anim = itemShakeAnims.current[itemId];
    if (anim) {
      Animated.sequence([
        Animated.timing(anim, {toValue: 12, duration: 50, useNativeDriver: true}),
        Animated.timing(anim, {toValue: -12, duration: 50, useNativeDriver: true}),
        Animated.timing(anim, {toValue: 12, duration: 50, useNativeDriver: true}),
        Animated.timing(anim, {toValue: 0, duration: 50, useNativeDriver: true}),
      ]).start();
    }
  }, []);

  const animateSlotFill = useCallback((slotIndex) => {
    const anim = slotAnims.current[slotIndex];
    if (anim) {
      anim.setValue(1);
      Animated.spring(anim, {
        toValue: 1,
        ...SPRINGS.playful,
      }).start();
    }
  }, []);

  const handleItemTap = useCallback((item) => {
    if (isLocked) return;

    const nextPosition = placedOrder.length;
    const seq = sequences[currentSeqIndex];

    // Is this the correct next item? Judged on the VALUE the tile shows, not
    // on the index it was built from. The Fibonacci sequence opens 1, 1, 2, so
    // two tiles read "1"; comparing correctPosition accepted one of them for
    // the first slot and shook the other, with nothing to tell them apart.
    if (String(seq?.items?.[nextPosition]) === String(item.label)) {
      // Correct tap
      setIsLocked(true);
      animateSlotFill(nextPosition);

      const newPlaced = [...placedOrder, item];
      setPlacedOrder(newPlaced);
      setWrongTapItem(null);

      // Check if sequence is complete
      if (newPlaced.length === seq.items.length) {
        const responseTimeMs = Date.now() - startTimeRef.current;
        const concept = seq.concept || `sequence:${currentSeqIndex}`;

        const spoken = onStep
          ? onStep({kind: STEP.RIGHT, itemId: concept, concept, say: guide.right(seq)}) : undefined;
        setResults(prev => [...prev, true]);

        // Guided, the finished order stays on screen while the voice reads it
        // back; the overlay covered it and moved on first.  Unguided keeps it.
        setFeedbackCorrect(true);
        setFeedbackMessage(responseTimeMs < 5000 ? 'Super fast ordering!' : 'Perfect sequence!');
        if (onStep) {
          holdUntilSpoken(spoken, () => advanceRef.current(), () => mountedRef.current);
        } else {
          setShowFeedback(true);
        }

        if (onAnswer) {
          onAnswer(true, concept, responseTimeMs);
        }
      } else {
        if (onStep) {
          onStep({kind: STEP.ASKED, itemId: seq.concept || `sequence:${currentSeqIndex}`,
                  say: guide.next(item.label)});
        }
        setIsLocked(false);
      }
    } else {
      // Wrong tap
      if (onStep) {
        onStep({kind: STEP.WRONG, itemId: seq.concept || `sequence:${currentSeqIndex}`,
                chosen: item.label, wanted: seq?.items?.[nextPosition],
                say: guide.explainMiss(item.label, seq, nextPosition)});
      }
      shakeItem(item.id);
      setWrongTapItem(item.id);
      setWrongAttemptsForSeq(prev => prev + 1);

      // Record wrong answer for this attempt (but don't advance)
      const responseTimeMs = Date.now() - startTimeRef.current;
      const concept = seq.concept || `sequence:${currentSeqIndex}`;

      setResults(prev => [...prev, false]);

      if (onAnswer) {
        onAnswer(false, concept, responseTimeMs);
      }

      // Clear wrong indicator after delay
      setTimeout(() => {
        if (mountedRef.current) setWrongTapItem(null);
      }, 600);
    }
  }, [isLocked, placedOrder, sequences, currentSeqIndex, animateSlotFill, shakeItem, onAnswer, onStep]);

  const advanceRef = useRef(null);
  const handleFeedbackDismiss = useCallback(() => {
    setShowFeedback(false);
    setIsLocked(false);

    if (currentSeqIndex + 1 >= sequences.length) {
      if (completedRef.current) return;
      completedRef.current = true;
      if (onComplete) onComplete();
    } else {
      setCurrentSeqIndex(prev => prev + 1);
    }
  }, [currentSeqIndex, sequences, onComplete]);
  advanceRef.current = handleFeedbackDismiss;

  // Get the next correct item hint (for easy mode)
  const getHintItemId = useCallback(() => {
    if (difficulty !== 'easy') return null;
    const nextPos = placedOrder.length;
    // Any unplaced tile showing the value the next slot wants - so the hint
    // never points at a tile that has already been used for an equal one.
    const wanted = sequences[currentSeqIndex]?.items?.[nextPos];
    const hintItem = shuffledItems.find(
      item =>
        String(item.label) === String(wanted) && !placedOrder.includes(item),
    );
    return hintItem?.id ?? null;
  }, [difficulty, placedOrder, shuffledItems, sequences, currentSeqIndex]);

  const hintItemId = getHintItemId();

  // --- Render ---
  if (sequences.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading sequences...</Text>
      </View>
    );
  }

  if (currentSeqIndex >= sequences.length) {
    return null;
  }

  const currentSeq = sequences[currentSeqIndex];
  const totalSlots = currentSeq.items.length;
  const containerScale = containerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });
  const showSlotNumbers = difficulty !== 'hard';

  return (
    <View style={styles.container}>
      {/* Sequence progress */}
      <ProgressDots
        total={sequences.length}
        current={currentSeqIndex}
        results={results.filter((_, i) => {
          // Only count results that were sequence completions (true values)
          // This is approximate - we track per-sequence in the results
          return results[i] === true;
        }).slice(0, currentSeqIndex)}
      />

      {/* Adaptive mode indicator */}
      {difficulty === 'easy' && (
        <View style={styles.adaptiveBanner}>
          <Icon name="lightbulb-on-outline" size={16} color={kidsColors.star} />
          <Text style={styles.adaptiveText}>Look for the glowing item!</Text>
        </View>
      )}
      {difficulty === 'hard' && (
        <View style={[styles.adaptiveBanner, {backgroundColor: kidsColors.accentLight + '20'}]}>
          <Icon name="fire" size={16} color={kidsColors.streak} />
          <Text style={[styles.adaptiveText, {color: kidsColors.streak}]}>No numbers, you got this!</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Instructions */}
        <View style={styles.instructionRow}>
          <Icon name="sort-ascending" size={20} color={kidsColors.accent} />
          <Text style={styles.instructionText}>Tap items in the correct order</Text>
        </View>

        {/* Numbered Slots */}
        <Animated.View
          style={[
            styles.slotsContainer,
            {transform: [{scale: containerScale}], opacity: containerAnim},
          ]}
        >
          <Text style={styles.slotsLabel}>Order:</Text>
          <View style={styles.slotsRow}>
            {Array.from({length: totalSlots}, (_, slotIdx) => {
              const filled = slotIdx < placedOrder.length;
              const filledItem = filled ? placedOrder[slotIdx] : null;
              const slotAnim = slotAnims.current[slotIdx] || new Animated.Value(1);
              const slotScale = slotAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              });

              return (
                <View key={`slot-${slotIdx}`} style={styles.slotWrapper}>
                  <View
                    style={[
                      styles.slot,
                      filled && styles.slotFilled,
                      slotIdx === placedOrder.length && styles.slotNext,
                    ]}
                  >
                    {showSlotNumbers && !filled && (
                      <Text style={styles.slotNumber}>{slotIdx + 1}</Text>
                    )}
                    {filled && (
                      <Animated.View style={{transform: [{scale: slotScale}]}}>
                        <Text style={styles.slotFilledText} numberOfLines={1}>
                          {filledItem.label}
                        </Text>
                      </Animated.View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Shuffled Items */}
        <View style={styles.itemsContainer}>
          <Text style={styles.itemsLabel}>Tap next:</Text>
          <View style={styles.itemsGrid}>
            {shuffledItems.map((item, idx) => {
              const isPlaced = placedOrder.some(p => p.id === item.id);
              const isWrong = wrongTapItem === item.id;
              const isHinted = hintItemId === item.id;
              const shake = itemShakeAnims.current[item.id] || new Animated.Value(1);
              const color = kidsColors.palette[idx % kidsColors.palette.length];

              if (isPlaced) {
                return (
                  <View key={`item-${item.id}`} style={[styles.itemTile, styles.itemTilePlaced]}>
                    <Icon name="check" size={24} color={kidsColors.correct} />
                  </View>
                );
              }

              return (
                <Animated.View
                  key={`item-${item.id}`}
                  style={{transform: [{translateX: shake}]}}
                >
                  <TouchableOpacity
                    style={[
                      styles.itemTile,
                      {borderColor: color, backgroundColor: kidsColors.card},
                      isWrong && styles.itemTileWrong,
                      isHinted && styles.itemTileHinted,
                    ]}
                    onPress={() => handleItemTap(item)}
                    disabled={isPlaced || isLocked}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.itemTileText,
                        isWrong && {color: kidsColors.incorrect},
                      ]}
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                    {isHinted && (
                      <Icon name="star-four-points" size={14} color={kidsColors.star} style={styles.hintStar} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </View>

        {/* Wrong attempts counter */}
        {wrongAttemptsForSeq > 0 && (
          <View style={styles.attemptsRow}>
            <Icon name="refresh" size={16} color={kidsColors.textMuted} />
            <Text style={styles.attemptsText}>
              {wrongAttemptsForSeq} wrong {wrongAttemptsForSeq === 1 ? 'tap' : 'taps'} - keep trying!
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
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.lg,
  },
  instructionText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textSecondary,
  },
  slotsContainer: {
    marginBottom: kidsSpacing.xl,
  },
  slotsLabel: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textSecondary,
    marginBottom: kidsSpacing.sm,
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: kidsSpacing.sm,
  },
  slotWrapper: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  slot: {
    minHeight: 52,
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: kidsColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.sm,
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: kidsColors.correct,
    backgroundColor: kidsColors.correctLight,
  },
  slotNext: {
    borderColor: kidsColors.accent,
    borderWidth: 3,
  },
  slotNumber: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textMuted,
  },
  slotFilledText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.correct,
    textAlign: 'center',
  },
  itemsContainer: {
    marginBottom: kidsSpacing.lg,
  },
  itemsLabel: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textSecondary,
    marginBottom: kidsSpacing.sm,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: kidsSpacing.sm,
  },
  itemTile: {
    minWidth: 100,
    minHeight: 56,
    borderRadius: kidsBorderRadius.md,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.md,
    flexGrow: 1,
    flexBasis: '40%',
    ...kidsShadows.card,
  },
  itemTilePlaced: {
    backgroundColor: kidsColors.correctLight,
    borderColor: kidsColors.correct,
    borderStyle: 'solid',
  },
  itemTileWrong: {
    borderColor: kidsColors.incorrect,
    backgroundColor: kidsColors.incorrectLight,
  },
  itemTileHinted: {
    borderColor: kidsColors.star,
    borderWidth: 3,
    backgroundColor: kidsColors.star + '12',
  },
  itemTileText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
  },
  hintStar: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  attemptsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    marginTop: kidsSpacing.sm,
  },
  attemptsText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
    fontWeight: kidsFontWeight.medium,
  },
});

export default SequenceOrderTemplate;
