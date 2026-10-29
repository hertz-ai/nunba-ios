import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
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
import GameLivesBar from '../shared/GameLivesBar';
import KidsCharacter from '../shared/KidsCharacter';
import VisualHint from '../shared/VisualHint';
import {getEmojiForText} from '../shared/emojiMap';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import usePressAnimation from '../../../../../hooks/usePressAnimation';
import {STEP, LEVEL, memoryFlip as guide} from '../shared/gameGuide';
import holdUntilSpoken from '../shared/holdUntilSpoken';
import {SPRINGS} from '../shared/gameThemes';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

/**
 * MemoryFlipTemplate - Memory card matching game.
 *
 * Displays a grid of face-down cards. The child flips 2 cards at a time to
 * find matching pairs (front <-> match). Cards animate with rotateY flip.
 * Implements real-time difficulty adaptation.
 *
 * Props:
 * - config: { content: { pairs: [{ id, front, match, concept }], gridColumns: 4 } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 */

// Individual memory card with flip animation
const MemoryCard = ({card, isFlipped, isMatched, onPress, onPressIn, onPressOut, cardSize, colorIndex}) => {
  const flipAnim = useRef(new Animated.Value(isFlipped ? 180 : 0)).current;
  const matchScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 180 : 0,
      ...SPRINGS.flippy,
    }).start();
  }, [isFlipped]);

  useEffect(() => {
    if (isMatched) {
      Animated.sequence([
        Animated.spring(matchScale, {
          toValue: 1.15,
          ...SPRINGS.quick,
        }),
        Animated.spring(matchScale, {
          toValue: 1,
          ...SPRINGS.playful,
        }),
      ]).start();
    }
  }, [isMatched]);

  const frontInterp = flipAnim.interpolate({
    inputRange: [0, 90, 180],
    outputRange: ['0deg', '90deg', '180deg'],
  });

  const backInterp = flipAnim.interpolate({
    inputRange: [0, 90, 180],
    outputRange: ['180deg', '270deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 89, 90, 180],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 91, 180],
    outputRange: [0, 0, 1, 1],
  });

  const cardBackColor =
    kidsColors.palette[colorIndex % kidsColors.palette.length];
  const emoji = getEmojiForText(card.displayText) || '';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isFlipped || isMatched}>
      <Animated.View
        style={[
          styles.cardWrapper,
          {
            width: cardSize,
            height: cardSize,
            transform: [{scale: matchScale}],
          },
        ]}>
        {/* Card Back (face down - what you see first) */}
        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            {
              width: cardSize,
              height: cardSize,
              backgroundColor: cardBackColor,
              transform: [{rotateY: frontInterp}],
              opacity: frontOpacity,
            },
          ]}>
          <Icon name="help-circle" size={cardSize * 0.4} color={kidsColors.textOnDark} />
        </Animated.View>

        {/* Card Front (face up - revealed content) */}
        <Animated.View
          style={[
            styles.card,
            styles.cardFront,
            {
              width: cardSize,
              height: cardSize,
              transform: [{rotateY: backInterp}],
              opacity: backOpacity,
            },
            isMatched && styles.cardMatched,
          ]}>
          {emoji ? (
            <Text style={{fontSize: cardSize > 70 ? 32 : 24, textAlign: 'center'}}>
              {emoji}
            </Text>
          ) : null}
          <Text
            style={[
              styles.cardText,
              {fontSize: cardSize > 70 ? kidsFontSize.lg : kidsFontSize.md},
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit>
            {card.displayText}
          </Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const MemoryFlipTemplate = ({config, onAnswer, onComplete, onStep, level = LEVEL.START}) => {
  const {onPressIn, onPressOut, animatedStyle: pressStyle} = usePressAnimation(0.96);
  const pairs = config?.content?.pairs || [];
  const gridColumns = config?.content?.gridColumns || 4;

  // Build the deck: each pair produces 2 cards (front card + match card)
  const buildDeck = useCallback(() => {
    const deck = [];
    pairs.forEach(pair => {
      deck.push({
        id: `${pair.id}-front`,
        pairId: pair.id,
        side: 'front',
        displayText: pair.front,
        concept: pair.concept,
      });
      deck.push({
        id: `${pair.id}-match`,
        pairId: pair.id,
        side: 'match',
        displayText: pair.match,
        concept: pair.concept,
      });
    });
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }, [pairs]);

  const [deck, setDeck] = useState([]);
  const [flippedIds, setFlippedIds] = useState([]);
  // Matched CARDS, not matched pairs. Several decks print the same answer on
  // more than one card -- three cards read "12" in the addition deck (6+6, 7+5
  // and 8+4) and two read "11" -- so the card a child turns over need not be
  // the one built from the same pair, and retiring "the pair" retired a card
  // still face-down on the board.
  const [matchedCardIds, setMatchedCardIds] = useState(new Set());
  const [attempts, setAttempts] = useState(0);
  // The shell's one ladder (shared/gameGuide): at LEVEL.MIN every miss
  // flashes a pair.  This template's own three-misses count is gone.
  const struggling = level <= LEVEL.MIN;
  const [misses, setMisses] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [hintPairId, setHintPairId] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  // New state variables for visual overhaul
  const [lives, setLives] = useState(3);
  const [charState, setCharState] = useState('idle');
  const [showVisualHint, setShowVisualHint] = useState(true);

  // Feedback
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);

  // Timing
  const flipStartTime = useRef(Date.now());
  const mountedRef = useRef(true);
  const completedRef = useRef(false);

  // Header animation
  const headerAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    if (onStep) onStep({kind: STEP.ASKED, itemId: 'memory:start', say: guide.ask()});
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Deal the deck when the pairs arrive, not only on the first render.
  //
  // This used to sit in the mount-only effect above, so a template rendered
  // before its content landed dealt from an empty pair list and never dealt
  // again: the board stayed permanently empty, with no card to turn over,
  // while the header still counted "0 / 8". Same stale-derived-state defect
  // already fixed in FillBlank, SpotDifference and StoryBuilder.
  //
  // Keyed on the pairs from config, NOT on the `|| []` fallback above — that
  // allocates a fresh array every render, which would re-deal the board on
  // every render and wipe a game in progress.
  //
  // The unmount cleanup stays in the effect above on purpose: moving it here
  // would set mountedRef false on every content change and silence the
  // component for the rest of its life.
  const pairsFromConfig = config?.content?.pairs;
  useEffect(() => {
    setDeck(buildDeck());
    // buildDeck is intentionally omitted: it is rebuilt on every render
    // because `pairs` is a fresh array, and depending on it would re-deal
    // continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairsFromConfig]);

  // Adaptive: after a miss at the lowest level, flash a pair
  useEffect(() => {
    if (misses > 0 && struggling && !showHint) {
      setShowHint(true);
      setIsChecking(true); // Block user interaction during hint
      // Briefly flash an unmatched pair
      // Flash a pair whose cards are BOTH still face-down, so the hint never
      // points at a card already taken by an equal-looking answer.
      const unmatchedPair = pairs.find(
        (p) =>
          !matchedCardIds.has(`${p.id}-front`) &&
          !matchedCardIds.has(`${p.id}-match`),
      );
      if (unmatchedPair) {
        setHintPairId(unmatchedPair.id);
        // Show hint cards for 1.5 seconds
        const hintCards = deck
          .filter(c => c.pairId === unmatchedPair.id)
          .map(c => c.id);
        setFlippedIds(hintCards);
        const timeout = setTimeout(() => {
          if (!mountedRef.current) return;
          setFlippedIds([]);
          setHintPairId(null);
          setShowHint(false);
          setIsChecking(false);
        }, 1500);
        return () => clearTimeout(timeout);
      }
    }
  }, [misses]);

  // Check for match when 2 cards are flipped
  useEffect(() => {
    if (flippedIds.length === 2) {
      setIsChecking(true);
      const [firstId, secondId] = flippedIds;
      const firstCard = deck.find(c => c.id === firstId);
      const secondCard = deck.find(c => c.id === secondId);

      // A turn is a match when the two faces GO TOGETHER, not when they came
      // from the same index. "6 + 6" and any card reading "12" is a match;
      // requiring the same pairId called two thirds of the correct answers
      // wrong on a deck where three cards read "12".
      const sides = [firstCard, secondCard];
      const frontCard = sides.find((c) => c && c.side === 'front');
      const matchCard = sides.find((c) => c && c.side === 'match');
      const isMatch =
        Boolean(frontCard && matchCard) &&
        firstCard.id !== secondCard.id &&
        pairs.some(
          (p) =>
            String(p.front) === String(frontCard.displayText) &&
            String(p.match) === String(matchCard.displayText),
        );

      const responseTimeMs = Date.now() - flipStartTime.current;

      setAttempts(prev => prev + 1);

      if (isMatch) {
        // Match found: both cards named together, with the match sound
        let spoken;
        if (onStep) {
          spoken = onStep({kind: STEP.RIGHT, itemId: frontCard.pairId, concept: frontCard.concept, cue: 'matchFound',
            say: guide.right(frontCard.displayText, matchCard.displayText)});
        }
        const newMatched = new Set(matchedCardIds);
        newMatched.add(firstCard.id);
        newMatched.add(secondCard.id);
        setMatchedCardIds(newMatched);

        // Guided, the board and the voice are the feedback; the overlay
        // covered the cards on every turn.  Unguided keeps it.
        setFeedbackCorrect(true);
        if (!onStep) setFeedbackVisible(true);

        // Animate character on match
        setCharState('celebrate');
        setTimeout(() => {
          if (mountedRef.current) setCharState('idle');
        }, 1500);

        onAnswer(true, firstCard.concept, responseTimeMs);

        setTimeout(() => {
          if (!mountedRef.current) return;
          setFlippedIds([]);
          setIsChecking(false);

          // Every card turned over - two per pair.  Guided, the game ends once
          // the last pair has been named, not 1.1s in.
          if (newMatched.size >= pairs.length * 2 && !completedRef.current) {
            completedRef.current = true;
            const finish = () => { if (mountedRef.current) onComplete(); };
            if (onStep) holdUntilSpoken(spoken, finish, () => mountedRef.current);
            else setTimeout(finish, 500);
          }
        }, 600);
      } else {
        // No match - flip back after delay
        let spoken;
        if (onStep && firstCard && secondCard) {
          spoken = onStep({kind: STEP.WRONG, itemId: firstCard.pairId, chosen: secondCard.displayText,
            say: guide.explainMiss(firstCard.displayText, secondCard.displayText)});
        }
        setMisses(prev => prev + 1);

        setFeedbackCorrect(false);
        if (!onStep) setFeedbackVisible(true);

        // Animate character on miss and lose a life
        setCharState('encourage');
        setLives(prev => Math.max(0, prev - 1));
        setTimeout(() => {
          if (mountedRef.current) setCharState('idle');
        }, 1500);

        if (firstCard) {
          onAnswer(false, firstCard.concept, responseTimeMs);
        }

        // Guided, both cards stay face up while the voice says why they do
        // not go together; they flipped back 1s in, mid-sentence.
        const flipBack = () => {
          if (!mountedRef.current) return;
          setFlippedIds([]);
          setIsChecking(false);
        };
        if (onStep) holdUntilSpoken(spoken, flipBack, () => mountedRef.current);
        else setTimeout(flipBack, 1000);
      }
    }
  }, [flippedIds]);

  const handleCardPress = useCallback(
    cardId => {
      if (isChecking) return;
      if (flippedIds.length >= 2) return;
      if (flippedIds.includes(cardId)) return;
      if (matchedCardIds.has(cardId)) return;

      // The first card is read aloud; the second waits for the turn's line.
      const card = deck.find(c => c.id === cardId);
      if (onStep) {
        onStep(flippedIds.length === 0 && card
          ? {kind: STEP.TOUCH, itemId: cardId, cue: 'cardFlip', say: guide.card(card.displayText)}
          : {kind: STEP.TOUCH, itemId: cardId, cue: 'cardFlip'});
      }

      if (flippedIds.length === 0) {
        flipStartTime.current = Date.now();
      }

      setFlippedIds(prev => [...prev, cardId]);
    },
    [isChecking, flippedIds, matchedCardIds, deck, onStep],
  );

  const handleFeedbackDismiss = useCallback(() => {
    setFeedbackVisible(false);
  }, []);

  // Card sizing
  const gridPadding = kidsSpacing.md * 2;
  const cardGap = kidsSpacing.sm;
  const totalGapWidth = cardGap * (gridColumns - 1);
  const cardSize = Math.max(56, Math.floor(
    (SCREEN_WIDTH - gridPadding - totalGapWidth) / gridColumns,
  ));

  if (pairs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="cards-outline" size={48} color={kidsColors.textMuted} />
        <Text style={styles.emptyText}>No pairs available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Game lives bar */}
      <GameLivesBar
        lives={lives}
        score={matchedCardIds.size / 2}
        currentLevel={matchedCardIds.size / 2 + 1}
        totalLevels={pairs.length}
        streak={0}
      />

      {/* Kids character */}
      <View style={{alignItems: 'center', marginBottom: 8}}>
        <KidsCharacter seed="memory-game" state={charState} size={64} />
      </View>

      {/* Visual hint for first-time players */}
      <VisualHint
        type="flip"
        visible={showVisualHint && matchedCardIds.size === 0}
        onDismiss={() => setShowVisualHint(false)}
      />

      {/* Emoji stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={{fontSize: 20}}>{'\u{1F9E9}'}</Text>
          <Text style={styles.statText}>
            {matchedCardIds.size / 2}/{pairs.length}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={{fontSize: 20}}>{'\u23F1\uFE0F'}</Text>
          <Text style={styles.statText}>{attempts}</Text>
        </View>
      </View>

      {/* Adaptive hint indicator */}
      {struggling && misses > 0 && (
        <View style={styles.hintBanner}>
          <Icon
            name="lightbulb-on-outline"
            size={18}
            color={kidsColors.star}
          />
          <Text style={styles.hintBannerText}>
            Watch closely - showing you a match!
          </Text>
        </View>
      )}

      {/* Card grid */}
      <View style={styles.gridContainer}>
        <View
          style={[
            styles.grid,
            {
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: cardGap,
              justifyContent: 'center',
            },
          ]}>
          {deck.map((card, index) => {
            const isFlipped =
              flippedIds.includes(card.id) || matchedCardIds.has(card.id);
            const isMatched = matchedCardIds.has(card.id);
            const isHinted = hintPairId === card.pairId;

            return (
              <MemoryCard
                key={card.id}
                card={card}
                isFlipped={isFlipped || isHinted}
                isMatched={isMatched}
                onPress={() => handleCardPress(card.id)}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                cardSize={cardSize}
                colorIndex={index}
              />
            );
          })}
        </View>
      </View>

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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: kidsSpacing.xl,
    paddingHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
  },
  statText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textPrimary,
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    backgroundColor: kidsColors.hintBg,
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.md,
    marginHorizontal: kidsSpacing.md,
    borderRadius: kidsBorderRadius.md,
    marginBottom: kidsSpacing.sm,
  },
  hintBannerText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textPrimary,
    fontWeight: kidsFontWeight.medium,
  },
  gridContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: kidsSpacing.md,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: kidsColors.accentLight,
    borderRadius: kidsBorderRadius.xl,
    margin: kidsSpacing.sm,
    padding: kidsSpacing.sm,
  },
  grid: {
    alignSelf: 'center',
  },
  cardWrapper: {
    perspective: 1000,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: kidsBorderRadius.md,
    backfaceVisibility: 'hidden',
    ...kidsShadows.card,
  },
  cardBack: {
    backgroundColor: kidsColors.accent,
  },
  cardFront: {
    backgroundColor: kidsColors.card,
    borderWidth: 2,
    borderColor: kidsColors.border,
    padding: kidsSpacing.xs,
  },
  cardMatched: {
    borderColor: kidsColors.star,
    borderWidth: 3,
    backgroundColor: kidsColors.correctLight,
  },
  cardText: {
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
  },
});

export default MemoryFlipTemplate;
