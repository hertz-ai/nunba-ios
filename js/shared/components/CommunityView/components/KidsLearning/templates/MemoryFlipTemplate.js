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
import {GameSounds} from '../shared/SoundManager';
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

const MemoryFlipTemplate = ({config, onAnswer, onComplete}) => {
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
        displayText: pair.front,
        concept: pair.concept,
      });
      deck.push({
        id: `${pair.id}-match`,
        pairId: pair.id,
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
  const [matchedPairIds, setMatchedPairIds] = useState(new Set());
  const [attempts, setAttempts] = useState(0);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
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
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setDeck(buildDeck());
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Adaptive: show hint when struggling
  useEffect(() => {
    if (consecutiveWrong >= 3 && !showHint) {
      setShowHint(true);
      setIsChecking(true); // Block user interaction during hint
      // Briefly flash an unmatched pair
      const unmatchedPair = pairs.find(p => !matchedPairIds.has(p.id));
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
  }, [consecutiveWrong]);

  // Check for match when 2 cards are flipped
  useEffect(() => {
    if (flippedIds.length === 2) {
      setIsChecking(true);
      const [firstId, secondId] = flippedIds;
      const firstCard = deck.find(c => c.id === firstId);
      const secondCard = deck.find(c => c.id === secondId);

      const isMatch =
        firstCard &&
        secondCard &&
        firstCard.pairId === secondCard.pairId &&
        firstCard.id !== secondCard.id;

      const responseTimeMs = Date.now() - flipStartTime.current;

      setAttempts(prev => prev + 1);

      if (isMatch) {
        // Match found
        GameSounds.matchFound();
        setConsecutiveWrong(0);
        const newMatched = new Set(matchedPairIds);
        newMatched.add(firstCard.pairId);
        setMatchedPairIds(newMatched);

        setFeedbackCorrect(true);
        setFeedbackVisible(true);

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

          // Check if all pairs matched
          if (newMatched.size === pairs.length && !completedRef.current) {
            completedRef.current = true;
            setTimeout(() => {
              if (mountedRef.current) onComplete();
            }, 500);
          }
        }, 600);
      } else {
        // No match - flip back after delay
        setConsecutiveWrong(prev => prev + 1);

        setFeedbackCorrect(false);
        setFeedbackVisible(true);

        // Animate character on miss and lose a life
        setCharState('encourage');
        setLives(prev => Math.max(0, prev - 1));
        setTimeout(() => {
          if (mountedRef.current) setCharState('idle');
        }, 1500);

        if (firstCard) {
          onAnswer(false, firstCard.concept, responseTimeMs);
        }

        setTimeout(() => {
          if (!mountedRef.current) return;
          setFlippedIds([]);
          setIsChecking(false);
        }, 1000);
      }
    }
  }, [flippedIds]);

  const handleCardPress = useCallback(
    cardId => {
      if (isChecking) return;
      if (flippedIds.length >= 2) return;
      if (flippedIds.includes(cardId)) return;
      if (matchedPairIds.has(deck.find(c => c.id === cardId)?.pairId)) return;

      GameSounds.cardFlip();

      if (flippedIds.length === 0) {
        flipStartTime.current = Date.now();
      }

      setFlippedIds(prev => [...prev, cardId]);
    },
    [isChecking, flippedIds, matchedPairIds, deck],
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
        score={matchedPairIds.size}
        currentLevel={matchedPairIds.size + 1}
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
        visible={showVisualHint && matchedPairIds.size === 0}
        onDismiss={() => setShowVisualHint(false)}
      />

      {/* Emoji stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={{fontSize: 20}}>{'\u{1F9E9}'}</Text>
          <Text style={styles.statText}>
            {matchedPairIds.size}/{pairs.length}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={{fontSize: 20}}>{'\u23F1\uFE0F'}</Text>
          <Text style={styles.statText}>{attempts}</Text>
        </View>
      </View>

      {/* Adaptive hint indicator */}
      {consecutiveWrong >= 3 && (
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
              flippedIds.includes(card.id) || matchedPairIds.has(card.pairId);
            const isMatched = matchedPairIds.has(card.pairId);
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
