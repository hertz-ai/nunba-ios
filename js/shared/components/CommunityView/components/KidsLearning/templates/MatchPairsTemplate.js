import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../../theme/kidsColors';
import GameLivesBar from '../shared/GameLivesBar';
import KidsCharacter from '../shared/KidsCharacter';
import VisualHint from '../shared/VisualHint';
import {getEmojiForText} from '../shared/emojiMap';

/**
 * The picture above a match card's word, when there is one.
 *
 * Many of these words have no picture. The emoji map holds 209 entries and the
 * match games use 276 labels between them, so 176 of those labels -- "1/2",
 * "half of a whole", brave, furious, France, Percussion -- fell through to a
 * fallback black square, and most of them have no sensible picture to add. On a child's matching board that reads as a broken tile, not
 * as "no picture for this one", and it sat directly beside words that did have
 * one, which made those items look like they had failed to load.
 *
 * The band keeps its height whether or not a picture is found, so both columns
 * stay aligned exactly as they were; only the meaningless square goes.
 */
function MatchGlyph({label}) {
  const emoji = getEmojiForText(label);
  return (
    <Text
      style={{
        fontSize: 32,
        lineHeight: 38,
        height: 38,
        textAlign: 'center',
        marginBottom: 4,
      }}>
      {emoji || ''}
    </Text>
  );
}
import FeedbackOverlay from '../shared/FeedbackOverlay';
import usePressAnimation from '../../../../../hooks/usePressAnimation';
import {STEP, LEVEL, matchPairs as guide} from '../shared/gameGuide';
import holdUntilSpoken from '../shared/holdUntilSpoken';
import {SPRINGS} from '../shared/gameThemes';

/**
 * MatchPairsTemplate - Match items between two columns.
 *
 * Props:
 * - config: { content: { pairs: [{ left, right, concept }] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 *
 * Gameplay:
 * - Two columns: left items and right items (both shuffled independently)
 * - Tap a left item, then tap a right item to attempt a match
 * - Correct match: both items fade out with green glow
 * - Wrong match: both items shake with red flash
 *
 * Intelligence features:
 * - Tracks response time per match attempt
 * - At the shell's easiest level: the partner of the picked card is highlighted
 * - After fast correct streak: adds visual complexity (no color coding)
 * - Records concept per matched pair
 */
// How many answers in a row were right, for the lives bar's streak.
const trailingRight = (results) => {
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i]; i--) n++;
  return n;
};

const MatchPairsTemplate = ({config, onAnswer, onComplete, onStep, level = LEVEL.START}) => {
  const {onPressIn: pressIn, onPressOut: pressOut, animatedStyle: pressStyle} = usePressAnimation(0.96);
  const [pairs, setPairs] = useState([]);
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [selectedRight, setSelectedRight] = useState(null);
  // Two sets, not one: a card clears on its OWN side. Several decks put the
  // same word on two cards -- three of the instrument answers read "Strings",
  // three "Percussion", and the seasons deck asks "Spring" twice -- so the left
  // card a child taps and the right card they pair it with need not share an
  // index, and clearing both sides by one id wiped two cards untouched.
  const [matchedLeft, setMatchedLeft] = useState(new Set());
  const [matchedRight, setMatchedRight] = useState(new Set());
  const [results, setResults] = useState([]);
  const [isLocked, setIsLocked] = useState(false);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Difficulty is the shell's one ladder (shared/gameGuide): at LEVEL.MIN the
  // partner of the card you picked is highlighted.  Own ladder removed.
  const difficulty = level <= LEVEL.MIN ? 'easy' : level >= LEVEL.MAX ? 'hard' : 'normal';

  // New visual overhaul state
  const [lives, setLives] = useState(3);
  const [charState, setCharState] = useState('idle');
  const [showVisualHint, setShowVisualHint] = useState(true);

  // Animation refs
  const containerAnim = useRef(new Animated.Value(1)).current;
  const shakeAnims = useRef({});
  const fadeAnims = useRef({});
  const dimOpacityValue = useRef(new Animated.Value(0.4)).current;
  const startTimeRef = useRef(Date.now());
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Initialize animations for each pair
  const getShakeAnim = useCallback((id) => {
    if (!shakeAnims.current[id]) {
      shakeAnims.current[id] = new Animated.Value(1);
    }
    return shakeAnims.current[id];
  }, []);

  const getFadeAnim = useCallback((id) => {
    if (!fadeAnims.current[id]) {
      fadeAnims.current[id] = new Animated.Value(1);
    }
    return fadeAnims.current[id];
  }, []);

  // Shuffle and initialize on mount
  useEffect(() => {
    if (config?.content?.pairs) {
      const configPairs = config.content.pairs.map((p, i) => ({...p, id: i}));
      setPairs(configPairs);

      // Shuffle left and right independently
      const left = configPairs
        .map(p => ({id: p.id, label: p.left}))
        .sort(() => Math.random() - 0.5);
      const right = configPairs
        .map(p => ({id: p.id, label: p.right}))
        .sort(() => Math.random() - 0.5);

      setLeftItems(left);
      setRightItems(right);

      // Initialize animation values
      configPairs.forEach(p => {
        shakeAnims.current[`left-${p.id}`] = new Animated.Value(1);
        shakeAnims.current[`right-${p.id}`] = new Animated.Value(1);
        fadeAnims.current[`left-${p.id}`] = new Animated.Value(1);
        fadeAnims.current[`right-${p.id}`] = new Animated.Value(1);
      });

      Animated.spring(containerAnim, {
        toValue: 1,
        ...SPRINGS.standard,
      }).start();

      startTimeRef.current = Date.now();
      // Each pair's line is prepared up front, so a match is named at once.
      if (onStep) {
        onStep({kind: STEP.ASKED, itemId: `match:${config.id || 'deck'}`, say: guide.ask(),
                prepare: (config?.content?.pairs || []).map((p) => guide.right(p.left, p.right))});
      }
    }
  }, [config]);

  const triggerShake = useCallback((leftId, rightId) => {
    const leftKey = `left-${leftId}`;
    const rightKey = `right-${rightId}`;
    const leftShake = shakeAnims.current[leftKey];
    const rightShake = shakeAnims.current[rightKey];

    if (leftShake && rightShake) {
      const shakeSequence = (anim) =>
        Animated.sequence([
          Animated.timing(anim, {toValue: 10, duration: 50, useNativeDriver: true}),
          Animated.timing(anim, {toValue: -10, duration: 50, useNativeDriver: true}),
          Animated.timing(anim, {toValue: 10, duration: 50, useNativeDriver: true}),
          Animated.timing(anim, {toValue: -10, duration: 50, useNativeDriver: true}),
          Animated.timing(anim, {toValue: 0, duration: 50, useNativeDriver: true}),
        ]);

      Animated.parallel([shakeSequence(leftShake), shakeSequence(rightShake)]).start();
    }
  }, []);

  // Takes both ids because the two cards being cleared can come from different
  // pairs whenever a deck repeats a label; fading `left-${id}` and
  // `right-${id}` together faded a right card that is still in play.
  const triggerFadeOut = useCallback((leftId, rightId) => {
    const fades = [
      fadeAnims.current[`left-${leftId}`],
      fadeAnims.current[`right-${rightId}`],
    ]
      .filter(Boolean)
      .map((anim) =>
        Animated.timing(anim, {toValue: 0.2, duration: 400, useNativeDriver: true}),
      );

    if (fades.length) {
      Animated.parallel(fades).start();
    }
  }, []);

  const handleLeftSelect = useCallback((item) => {
    if (isLocked || matchedLeft.has(item.id)) return;

    if (selectedLeft?.id === item.id) {
      setSelectedLeft(null);
      return;
    }

    setSelectedLeft(item);

    // If a right item is already selected, try to match
    if (selectedRight) {
      attemptMatch(item, selectedRight);
    }
  }, [isLocked, matchedLeft, selectedLeft, selectedRight]);

  const handleRightSelect = useCallback((item) => {
    if (isLocked || matchedRight.has(item.id)) return;

    if (selectedRight?.id === item.id) {
      setSelectedRight(null);
      return;
    }

    setSelectedRight(item);

    // If a left item is already selected, try to match
    if (selectedLeft) {
      attemptMatch(selectedLeft, item);
    }
  }, [isLocked, matchedRight, selectedLeft, selectedRight]);

  const attemptMatch = useCallback((leftItem, rightItem) => {
    setIsLocked(true);
    const responseTimeMs = Date.now() - startTimeRef.current;
    // Scored on what the two cards SAY, not on the index they were built from.
    // Both "Guitar" and "Violin" are answered by a card reading "Strings", and
    // pairing Guitar with the second of those is musically right; the index
    // test called it wrong, shook the cards and took one of three lives for it.
    const pair = pairs.find(
      (p) => p.left === leftItem.label && p.right === rightItem.label,
    );
    const isCorrect = Boolean(pair);
    const concept =
      pair?.concept ||
      pairs.find((p) => p.id === leftItem.id)?.concept ||
      `match:${leftItem.id}`;

    setFeedbackCorrect(isCorrect);

    let spoken;
    if (onStep) {
      spoken = onStep(isCorrect
        ? {kind: STEP.RIGHT, itemId: concept, concept, cue: 'matchFound',
           say: guide.right(leftItem.label, rightItem.label)}
        : {kind: STEP.WRONG, itemId: concept, chosen: rightItem.label,
           wanted: pairs.find((p) => p.left === leftItem.label)?.right,
           say: guide.explainMiss(leftItem.label, rightItem.label)});
    }
    if (isCorrect) {
      setFeedbackMessage(responseTimeMs < 2000 ? 'Quick match!' : '');
      triggerFadeOut(leftItem.id, rightItem.id);
      setMatchedLeft(prev => new Set([...prev, leftItem.id]));
      setMatchedRight(prev => new Set([...prev, rightItem.id]));
      // Animate character on correct
      setCharState('celebrate');
      setTimeout(() => {
        if (mountedRef.current) setCharState('idle');
      }, 1500);
    } else {
      setFeedbackMessage('');
      triggerShake(leftItem.id, rightItem.id);
      // Animate character on wrong + lose a life
      setCharState('encourage');
      setTimeout(() => {
        if (mountedRef.current) setCharState('idle');
      }, 1500);
      setLives(prev => Math.max(0, prev - 1));
    }

    setResults(prev => [...prev, isCorrect]);
    // Guided, the pair stays in view while the voice names it (or says why
    // it does not go together); the overlay covered the board on every tap.
    // Unguided keeps the overlay.
    if (onStep) {
      holdUntilSpoken(spoken, () => advanceRef.current(), () => mountedRef.current);
    } else {
      setShowFeedback(true);
    }

    if (onAnswer) {
      onAnswer(isCorrect, concept, responseTimeMs);
    }

    startTimeRef.current = Date.now();
  }, [pairs, onAnswer, triggerFadeOut, triggerShake, onStep]);

  const advanceRef = useRef(null);
  const handleFeedbackDismiss = useCallback(() => {
    setShowFeedback(false);
    setSelectedLeft(null);
    setSelectedRight(null);
    setIsLocked(false);

    // Check if all pairs matched
    if (matchedLeft.size >= pairs.length && pairs.length > 0) {
      setTimeout(() => {
        if (mountedRef.current && onComplete) onComplete();
      }, 300);
    }
  }, [matchedLeft, pairs, onComplete]);
  advanceRef.current = handleFeedbackDismiss;

  // Get hint: in easy mode, which right items could match the selected left
  const getHintedRight = useCallback(() => {
    if (difficulty !== 'easy' || !selectedLeft) return null;
    return selectedLeft.id; // The correct right item id
  }, [difficulty, selectedLeft]);

  const hintedRightId = getHintedRight();

  // --- Render ---
  if (pairs.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading pairs...</Text>
      </View>
    );
  }

  const containerScale = containerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <View style={styles.container}>
      {/* Game Lives Bar */}
      <GameLivesBar
        lives={lives}
        score={matchedLeft.size}
        currentLevel={matchedLeft.size + 1}
        totalLevels={pairs.length}
        streak={trailingRight(results)}
      />

      {/* Kids Character */}
      <View style={{alignItems: 'center', marginBottom: 8}}>
        <KidsCharacter seed="match-game" state={charState} size={72} />
      </View>

      {/* Visual Hint */}
      <VisualHint type="match" visible={showVisualHint && matchedLeft.size === 0} onDismiss={() => setShowVisualHint(false)} />

      {/* Adaptive mode indicator */}
      {difficulty === 'easy' && (
        <View style={styles.adaptiveBanner}>
          <Icon name="lightbulb-on-outline" size={16} color={kidsColors.star} />
          <Text style={styles.adaptiveText}>Watch for the highlighted match!</Text>
        </View>
      )}
      {difficulty === 'hard' && (
        <View style={[styles.adaptiveBanner, {backgroundColor: kidsColors.accentLight + '20'}]}>
          <Icon name="fire" size={16} color={kidsColors.streak} />
          <Text style={[styles.adaptiveText, {color: kidsColors.streak}]}>Matching master!</Text>
        </View>
      )}

      <Animated.View
        style={[
          styles.columnsContainer,
          {transform: [{scale: containerScale}], opacity: containerAnim},
        ]}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          <View style={styles.columns}>
            {/* Left Column */}
            <View style={styles.column}>
              <Text style={styles.columnHeader}>
                <Icon name="arrow-right-circle" size={16} color={kidsColors.accent} />{' '}
                Items
              </Text>
              {leftItems.map((item, idx) => {
                const isMatched = matchedLeft.has(item.id);
                const isSelected = selectedLeft?.id === item.id;
                const leftKey = `left-${item.id}`;
                const shake = shakeAnims.current[leftKey] || new Animated.Value(1);
                const fade = fadeAnims.current[leftKey] || new Animated.Value(1);

                return (
                  <Animated.View
                    key={`left-${item.id}`}
                    style={{
                      transform: [{translateX: shake}],
                      opacity: fade,
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.matchItem,
                        {borderColor: kidsColors.palette[idx % kidsColors.palette.length]},
                        isSelected && styles.matchItemSelected,
                        isMatched && styles.matchItemMatched,
                      ]}
                      onPress={() => handleLeftSelect(item)}
                      onPressIn={pressIn}
                      onPressOut={pressOut}
                      disabled={isMatched || isLocked}
                      activeOpacity={0.85}
                    >
                      <MatchGlyph label={item.label} />
                      <Text
                        style={[
                          styles.matchItemText,
                          isMatched && styles.matchItemTextMatched,
                        ]}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {isMatched && (
                        <Icon name="check-circle" size={18} color={kidsColors.correct} />
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>

            {/* Connector */}
            <View style={styles.connector}>
              <Icon name="link-variant" size={24} color={kidsColors.textMuted} />
            </View>

            {/* Right Column */}
            <View style={styles.column}>
              <Text style={styles.columnHeader}>
                <Icon name="arrow-left-circle" size={16} color={kidsColors.accentSecondary} />{' '}
                Matches
              </Text>
              {rightItems.map((item, idx) => {
                const isMatched = matchedRight.has(item.id);
                const isSelected = selectedRight?.id === item.id;
                const isHinted = hintedRightId === item.id;
                const rightKey = `right-${item.id}`;
                const shake = shakeAnims.current[rightKey] || new Animated.Value(1);
                const fade = fadeAnims.current[rightKey] || new Animated.Value(1);

                // In easy mode, dim non-hinted, non-matched items when a left is selected
                const isDimmed = difficulty === 'easy' &&
                  selectedLeft &&
                  !isMatched &&
                  hintedRightId !== null &&
                  item.id !== hintedRightId;

                return (
                  <Animated.View
                    key={`right-${item.id}`}
                    style={{
                      transform: [{translateX: shake}],
                      opacity: isDimmed ? Animated.multiply(fade, dimOpacityValue) : fade,
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.matchItem,
                        {borderColor: kidsColors.palette[(idx + 4) % kidsColors.palette.length]},
                        isSelected && styles.matchItemSelected,
                        isMatched && styles.matchItemMatched,
                        isHinted && styles.matchItemHinted,
                        isDimmed && styles.matchItemDimmed,
                      ]}
                      onPress={() => handleRightSelect(item)}
                      onPressIn={pressIn}
                      onPressOut={pressOut}
                      disabled={isMatched || isLocked}
                      activeOpacity={0.85}
                    >
                      <MatchGlyph label={item.label} />
                      <Text
                        style={[
                          styles.matchItemText,
                          isMatched && styles.matchItemTextMatched,
                        ]}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {isMatched && (
                        <Icon name="check-circle" size={18} color={kidsColors.correct} />
                      )}
                      {isHinted && !isMatched && (
                        <Icon name="star" size={16} color={kidsColors.star} />
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Match count */}
      <View style={styles.matchCount}>
        <Text style={{fontSize: 20}}>{'\ud83e\udde9'}</Text>
        <Text style={styles.matchCountText}>
          {matchedLeft.size} / {pairs.length}
        </Text>
      </View>

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
  columnsContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: kidsSpacing.md,
    paddingBottom: kidsSpacing.lg,
  },
  columns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    gap: kidsSpacing.sm,
  },
  columnHeader: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textSecondary,
    textAlign: 'center',
    marginBottom: kidsSpacing.xs,
  },
  connector: {
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: kidsSpacing.xl,
  },
  matchItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.md,
    borderWidth: 2,
    paddingVertical: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.sm,
    minHeight: 80,
    ...kidsShadows.card,
  },
  matchItemSelected: {
    borderColor: kidsColors.accent,
    borderWidth: 3,
    backgroundColor: kidsColors.accentLight + '15',
  },
  matchItemMatched: {
    backgroundColor: kidsColors.correctLight,
    borderColor: kidsColors.correct,
  },
  matchItemHinted: {
    borderColor: kidsColors.star,
    borderWidth: 3,
    backgroundColor: kidsColors.star + '12',
  },
  matchItemDimmed: {
    // Opacity handled by Animated.multiply on parent Animated.View
  },
  matchItemText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  matchItemTextMatched: {
    color: kidsColors.correct,
  },
  matchCount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    paddingVertical: kidsSpacing.md,
    borderTopWidth: 1,
    borderTopColor: kidsColors.border,
  },
  matchCountText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
});

export default MatchPairsTemplate;
