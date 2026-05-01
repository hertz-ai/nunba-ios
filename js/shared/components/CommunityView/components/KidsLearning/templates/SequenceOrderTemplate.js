import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../../theme/kidsColors';
import ProgressDots from '../shared/ProgressDots';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import {SPRINGS} from '../shared/gameThemes';

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
 * - After 3+ consecutive wrong: shows the first unhinted item with a glow
 * - After fast correct streak: removes number labels from slots
 * - Records concept and response time per sequence
 */
const SequenceOrderTemplate = ({config, onAnswer, onComplete}) => {
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

  // Adaptive difficulty state
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [adaptiveMode, setAdaptiveMode] = useState('normal');
  const [wrongAttemptsForSeq, setWrongAttemptsForSeq] = useState(0);

  // Animation refs
  const containerAnim = useRef(new Animated.Value(0)).current;
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
      slotAnims.current = seq.items.map(() => new Animated.Value(0));
      // Initialize item shake animations
      itemShakeAnims.current = {};
      items.forEach(item => {
        itemShakeAnims.current[item.id] = new Animated.Value(0);
      });

      // Bounce in
      containerAnim.setValue(0);
      Animated.spring(containerAnim, {
        toValue: 1,
        ...SPRINGS.standard,
      }).start();

      startTimeRef.current = Date.now();
    }
  }, [currentSeqIndex, sequences]);

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
      anim.setValue(0);
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

    // Is this the correct next item?
    if (item.correctPosition === nextPosition) {
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

        setConsecutiveWrong(0);
        setConsecutiveCorrect(prev => prev + 1);
        setResults(prev => [...prev, true]);

        setFeedbackCorrect(true);
        setFeedbackMessage(responseTimeMs < 5000 ? 'Super fast ordering!' : 'Perfect sequence!');
        setShowFeedback(true);

        if (onAnswer) {
          onAnswer(true, concept, responseTimeMs);
        }
      } else {
        setIsLocked(false);
      }
    } else {
      // Wrong tap
      shakeItem(item.id);
      setWrongTapItem(item.id);
      setWrongAttemptsForSeq(prev => prev + 1);
      setConsecutiveCorrect(0);
      setConsecutiveWrong(prev => prev + 1);

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
  }, [isLocked, placedOrder, sequences, currentSeqIndex, animateSlotFill, shakeItem, onAnswer]);

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

  // Get the next correct item hint (for easy mode)
  const getHintItemId = useCallback(() => {
    if (adaptiveMode !== 'easy') return null;
    const nextPos = placedOrder.length;
    const hintItem = shuffledItems.find(
      item => item.correctPosition === nextPos && !placedOrder.includes(item),
    );
    return hintItem?.id ?? null;
  }, [adaptiveMode, placedOrder, shuffledItems]);

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
  const showSlotNumbers = adaptiveMode !== 'hard';

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
      {adaptiveMode === 'easy' && (
        <View style={styles.adaptiveBanner}>
          <Icon name="lightbulb-on-outline" size={16} color={kidsColors.star} />
          <Text style={styles.adaptiveText}>Look for the glowing item!</Text>
        </View>
      )}
      {adaptiveMode === 'hard' && (
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
              const slotAnim = slotAnims.current[slotIdx] || new Animated.Value(0);
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
              const shake = itemShakeAnims.current[item.id] || new Animated.Value(0);
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
