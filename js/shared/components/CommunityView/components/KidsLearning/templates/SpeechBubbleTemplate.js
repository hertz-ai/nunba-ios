import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  kidsColors,
  kidsSpacing,
  kidsBorderRadius,
  kidsFontSize,
  kidsFontWeight,
  kidsShadows,
} from '../../../../../theme/kidsColors';
import useMicAmplitude from '../../../../../hooks/useMicAmplitude';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const BUBBLE_SIZES = {
  small: {size: 30, minAmp: 0.1, maxAmp: 0.3, label: 'Whisper'},
  medium: {size: 50, minAmp: 0.3, maxAmp: 0.6, label: 'Normal'},
  large: {size: 70, minAmp: 0.6, maxAmp: 1.0, label: 'Loud'},
};

const BUBBLE_COLORS = [
  {fill: 'rgba(255,107,107,0.7)', border: '#FF6B6B'},
  {fill: 'rgba(78,205,196,0.7)', border: '#4ECDC4'},
  {fill: 'rgba(155,89,182,0.7)', border: '#9B59B6'},
  {fill: 'rgba(46,204,113,0.7)', border: '#2ECC71'},
  {fill: 'rgba(241,196,15,0.7)', border: '#F1C40F'},
];

const DECOY_LETTERS = 'XZQJWKVYBMP'.split('');

/**
 * SpeechBubbleTemplate - Speech bubble word builder.
 *
 * Bubbles float across the screen containing letters. The child uses different
 * volume levels to catch different-sized bubbles (whisper/normal/loud).
 * Caught correct letters fill in the word slots at top.
 *
 * Props:
 * - config: { title, questions: [{ word, hint }], difficulty, category }
 * - onComplete: (result) => void
 * - onAnswer: (isCorrect) => void
 */

const BUBBLE_SPEED_BASE = 4000; // ms to cross the screen

const FloatingBubble = ({
  bubble,
  amplitude,
  onCatch,
  screenHeight,
}) => {
  const translateX = useRef(new Animated.Value(-100)).current;
  const mountedRef = useRef(true);
  const caughtRef = useRef(false);

  // Pop animations
  const popScale = useRef(new Animated.Value(1)).current;
  const popOpacity = useRef(new Animated.Value(1)).current;
  const popRotate = useRef(new Animated.Value(0)).current;

  const sizeConfig = BUBBLE_SIZES[bubble.sizeCategory];
  const bubbleSize = sizeConfig.size;

  useEffect(() => {
    const duration = BUBBLE_SPEED_BASE + Math.random() * 2000;
    const anim = Animated.timing(translateX, {
      toValue: SCREEN_WIDTH + 100,
      duration,
      useNativeDriver: true,
    });
    anim.start(({finished}) => {
      if (finished && mountedRef.current && !caughtRef.current) {
        // Bubble escaped
        onCatch(bubble.id, false, false);
      }
    });

    return () => {
      mountedRef.current = false;
      anim.stop();
    };
  }, []);

  // Check if amplitude matches this bubble's range
  useEffect(() => {
    if (caughtRef.current) return;

    if (amplitude >= sizeConfig.minAmp && amplitude < sizeConfig.maxAmp) {
      caughtRef.current = true;

      if (bubble.isCorrect) {
        // Correct: shrink pop
        Animated.parallel([
          Animated.timing(popScale, {
            toValue: 0.1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(popOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (mountedRef.current) {
            onCatch(bubble.id, true, true);
          }
        });
      } else {
        // Wrong: poof (scale 0 + rotate)
        Animated.parallel([
          Animated.timing(popScale, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(popRotate, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(popOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (mountedRef.current) {
            onCatch(bubble.id, true, false);
          }
        });
      }
    }
  }, [amplitude]);

  const rotateInterp = popRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const colorSet = BUBBLE_COLORS[bubble.colorIndex % BUBBLE_COLORS.length];

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: bubbleSize,
          height: bubbleSize,
          borderRadius: bubbleSize / 2,
          backgroundColor: colorSet.fill,
          borderColor: colorSet.border,
          top: bubble.yPos,
          transform: [
            {translateX},
            {scale: popScale},
            {rotate: rotateInterp},
          ],
          opacity: popOpacity,
        },
      ]}>
      <Text
        style={[
          styles.bubbleLetter,
          {fontSize: bubbleSize * 0.45},
        ]}>
        {bubble.letter}
      </Text>
    </Animated.View>
  );
};

const SpeechBubbleTemplate = ({config, onComplete, onAnswer}) => {
  const questions = config?.questions || [];

  const [wordIndex, setWordIndex] = useState(0);
  const [filledLetters, setFilledLetters] = useState([]);
  const [activeBubbles, setActiveBubbles] = useState([]);
  const [score, setScore] = useState(0);
  const [totalCaught, setTotalCaught] = useState(0);
  const [correctCaught, setCorrectCaught] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const wordIndexRef = useRef(0);
  const filledRef = useRef([]);
  const bubbleIdCounter = useRef(0);
  const spawnTimerRef = useRef(null);

  const {amplitude, isListening, startListening, stopListening} =
    useMicAmplitude(1.0);

  const currentQuestion = questions[wordIndex] || {word: 'HELLO', hint: 'A greeting'};
  const targetWord = currentQuestion.word.toUpperCase();
  const targetLetters = targetWord.split('');

  // Voice meter animation
  const voiceLevelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(voiceLevelAnim, {
      toValue: amplitude,
      duration: 80,
      useNativeDriver: false,
    }).start();
  }, [amplitude]);

  // Start game
  useEffect(() => {
    startTimeRef.current = Date.now();
    filledRef.current = [];

    const timeout = setTimeout(() => {
      if (!mountedRef.current) return;
      startListening();
      setGameStarted(true);
    }, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      stopListening();
    };
  }, []);

  // Determine which letters still needed
  const neededLetters = useMemo(() => {
    const needed = [...targetLetters];
    filledLetters.forEach((l) => {
      const idx = needed.indexOf(l);
      if (idx !== -1) needed.splice(idx, 1);
    });
    return needed;
  }, [targetLetters, filledLetters]);

  // Spawn bubbles periodically
  useEffect(() => {
    if (!gameStarted) return;

    const spawnBubble = () => {
      if (!mountedRef.current) return;

      const id = bubbleIdCounter.current++;
      const sizeCategories = Object.keys(BUBBLE_SIZES);
      const sizeCategory =
        sizeCategories[Math.floor(Math.random() * sizeCategories.length)];

      // 40% chance of being a needed letter, 60% decoy
      const isCorrect =
        neededLetters.length > 0 && Math.random() < 0.4;
      const letter = isCorrect
        ? neededLetters[Math.floor(Math.random() * neededLetters.length)]
        : DECOY_LETTERS[Math.floor(Math.random() * DECOY_LETTERS.length)];

      const bubbleHeight = BUBBLE_SIZES[sizeCategory].size;
      const safeZoneTop = 160;
      const safeZoneBottom = 200;
      const availableHeight =
        SCREEN_HEIGHT - safeZoneTop - safeZoneBottom - bubbleHeight;
      const yPos =
        safeZoneTop + Math.random() * Math.max(availableHeight, 50);

      const newBubble = {
        id,
        letter,
        sizeCategory,
        isCorrect,
        yPos,
        colorIndex: id % BUBBLE_COLORS.length,
      };

      setActiveBubbles((prev) => [...prev.slice(-12), newBubble]); // max 13 active
    };

    spawnTimerRef.current = setInterval(spawnBubble, 1200);
    // Spawn first immediately
    spawnBubble();

    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    };
  }, [gameStarted, wordIndex]);

  const handleBubbleCatch = useCallback(
    (bubbleId, wasCaught, wasCorrect) => {
      if (!mountedRef.current) return;

      // Remove bubble from active list
      setActiveBubbles((prev) => prev.filter((b) => b.id !== bubbleId));

      if (!wasCaught) return; // escaped bubble

      setTotalCaught((prev) => prev + 1);

      if (wasCorrect) {
        setCorrectCaught((prev) => prev + 1);
        onAnswer(true);

        // Find the bubble's letter from our state
        setActiveBubbles((prev) => {
          // Already removed, but we need the letter
          return prev;
        });

        // We need to add the letter. Use a ref-based approach since
        // the bubble component already knows if it was correct.
        setFilledLetters((prev) => {
          const bubble = activeBubbles.find((b) => b.id === bubbleId);
          if (!bubble) return prev;
          const updated = [...prev, bubble.letter];
          filledRef.current = updated;
          return updated;
        });
      } else {
        onAnswer(false);
      }
    },
    [activeBubbles],
  );

  // Check word completion
  useEffect(() => {
    if (filledLetters.length >= targetLetters.length && targetLetters.length > 0) {
      if (!mountedRef.current) return;

      // Clear spawner
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }

      setScore((prev) => prev + targetLetters.length * 2);

      const timeout = setTimeout(() => {
        if (!mountedRef.current) return;

        const nextIndex = wordIndexRef.current + 1;
        if (nextIndex >= questions.length) {
          if (!completedRef.current) {
            completedRef.current = true;
            const totalTime = Math.floor(
              (Date.now() - startTimeRef.current) / 1000,
            );
            const accuracy =
              totalCaught > 0
                ? Math.round((correctCaught / totalCaught) * 100)
                : 0;
            onComplete({
              score: score + targetLetters.length * 2,
              total: questions.length,
              correct: correctCaught,
              wrong: totalCaught - correctCaught,
              timeSpent: totalTime,
            });
          }
        } else {
          wordIndexRef.current = nextIndex;
          setWordIndex(nextIndex);
          setFilledLetters([]);
          filledRef.current = [];
          setActiveBubbles([]);
          bubbleIdCounter.current = 0;
        }
      }, 1200);

      return () => clearTimeout(timeout);
    }
  }, [filledLetters, targetLetters.length]);

  // Voice level bar
  const voiceBarHeight = voiceLevelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200],
  });

  // Determine current voice zone
  const voiceZone =
    amplitude >= 0.6
      ? 'loud'
      : amplitude >= 0.3
      ? 'normal'
      : amplitude >= 0.1
      ? 'whisper'
      : 'silent';

  if (questions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyText}>No words to build!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.progressText}>
          Word {wordIndex + 1} / {questions.length}
        </Text>
        <Text style={styles.scoreText}>Score: {score}</Text>
      </View>

      {/* Hint */}
      {currentQuestion.hint && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>{currentQuestion.hint}</Text>
        </View>
      )}

      {/* Target word with letter slots */}
      <View style={styles.wordSlots}>
        {targetLetters.map((letter, index) => {
          const isFilled = index < filledLetters.length;
          return (
            <View
              key={index}
              style={[
                styles.letterSlot,
                isFilled && styles.letterSlotFilled,
              ]}>
              <Text
                style={[
                  styles.letterSlotText,
                  isFilled && styles.letterSlotTextFilled,
                ]}>
                {isFilled ? filledLetters[index] : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Bubble area */}
      <View style={styles.bubbleArea}>
        {activeBubbles.map((bubble) => (
          <FloatingBubble
            key={bubble.id}
            bubble={bubble}
            amplitude={amplitude}
            onCatch={handleBubbleCatch}
            screenHeight={SCREEN_HEIGHT}
          />
        ))}
      </View>

      {/* Voice level meter (left side) */}
      <View style={styles.voiceMeter}>
        <View style={styles.voiceMeterTrack}>
          {/* Zone indicators */}
          <View style={[styles.zoneMarker, {bottom: '60%'}]}>
            <Text style={styles.zoneText}>LOUD</Text>
          </View>
          <View style={[styles.zoneMarker, {bottom: '30%'}]}>
            <Text style={styles.zoneText}>MED</Text>
          </View>
          <View style={[styles.zoneMarker, {bottom: '10%'}]}>
            <Text style={styles.zoneText}>LOW</Text>
          </View>

          <Animated.View
            style={[
              styles.voiceMeterFill,
              {
                height: voiceBarHeight,
                backgroundColor:
                  voiceZone === 'loud'
                    ? '#E74C3C'
                    : voiceZone === 'normal'
                    ? '#2ECC71'
                    : voiceZone === 'whisper'
                    ? '#3498DB'
                    : '#E0E0E0',
              },
            ]}
          />
        </View>
        <Text style={styles.voiceZoneLabel}>
          {voiceZone === 'loud'
            ? '📢'
            : voiceZone === 'normal'
            ? '🗣️'
            : voiceZone === 'whisper'
            ? '🤫'
            : '🔇'}
        </Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          {voiceZone === 'silent'
            ? 'Use your voice to catch bubbles!'
            : voiceZone === 'whisper'
            ? 'Whisper catches small bubbles'
            : voiceZone === 'normal'
            ? 'Normal voice catches medium bubbles'
            : 'Loud voice catches big bubbles!'}
        </Text>
      </View>

      {/* Accuracy */}
      <View style={styles.accuracyRow}>
        <Text style={styles.accuracyText}>
          Accuracy: {totalCaught > 0 ? Math.round((correctCaught / totalCaught) * 100) : 0}%
        </Text>
      </View>
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
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.xs,
  },
  progressText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
  scoreText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.accent,
  },
  hintContainer: {
    backgroundColor: kidsColors.hintBg,
    marginHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.xs,
    paddingHorizontal: kidsSpacing.md,
    borderRadius: kidsBorderRadius.md,
    marginBottom: kidsSpacing.xs,
  },
  hintText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textPrimary,
    textAlign: 'center',
  },
  wordSlots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.sm,
  },
  letterSlot: {
    width: 36,
    height: 42,
    borderBottomWidth: 3,
    borderBottomColor: kidsColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterSlotFilled: {
    borderBottomColor: '#2ECC71',
    backgroundColor: 'rgba(46,204,113,0.1)',
    borderRadius: kidsBorderRadius.sm || 6,
  },
  letterSlotText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
  letterSlotTextFilled: {
    color: '#2ECC71',
  },
  bubbleArea: {
    flex: 1,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  bubbleLetter: {
    fontWeight: kidsFontWeight.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  voiceMeter: {
    position: 'absolute',
    left: 8,
    top: 180,
    alignItems: 'center',
  },
  voiceMeterTrack: {
    width: 24,
    height: 200,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  voiceMeterFill: {
    width: '100%',
    borderRadius: 12,
  },
  zoneMarker: {
    position: 'absolute',
    left: 28,
    zIndex: 1,
  },
  zoneText: {
    fontSize: 8,
    color: kidsColors.textMuted,
    fontWeight: kidsFontWeight.bold,
  },
  voiceZoneLabel: {
    fontSize: 18,
    marginTop: 4,
  },
  instructions: {
    paddingHorizontal: kidsSpacing.lg,
    paddingBottom: kidsSpacing.sm,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
    textAlign: 'center',
  },
  accuracyRow: {
    alignItems: 'center',
    paddingBottom: kidsSpacing.md,
  },
  accuracyText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textPrimary,
  },
});

export default SpeechBubbleTemplate;
