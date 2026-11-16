import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ScrollView,
} from 'react-native';
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
import ProgressDots from '../shared/ProgressDots';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import TimerBar from '../shared/TimerBar';
import {SPRINGS} from '../shared/gameThemes';
import {STEP, LEVEL, puzzleAssemble as guide} from '../shared/gameGuide';
import holdUntilSpoken from '../shared/holdUntilSpoken';

/**
 * PuzzleAssembleTemplate - Drag/tap puzzle pieces to correct positions.
 *
 * Shows labeled empty slots and puzzle pieces. Child taps a piece then taps
 * a slot to place it. Green glow for correct placement. Tracks time and
 * correctness. At the shell's lowest level an arrow shows where the chosen
 * piece goes; the agent says what each numbered slot is for.
 *
 * Props:
 * - config: { content: { puzzles: [...] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 */
const PuzzleAssembleTemplate = ({config, onAnswer, onComplete, onStep, level = LEVEL.START}) => {
  const content = config?.content || {};
  const puzzles = content.puzzles || [];

  // Game state
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [placedPieces, setPlacedPieces] = useState({}); // { slotIndex: pieceId }
  const [correctSlots, setCorrectSlots] = useState(new Set());
  const [incorrectSlot, setIncorrectSlot] = useState(null);
  const [puzzleComplete, setPuzzleComplete] = useState(false);
  const [allComplete, setAllComplete] = useState(false);
  const [results, setResults] = useState([]); // [true, false, ...]
  // The shell's one ladder (shared/gameGuide): at LEVEL.MIN the chosen
  // piece's slot is marked.  This template's own three-misses rule is gone.
  const showHint = level <= LEVEL.MIN && selectedPiece != null;
  const hintPieceId = showHint ? selectedPiece : null;

  const puzzleStartTime = useRef(Date.now());
  const moveStartTime = useRef(Date.now());
  const totalMistakes = useRef(0);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Animations
  const slotGlowAnims = useRef({});
  const pieceScaleAnims = useRef({});
  const completionAnim = useRef(new Animated.Value(1)).current;
  const titleAnim = useRef(new Animated.Value(1)).current;

  const currentPuzzle = puzzles[currentPuzzleIndex] || null;

  // Each piece names the slot it belongs in, via correctPosition. No shipped
  // puzzle authors one -- the key appears nowhere in gameConfigs.js -- so
  // `piece.correctPosition === slotIndex` compared undefined against a number
  // and was false for EVERY tap: no piece could be placed, every placement was
  // scored wrong, and all five puzzle games were unwinnable for a real child.
  //
  // Fall back to the authored order, the convention SequenceOrderTemplate
  // already uses for exactly this. A puzzle that does name its positions keeps
  // them, so this fills a gap rather than overriding intent.
  const pieces = useMemo(() => (
    (currentPuzzle?.pieces || []).map((piece, idx) => (
      typeof piece.correctPosition === 'number'
        ? piece
        : {...piece, correctPosition: idx}
    ))
  ), [currentPuzzle]);

  const totalSlots = pieces.length;

  // Initialize animations for pieces
  useEffect(() => {
    if (pieces.length > 0) {
      pieces.forEach(piece => {
        if (!pieceScaleAnims.current[piece.id]) {
          pieceScaleAnims.current[piece.id] = new Animated.Value(1);
        }
      });
      for (let i = 0; i < totalSlots; i++) {
        if (!slotGlowAnims.current[i]) {
          slotGlowAnims.current[i] = new Animated.Value(1);
        }
      }
    }
  }, [currentPuzzleIndex]);

  // Title animation on puzzle load
  useEffect(() => {
    titleAnim.setValue(1);
    Animated.spring(titleAnim, {
      toValue: 1,
      ...SPRINGS.playful,
    }).start();
    puzzleStartTime.current = Date.now();
    moveStartTime.current = Date.now();
    setPlacedPieces({});
    setCorrectSlots(new Set());
    setSelectedPiece(null);
    setPuzzleComplete(false);
    setIncorrectSlot(null);
    totalMistakes.current = 0;
    if (onStep && currentPuzzle) {
      onStep({kind: STEP.ASKED, itemId: currentPuzzle.concept || currentPuzzle.title,
        say: guide.ask(currentPuzzle, pieces)});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPuzzleIndex]);

  // Check puzzle completion.
  //
  // Not on the render a new puzzle arrives in: the reset above only queues
  // correctSlots = {}, so this effect still sees the LAST puzzle's full set in
  // that commit, and a next puzzle with as many pieces opened already marked
  // "Puzzle Complete!" with its slots empty - every puzzle after the first
  // could be skipped.  The following render, with the slots reset, checks.
  const checkedPuzzleRef = useRef(currentPuzzleIndex);
  useEffect(() => {
    if (checkedPuzzleRef.current !== currentPuzzleIndex) {
      checkedPuzzleRef.current = currentPuzzleIndex;
      return;
    }
    if (
      currentPuzzle &&
      correctSlots.size === totalSlots &&
      totalSlots > 0
    ) {
      setPuzzleComplete(true);
      Animated.spring(completionAnim, {
        toValue: 1,
        ...SPRINGS.bouncy,
      }).start();
    }
  }, [correctSlots, totalSlots, currentPuzzle, currentPuzzleIndex]);

  // Get available (unplaced) pieces
  const getAvailablePieces = useCallback(() => {
    const placedIds = new Set(Object.values(placedPieces));
    return pieces.filter(p => !placedIds.has(p.id));
  }, [pieces, placedPieces]);

  // Handle piece selection
  const handleSelectPiece = useCallback(
    pieceId => {
      if (puzzleComplete) return;

      if (selectedPiece === pieceId) {
        setSelectedPiece(null);
        return;
      }
      setSelectedPiece(pieceId);
      moveStartTime.current = Date.now();

      // Animate piece bounce
      const anim = pieceScaleAnims.current[pieceId];
      if (anim) {
        Animated.sequence([
          Animated.spring(anim, {
            toValue: 1.15,
            ...SPRINGS.quick,
          }),
          Animated.spring(anim, {
            toValue: 1.05,
            ...SPRINGS.playful,
          }),
        ]).start();
      }
    },
    [selectedPiece, puzzleComplete],
  );

  // Handle slot tap
  const handleSlotTap = useCallback(
    slotIndex => {
      if (!selectedPiece || puzzleComplete) return;
      if (correctSlots.has(slotIndex)) return; // Already correctly filled

      const responseTimeMs = Date.now() - moveStartTime.current;
      const piece = pieces.find(p => p.id === selectedPiece);
      if (!piece) return;

      const isCorrect = piece.correctPosition === slotIndex;

      if (isCorrect) {
        // Place piece correctly
        setPlacedPieces(prev => ({...prev, [slotIndex]: piece.id}));
        setCorrectSlots(prev => new Set([...prev, slotIndex]));
        setSelectedPiece(null);
        if (onStep) {
          const filled = new Set([...correctSlots, slotIndex]);
          const spoken = onStep({kind: STEP.RIGHT, itemId: piece.id, concept: currentPuzzle.concept,
            say: filled.size >= totalSlots
              ? guide.done(currentPuzzle, pieces)
              : guide.right(piece, guide.next(pieces, filled))});
          // Guided, a finished picture moves on once the voice has said what
          // it shows; no "Next" tap is needed (the button stays).
          if (filled.size >= totalSlots) {
            const index = currentPuzzleIndex;
            holdUntilSpoken(spoken, () => {
              if (indexRef.current === index) nextRef.current();
            }, () => mountedRef.current);
          }
        }

        // Animate green glow
        const glowAnim = slotGlowAnims.current[slotIndex];
        if (glowAnim) {
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: false,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.4,
              duration: 500,
              useNativeDriver: false,
            }),
          ]).start();
        }

        // Reset piece scale
        const pieceAnim = pieceScaleAnims.current[piece.id];
        if (pieceAnim) {
          Animated.spring(pieceAnim, {
            toValue: 1,
            ...SPRINGS.playful,
          }).start();
        }

        if (onAnswer) {
          onAnswer(true, currentPuzzle.concept, responseTimeMs);
        }
      } else {
        // Wrong placement
        setIncorrectSlot(slotIndex);
        totalMistakes.current += 1;
        if (onStep) {
          const wanted = pieces.find((p) => p.correctPosition === slotIndex);
          onStep({kind: STEP.WRONG, itemId: piece.id, chosen: piece.label, wanted: wanted && wanted.label,
            say: guide.explainMiss(piece, pieces, slotIndex)});
        }

        // Shake the slot
        setTimeout(() => {
          if (mountedRef.current) setIncorrectSlot(null);
        }, 500);

        if (onAnswer) {
          onAnswer(false, currentPuzzle.concept, responseTimeMs);
        }
      }
    },
    [selectedPiece, puzzleComplete, correctSlots, pieces, currentPuzzle, onAnswer, onStep, totalSlots],
  );

  // Next puzzle or complete
  const handleNext = useCallback(() => {
    const puzzleTime = Date.now() - puzzleStartTime.current;
    const wasGood = totalMistakes.current <= 2;
    setResults(prev => [...prev, wasGood]);

    if (currentPuzzleIndex + 1 < puzzles.length) {
      completionAnim.setValue(1);
      setCurrentPuzzleIndex(prev => prev + 1);
    } else {
      setAllComplete(true);
    }
  }, [currentPuzzleIndex, puzzles.length]);

  // Finish game
  const handleFinish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);
  const nextRef = useRef(null);
  nextRef.current = handleNext;
  const indexRef = useRef(0);
  indexRef.current = currentPuzzleIndex;

  // Guided, the summary is shown long enough to see, then the shell's own
  // completion screen takes over; no "Finish" tap is needed (it stays).
  useEffect(() => {
    if (!allComplete || !onStep) return;
    holdUntilSpoken(undefined, handleFinish, () => mountedRef.current);
  }, [allComplete]);   // eslint-disable-line react-hooks/exhaustive-deps

  // All puzzles completed screen
  if (allComplete) {
    const perfect = results.filter(Boolean).length;
    return (
      <View style={styles.container}>
        <View style={styles.completeContainer}>
          <Icon name="puzzle-check" size={80} color={kidsColors.correct} />
          <Text style={styles.completeTitle}>All Puzzles Done!</Text>
          <Text style={styles.completeSubtitle}>
            {perfect} of {puzzles.length} puzzles solved cleanly
          </Text>
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

  if (!currentPuzzle) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No puzzle data available.</Text>
      </View>
    );
  }

  const availablePieces = getAvailablePieces();
  const titleScale = titleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <View style={styles.container}>
      {/* Progress */}
      <ProgressDots
        total={puzzles.length}
        current={currentPuzzleIndex}
        results={results}
      />

      {/* Title */}
      <Animated.View
        style={[styles.titleRow, {transform: [{scale: titleScale}]}]}>
        <Icon name="puzzle" size={28} color={kidsColors.accent} />
        <Text style={styles.title}>{currentPuzzle.title}</Text>
      </Animated.View>

      {/* Hint banner */}
      {showHint && (
        <View style={styles.hintBanner}>
          <Icon name="lightbulb-on" size={18} color={kidsColors.star} />
          <Text style={styles.hintText}>
            Hint: the arrow shows where your piece goes!
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}>
        {/* Slots Area */}
        <Text style={styles.sectionLabel}>Place pieces here:</Text>
        <View style={styles.slotsContainer}>
          {Array.from({length: totalSlots}, (_, slotIndex) => {
            const placedPieceId = placedPieces[slotIndex];
            const placedPiece = placedPieceId
              ? pieces.find(p => p.id === placedPieceId)
              : null;
            const isCorrectlyFilled = correctSlots.has(slotIndex);
            const isIncorrect = incorrectSlot === slotIndex;
            const isHinted =
              showHint &&
              hintPieceId &&
              pieces.find(p => p.id === hintPieceId)?.correctPosition ===
                slotIndex;

            const glowAnim = slotGlowAnims.current[slotIndex];
            const glowColor = glowAnim
              ? glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['transparent', kidsColors.correct],
                })
              : 'transparent';

            return (
              <TouchableOpacity
                key={slotIndex}
                style={[
                  styles.slot,
                  isCorrectlyFilled && styles.slotCorrect,
                  isIncorrect && styles.slotIncorrect,
                  isHinted && styles.slotHinted,
                ]}
                onPress={() => handleSlotTap(slotIndex)}
                disabled={isCorrectlyFilled}
                activeOpacity={0.7}>
                {glowAnim && (
                  <Animated.View
                    style={[
                      styles.slotGlow,
                      {borderColor: glowColor},
                    ]}
                  />
                )}
                <Text style={styles.slotNumber}>{slotIndex + 1}</Text>
                {isCorrectlyFilled && placedPiece ? (
                  <View style={styles.slotContent}>
                    <Icon
                      name={placedPiece.icon || 'puzzle'}
                      size={28}
                      color={kidsColors.textOnDark}
                    />
                    <Text style={styles.slotContentText}>
                      {placedPiece.label}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.slotEmpty}>
                    <Icon
                      name="help-circle-outline"
                      size={28}
                      color={kidsColors.textMuted}
                    />
                    <Text style={styles.slotEmptyText}>Tap to place</Text>
                  </View>
                )}
                {isHinted && (
                  <View style={styles.hintGlow}>
                    <Icon
                      name="arrow-down-bold"
                      size={18}
                      color={kidsColors.star}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Pieces Area */}
        {!puzzleComplete && (
          <>
            <Text style={[styles.sectionLabel, {marginTop: kidsSpacing.lg}]}>
              Available pieces:
            </Text>
            <View style={styles.piecesContainer}>
              {availablePieces.map(piece => {
                const isSelected = selectedPiece === piece.id;
                const scaleAnim =
                  pieceScaleAnims.current[piece.id] || new Animated.Value(1);

                return (
                  <Animated.View
                    key={piece.id}
                    style={{transform: [{scale: scaleAnim}]}}>
                    <TouchableOpacity
                      style={[
                        styles.piece,
                        isSelected && styles.pieceSelected,
                      ]}
                      onPress={() => handleSelectPiece(piece.id)}
                      activeOpacity={0.7}>
                      <Icon
                        name={piece.icon || 'puzzle'}
                        size={32}
                        color={
                          isSelected
                            ? kidsColors.textOnDark
                            : kidsColors.accent
                        }
                      />
                      <Text
                        style={[
                          styles.pieceLabel,
                          isSelected && styles.pieceLabelSelected,
                        ]}>
                        {piece.label}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </>
        )}

        {/* Puzzle Complete Banner */}
        {puzzleComplete && (
          <Animated.View
            style={[
              styles.completeBanner,
              {
                transform: [
                  {
                    scale: completionAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
                opacity: completionAnim,
              },
            ]}>
            <Icon name="check-decagram" size={48} color={kidsColors.correct} />
            <Text style={styles.completeBannerText}>Puzzle Complete!</Text>
            {totalMistakes.current === 0 && (
              <Text style={styles.perfectText}>Perfect - No mistakes!</Text>
            )}
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              activeOpacity={0.8}>
              <Text style={styles.nextButtonText}>
                {currentPuzzleIndex + 1 < puzzles.length
                  ? 'Next Puzzle'
                  : 'Finish'}
              </Text>
              <Icon
                name="arrow-right"
                size={22}
                color={kidsColors.textOnDark}
              />
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
    paddingTop: kidsSpacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    paddingVertical: kidsSpacing.md,
  },
  title: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textPrimary,
  },
  sectionLabel: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textSecondary,
    marginHorizontal: kidsSpacing.lg,
    marginBottom: kidsSpacing.sm,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: kidsSpacing.xxl,
  },
  // Hint
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
    marginBottom: kidsSpacing.sm,
  },
  hintText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
    flex: 1,
  },
  // Slots
  slotsContainer: {
    paddingHorizontal: kidsSpacing.lg,
    gap: kidsSpacing.md,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.lg,
    padding: kidsSpacing.md,
    minHeight: 64,
    borderWidth: 2,
    borderColor: kidsColors.border,
    borderStyle: 'dashed',
    ...kidsShadows.card,
    overflow: 'hidden',
  },
  slotCorrect: {
    borderColor: kidsColors.correct,
    borderStyle: 'solid',
    backgroundColor: kidsColors.correctLight,
  },
  slotIncorrect: {
    borderColor: kidsColors.incorrect,
    borderStyle: 'solid',
    backgroundColor: kidsColors.incorrectLight,
  },
  slotHinted: {
    borderColor: kidsColors.star,
    borderStyle: 'solid',
    backgroundColor: kidsColors.hintBg,
  },
  slotGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: kidsBorderRadius.lg,
  },
  slotNumber: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.accent,
    width: 32,
    textAlign: 'center',
  },
  slotContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    marginLeft: kidsSpacing.sm,
  },
  slotContentText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.correct,
  },
  slotEmpty: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    marginLeft: kidsSpacing.sm,
  },
  slotEmptyText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
  },
  hintGlow: {
    position: 'absolute',
    right: kidsSpacing.md,
    top: kidsSpacing.sm,
  },
  // Pieces
  piecesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.lg,
    justifyContent: 'center',
  },
  piece: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.md,
    minWidth: 100,
    minHeight: 80,
    borderWidth: 2,
    borderColor: kidsColors.border,
    ...kidsShadows.card,
  },
  pieceSelected: {
    backgroundColor: kidsColors.accent,
    borderColor: kidsColors.accent,
    ...kidsShadows.button,
  },
  pieceLabel: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textPrimary,
    marginTop: kidsSpacing.xs,
  },
  pieceLabelSelected: {
    color: kidsColors.textOnDark,
  },
  // Complete banner
  completeBanner: {
    alignItems: 'center',
    backgroundColor: kidsColors.correctLight,
    marginHorizontal: kidsSpacing.lg,
    marginTop: kidsSpacing.xl,
    padding: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.xl,
    ...kidsShadows.float,
  },
  completeBannerText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.correct,
    marginTop: kidsSpacing.sm,
  },
  perfectText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.correct,
    marginTop: kidsSpacing.xs,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.accent,
    paddingVertical: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.xl,
    gap: kidsSpacing.sm,
    marginTop: kidsSpacing.lg,
    ...kidsShadows.button,
  },
  nextButtonText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
  // Final complete
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kidsSpacing.xl,
  },
  completeTitle: {
    fontSize: kidsFontSize.display,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.correct,
    marginTop: kidsSpacing.md,
  },
  completeSubtitle: {
    fontSize: kidsFontSize.lg,
    color: kidsColors.textSecondary,
    marginTop: kidsSpacing.sm,
    marginBottom: kidsSpacing.xl,
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
  errorText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textSecondary,
    textAlign: 'center',
    marginTop: kidsSpacing.xxl,
  },
});

export default PuzzleAssembleTemplate;
