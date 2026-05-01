import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, Animated, StyleSheet, Dimensions} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  kidsColors,
  kidsSpacing,
  kidsBorderRadius,
  kidsFontSize,
  kidsFontWeight,
  kidsShadows,
} from '../../../../../theme/kidsColors';
import NumberPad from '../shared/NumberPad';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import GameLivesBar from '../shared/GameLivesBar';
import KidsCharacter from '../shared/KidsCharacter';
import VisualHint from '../shared/VisualHint';
import {getEmojiForText} from '../shared/emojiMap';
import {SPRINGS} from '../shared/gameThemes';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const ICON_AREA_HEIGHT = 260;

/**
 * CountingTemplate - Count objects on screen game.
 *
 * Shows scattered emoji/icons in the upper area. The child counts them and
 * enters the number using the NumberPad. Icons animate in one by one with a
 * staggered bounce. Implements real-time difficulty adaptation.
 *
 * Props:
 * - config: { content: { rounds: [{ count, icon, color, concept, label }] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 */

// Map icon names to MaterialCommunityIcons names
const ICON_MAP = {
  star: 'star',
  apple: 'food-apple',
  heart: 'heart',
  flower: 'flower',
  fish: 'fish',
  bird: 'bird',
  cat: 'cat',
  dog: 'dog',
  tree: 'pine-tree',
  ball: 'basketball',
  car: 'car',
  moon: 'moon-waning-crescent',
  sun: 'white-balance-sunny',
  cloud: 'cloud',
  butterfly: 'butterfly',
  bee: 'bee',
  leaf: 'leaf',
  cookie: 'cookie',
  cake: 'cake-variant',
  candy: 'candy',
};

// Generate random scattered positions for icons within the area
const generatePositions = (count, areaWidth, areaHeight, iconSize) => {
  const positions = [];
  const padding = 10;
  const maxAttempts = 100;

  for (let i = 0; i < count; i++) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < maxAttempts) {
      const x = padding + Math.random() * (areaWidth - iconSize - padding * 2);
      const y = padding + Math.random() * (areaHeight - iconSize - padding * 2);

      // Check if it overlaps with existing positions
      const tooClose = positions.some(
        pos =>
          Math.abs(pos.x - x) < iconSize * 0.7 &&
          Math.abs(pos.y - y) < iconSize * 0.7,
      );

      if (!tooClose) {
        positions.push({x, y});
        placed = true;
      }
      attempts++;
    }

    // Fallback: place anyway if can't find non-overlapping spot
    if (!placed) {
      positions.push({
        x: padding + Math.random() * (areaWidth - iconSize - padding * 2),
        y: padding + Math.random() * (areaHeight - iconSize - padding * 2),
      });
    }
  }

  return positions;
};

// Individual animated icon
const CountIcon = ({iconName, color, position, delay, size, showNumber, number}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(bounceAnim, {
        toValue: 1,
        ...SPRINGS.bouncy,
      }),
    ]).start();

    // Gentle idle wobble
    const wobbleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, {
          toValue: 1,
          duration: 1500 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(wobble, {
          toValue: 0,
          duration: 1500 + Math.random() * 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    const wobbleTimeout = setTimeout(() => wobbleLoop.start(), delay + 400);

    return () => {
      clearTimeout(wobbleTimeout);
      wobbleLoop.stop();
    };
  }, []);

  const rotation = wobble.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  return (
    <Animated.View
      style={[
        styles.iconWrapper,
        {
          left: position.x,
          top: position.y,
          transform: [
            {
              scale: bounceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
            {rotate: rotation},
          ],
        },
      ]}>
      <Icon name={iconName} size={size} color={color} />
      {showNumber && (
        <View style={styles.iconNumber}>
          <Text style={styles.iconNumberText}>{number}</Text>
        </View>
      )}
    </Animated.View>
  );
};

const CountingTemplate = ({config, onAnswer, onComplete}) => {
  const rounds = config?.content?.rounds || [];
  const [currentRound, setCurrentRound] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [showCountLabels, setShowCountLabels] = useState(false);
  const [positions, setPositions] = useState([]);

  // New state for visual overhaul
  const [lives, setLives] = useState(3);
  const [charState, setCharState] = useState('idle');
  const [showHint, setShowHint] = useState(true);

  // Animations
  const titleAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;

  // Feedback
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);

  // Timing
  const roundStartTime = useRef(Date.now());
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const round = rounds[currentRound] || {};
  const iconName = ICON_MAP[round.icon] || 'star';
  const iconColor = round.color || kidsColors.star;
  const iconSize = round.count > 10 ? 38 : round.count > 6 ? 44 : 56;

  // Generate new positions when round changes
  useEffect(() => {
    const areaWidth = SCREEN_WIDTH - kidsSpacing.md * 2;
    setPositions(generatePositions(round.count || 0, areaWidth, ICON_AREA_HEIGHT, iconSize));
    setInputValue('');
    setAnswered(false);
    setShowCountLabels(false);
    resultAnim.setValue(0);

    titleAnim.setValue(0);
    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    roundStartTime.current = Date.now();
  }, [currentRound]);

  // Adaptive: show count numbers on icons when struggling
  useEffect(() => {
    if (consecutiveWrong >= 3 && !showCountLabels) {
      setShowCountLabels(true);
    }
  }, [consecutiveWrong]);

  const handleSubmit = useCallback(
    value => {
      if (answered) return;

      const responseTimeMs = Date.now() - roundStartTime.current;
      const isCorrect = value === round.count;

      setAnswered(true);

      // Track adaptive state
      if (isCorrect) {
        setConsecutiveWrong(0);
        // Animate character celebration
        setCharState('celebrate');
        setTimeout(() => {
          if (mountedRef.current) setCharState('idle');
        }, 1500);
      } else {
        setConsecutiveWrong(prev => prev + 1);
        // Animate character encouragement and deduct a life
        setCharState('encourage');
        setTimeout(() => {
          if (mountedRef.current) setCharState('idle');
        }, 1500);
        setLives(prev => Math.max(0, prev - 1));
      }

      setResults(prev => [...prev, isCorrect]);

      // Feedback
      setFeedbackCorrect(isCorrect);
      setFeedbackVisible(true);

      // Report
      onAnswer(isCorrect, round.concept, responseTimeMs);

      // Show result animation
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    },
    [answered, round, onAnswer],
  );

  const handleFeedbackDismiss = useCallback(() => {
    setFeedbackVisible(false);

    setTimeout(() => {
      if (!mountedRef.current) return;
      if (currentRound < rounds.length - 1) {
        setCurrentRound(prev => prev + 1);
      } else {
        onComplete();
      }
    }, 500);
  }, [currentRound, rounds.length, onComplete]);

  if (rounds.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="alert-circle-outline" size={48} color={kidsColors.textMuted} />
        <Text style={styles.emptyText}>No counting rounds available</Text>
      </View>
    );
  }

  const emojiForLabel = getEmojiForText(round.label || round.icon) || '\u2753';

  return (
    <View style={styles.container}>
      {/* GameLivesBar replaces ProgressDots */}
      <GameLivesBar
        lives={lives}
        score={results.filter(r => r).length}
        currentLevel={currentRound + 1}
        totalLevels={rounds.length}
        streak={results.filter(r => r).length}
      />

      {/* KidsCharacter */}
      <View style={{alignItems: 'center', marginBottom: 8}}>
        <KidsCharacter seed={`counting-${currentRound}`} state={charState} size={80} />
      </View>

      {/* VisualHint (first round only) */}
      <VisualHint type="count" visible={showHint && currentRound === 0} onDismiss={() => setShowHint(false)} />

      {/* Title */}
      <Animated.View
        style={[
          styles.titleContainer,
          {
            opacity: titleAnim,
            transform: [
              {
                translateY: titleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-15, 0],
                }),
              },
            ],
          },
        ]}>
        <Icon name="counter" size={24} color={kidsColors.accent} />
        <Text style={styles.titleText}>
          How many {round.label || 'items'} can you count?
        </Text>
      </Animated.View>

      {/* Emoji question header */}
      <View style={{alignItems: 'center', marginBottom: 8}}>
        <Text style={{fontSize: 48}}>{emojiForLabel}</Text>
      </View>

      {/* Adaptive helper */}
      {consecutiveWrong >= 3 && (
        <View style={styles.hintBanner}>
          <Icon name="lightbulb-on-outline" size={18} color={kidsColors.star} />
          <Text style={styles.hintBannerText}>
            Numbers on each {round.label ? round.label.slice(0, -1) : 'item'} to help you count!
          </Text>
        </View>
      )}

      {/* Icon scatter area */}
      <View style={[styles.iconArea, {height: ICON_AREA_HEIGHT}]}>
        {positions.map((pos, index) => (
          <CountIcon
            key={`${currentRound}-${index}`}
            iconName={iconName}
            color={iconColor}
            position={pos}
            delay={index * 120}
            size={iconSize}
            showNumber={showCountLabels}
            number={index + 1}
          />
        ))}
      </View>

      {/* Visual emoji feedback (after answering) */}
      {answered && (
        <Animated.View
          style={[
            styles.resultCard,
            {
              opacity: resultAnim,
              transform: [
                {
                  scale: resultAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
            feedbackCorrect
              ? styles.resultCorrect
              : styles.resultIncorrect,
          ]}>
          <Text style={styles.feedbackEmoji}>
            {feedbackCorrect ? '\uD83C\uDF89' : '\uD83E\uDD14'}
          </Text>
          <Text
            style={[
              styles.resultNumber,
              {
                color: feedbackCorrect
                  ? kidsColors.correct
                  : kidsColors.incorrect,
              },
            ]}>
            {round.count}
          </Text>
          <Text
            style={[
              styles.resultText,
              {
                color: feedbackCorrect
                  ? kidsColors.correct
                  : kidsColors.incorrect,
              },
            ]}>
            {feedbackCorrect
              ? `There are ${round.count} ${round.label || 'items'}!`
              : `The answer is ${round.count}`}
          </Text>
        </Animated.View>
      )}

      {/* Number pad input (colorful) */}
      {!answered && (
        <NumberPad
          value={inputValue}
          onValueChange={setInputValue}
          onSubmit={handleSubmit}
          maxDigits={3}
          colorful
        />
      )}

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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.sm,
  },
  titleText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
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
    fontSize: kidsFontSize.xs,
    color: kidsColors.textPrimary,
    fontWeight: kidsFontWeight.medium,
  },
  iconArea: {
    marginHorizontal: kidsSpacing.md,
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    position: 'relative',
    overflow: 'hidden',
    ...kidsShadows.card,
  },
  iconWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconNumber: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: kidsColors.accent,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconNumberText: {
    fontSize: 10,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    marginHorizontal: kidsSpacing.md,
    marginVertical: kidsSpacing.md,
    padding: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg,
    ...kidsShadows.card,
  },
  resultCorrect: {
    backgroundColor: kidsColors.correctLight,
    borderLeftWidth: 4,
    borderLeftColor: kidsColors.correct,
  },
  resultIncorrect: {
    backgroundColor: kidsColors.incorrectLight,
    borderLeftWidth: 4,
    borderLeftColor: kidsColors.incorrect,
  },
  feedbackEmoji: {
    fontSize: 48,
  },
  resultNumber: {
    fontSize: kidsFontSize.display || 40,
    fontWeight: kidsFontWeight.extrabold,
  },
  resultText: {
    flex: 1,
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
  },
});

export default CountingTemplate;
