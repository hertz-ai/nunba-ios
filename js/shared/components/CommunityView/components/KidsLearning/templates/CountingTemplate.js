import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, Animated, StyleSheet, Dimensions, Pressable} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  kidsColors,
  kidsSpacing,
  kidsBorderRadius,
  kidsFontSize,
  kidsFontWeight,
  kidsShadows,
} from '../../../../../theme/kidsColors';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import GameLivesBar from '../shared/GameLivesBar';
import KidsCharacter from '../shared/KidsCharacter';
import VisualHint from '../shared/VisualHint';
import {getEmojiForText} from '../shared/emojiMap';
import {SPRINGS} from '../shared/gameThemes';
import {STEP, LEVEL, counting as guide} from '../shared/gameGuide';
import holdUntilSpoken from '../shared/holdUntilSpoken';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const ICON_AREA_HEIGHT = 260;

/**
 * CountingTemplate - Count objects on screen game.
 *
 * Shows scattered emoji/icons in the upper area. The child counts them and
 * taps one of a few numbers (choicesFor). Icons animate in one by one with a
 * staggered bounce. Implements real-time difficulty adaptation.
 *
 * Props:
 * - config: { content: { rounds: [{ count, icon, color, concept, label }] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 * - onStep: (step) => void   GameShell speaks it and plays its cue (gameGuide)
 * - level: number            the shell's ladder; LEVEL.MIN puts a number on
 *                            every object to count
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
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const wobble = useRef(new Animated.Value(1)).current;

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

/**
 * The numbers a child picks from: the answer and its neighbours.  One tap
 * answers, as in the owner's Number Meadow; the old number pad asked for a
 * typed number and a separate tick, and on a tablet its last row sat under
 * the app's tab bar.  The ladder decides how hard the choice is: three
 * numbers two apart, then three close ones, then four close ones.  The tap's
 * sound is the step's cue (useGuidedSteps): one sound per tap, not two.
 */
export const choicesFor = (count, level = LEVEL.START, roundIndex = 0) => {
  const gap = level >= LEVEL.START + 1 ? 1 : 2;
  const want = level >= LEVEL.MAX ? 4 : 3;
  const picks = [count];
  for (const step of [gap, -gap, 2 * gap, -2 * gap, 3 * gap]) {
    const n = count + step;
    if (n >= 1 && !picks.includes(n)) picks.push(n);
    if (picks.length === want) break;
  }
  picks.sort((a, b) => a - b);
  // Rotate by round so the answer is not always in the same place, without
  // randomness a test (or a replay) could not reproduce.
  const k = roundIndex % picks.length;
  return picks.slice(k).concat(picks.slice(0, k));
};

const CountingTemplate = ({config, onAnswer, onComplete, onStep, level = LEVEL.START}) => {
  const rounds = config?.content?.rounds || [];
  const [currentRound, setCurrentRound] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);
  // After a right answer the numbers appear on each object while the voice
  // counts them: the teaching moment.  At the easiest level they are always
  // there.  (This template's own "3 misses" ladder is the shell's now.)
  const [teaching, setTeaching] = useState(false);
  const showCountLabels = teaching || level <= LEVEL.MIN;
  const [positions, setPositions] = useState([]);

  // New state for visual overhaul
  const [lives, setLives] = useState(3);
  const [charState, setCharState] = useState('idle');
  const [showHint, setShowHint] = useState(true);

  // Animations
  const titleAnim = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(1)).current;

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
    setAnswered(false);
    setTeaching(false);
    if (onStep && round.count != null) {
      // With one-tap choices every line this round can need is known now:
      // the right answer's, each wrong choice's, and the next question.
      // Prepared while the question plays, a miss is explained at once, not
      // ~12 s later (seen on a tablet whose node was busy speaking).
      const next = rounds[currentRound + 1];
      const prepare = [
        guide.right(round),
        ...choicesFor(round.count, level, currentRound)
          .filter((n) => n !== round.count)
          .map((n) => guide.explainMiss(n, round)),
        ...(next && next.count != null ? [guide.ask(next)] : []),
      ];
      onStep({kind: STEP.ASKED, itemId: round.concept || `round-${currentRound}`, say: guide.ask(round), prepare});
    }
    resultAnim.setValue(1);

    titleAnim.setValue(1);
    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    roundStartTime.current = Date.now();
  }, [currentRound]);

  const handleSubmit = useCallback(
    value => {
      if (answered) return;

      const responseTimeMs = Date.now() - roundStartTime.current;
      const isCorrect = value === round.count;

      setAnswered(true);

      const itemId = round.concept || `round-${currentRound}`;
      let spoken;
      if (onStep) {
        spoken = onStep(isCorrect
          ? {kind: STEP.RIGHT, itemId, concept: round.concept, say: guide.right(round)}
          : {kind: STEP.WRONG, itemId, chosen: value, wanted: round.count,
             say: guide.explainMiss(value, round)});
      }
      if (isCorrect) {
        setTeaching(true);
        // Animate character celebration
        setCharState('celebrate');
        setTimeout(() => {
          if (mountedRef.current) setCharState('idle');
        }, 1500);
      } else {
        // Animate character encouragement and deduct a life
        setCharState('encourage');
        setTimeout(() => {
          if (mountedRef.current) setCharState('idle');
        }, 1500);
        setLives(prev => Math.max(0, prev - 1));
      }

      setResults(prev => [...prev, isCorrect]);

      // Feedback.  Guided, the answer stays on screen over the objects (the
      // result card and, when right, a number on each one) until the voice
      // has explained it; then the next round.  The full-screen overlay used
      // to cover the objects at exactly that moment and move on after 1.5s,
      // so the next question cut the explanation off (seen on a tablet).
      setFeedbackCorrect(isCorrect);
      if (onStep) {
        holdUntilSpoken(spoken, () => advanceRef.current(), () => mountedRef.current);
      } else {
        setFeedbackVisible(true);
      }

      // Report
      onAnswer(isCorrect, round.concept, responseTimeMs);

      // Show result animation
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    },
    [answered, round, onAnswer, onStep, currentRound],
  );

  const advanceRef = useRef(null);
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
  advanceRef.current = handleFeedbackDismiss;

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
          {guide.title(round)}
        </Text>
      </Animated.View>

      {/* Emoji question header */}
      <View style={{alignItems: 'center', marginBottom: 8}}>
        <Text style={{fontSize: 48}}>{emojiForLabel}</Text>
      </View>

      {/* Easiest level: a number on every object */}
      {level <= LEVEL.MIN && !teaching && (
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

      {/* One tap answers */}
      {!answered && (
        <View style={styles.choiceRow}>
          {choicesFor(round.count || 0, level, currentRound).map((n, i) => (
            <Pressable
              key={n}
              testID={`count-choice-${n}`}
              accessibilityRole="button"
              accessibilityLabel={String(n)}
              onPress={() => handleSubmit(n)}
              style={({pressed}) => [
                styles.choice,
                {backgroundColor: kidsColors.palette[i % kidsColors.palette.length]},
                pressed && styles.choicePressed,
              ]}>
              <Text style={styles.choiceText}>{n}</Text>
            </Pressable>
          ))}
        </View>
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
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: kidsSpacing.md,
  },
  choice: {
    width: 96,
    height: 96,
    maxWidth: '22%',
    aspectRatio: 1,
    borderRadius: 28,
    margin: kidsSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choicePressed: {
    transform: [{scale: 0.92}],
  },
  choiceText: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
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
