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
import TTSManager from '../shared/TTSManager';
import {SPRINGS} from '../shared/gameThemes';

/**
 * StoryBuilderTemplate - Choose-your-own-adventure branching story.
 *
 * Shows story text with scene illustration. Choices as large buttons.
 * Tracks "good" vs "bad" choices. Path-dependent scoring.
 * At end shows moral/lesson. Adapts with encouragement after bad choices.
 *
 * Props:
 * - config: { content: { story: { start, scenes } } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 */

const SCENE_ICONS = [
  'dog',
  'cat',
  'tree',
  'home',
  'school',
  'hospital-building',
  'forest',
  'city',
  'beach',
  'mountain',
];

const CHOICE_COLORS = [
  kidsColors.palette[0],
  kidsColors.palette[1],
  kidsColors.palette[4],
  kidsColors.palette[7],
];

const StoryBuilderTemplate = ({config, onAnswer, onComplete}) => {
  const content = config?.content || {};
  const story = content.story || {};
  const scenes = story.scenes || {};
  const startId = story.start || Object.keys(scenes)[0] || '';

  // Game state
  const [currentSceneId, setCurrentSceneId] = useState(startId);
  const [choiceHistory, setChoiceHistory] = useState([]); // { sceneId, choiceIndex, isGood, timeMs }
  const [goodChoices, setGoodChoices] = useState(0);
  const [badChoices, setBadChoices] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastChoiceGood, setLastChoiceGood] = useState(true);

  // Adaptive state
  const consecutiveBad = useRef(0);
  const sceneStartTime = useRef(Date.now());
  const sceneCount = useRef(0);
  const mountedRef = useRef(true);
  const ttsCleanupRef = useRef(null);

  useEffect(() => () => {
    mountedRef.current = false;
    TTSManager.stop();
  }, []);

  // Pre-cache all scene texts for TTS on mount
  const allSceneTexts = useMemo(() => {
    return Object.values(scenes)
      .map(s => s.text)
      .filter(Boolean);
  }, [scenes]);

  useEffect(() => {
    if (allSceneTexts.length > 0) {
      TTSManager.preCache(allSceneTexts, {voice: 'kids_narrator'}).catch(() => {});
    }
  }, [allSceneTexts]);

  // Animations
  const textAnim = useRef(new Animated.Value(0)).current;
  const choiceAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const iconAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  const currentScene = scenes[currentSceneId] || null;

  // Animate scene entrance
  useEffect(() => {
    if (!currentScene) return;

    sceneStartTime.current = Date.now();
    sceneCount.current += 1;

    // Reset animations
    textAnim.setValue(0);
    iconAnim.setValue(0);
    choiceAnims.forEach(a => a.setValue(0));

    // Animate icon
    Animated.spring(iconAnim, {
      toValue: 1,
      ...SPRINGS.playful,
    }).start();

    // Animate text fade in
    Animated.timing(textAnim, {
      toValue: 1,
      duration: 500,
      delay: 200,
      useNativeDriver: true,
    }).start();

    // Stagger choice buttons
    if (currentScene.choices) {
      currentScene.choices.forEach((_, i) => {
        Animated.spring(choiceAnims[i], {
          toValue: 1,
          ...SPRINGS.snappy,
          delay: 400 + i * 150,
        }).start();
      });
    }

    // Speak scene text via TTS (non-blocking, silent on failure)
    if (currentScene.text) {
      TTSManager.stop();
      // Delay slightly so animations start first
      const ttsTimeout = setTimeout(() => {
        if (mountedRef.current) {
          TTSManager.speak(currentScene.text, {voice: 'kids_narrator'}).catch(() => {});
        }
      }, 600);

      // Cleanup TTS timeout on scene change
      const cleanup = () => clearTimeout(ttsTimeout);
      // Store cleanup ref for next run
      if (ttsCleanupRef.current) ttsCleanupRef.current();
      ttsCleanupRef.current = cleanup;
    }

    // Check if end scene
    if (currentScene.isEnd) {
      setIsEnded(true);
    }
  }, [currentSceneId]);

  // Handle choice
  const handleChoice = useCallback(
    (choiceIndex) => {
      if (!currentScene || !currentScene.choices) return;
      const choice = currentScene.choices[choiceIndex];
      if (!choice) return;

      const responseTimeMs = Date.now() - sceneStartTime.current;
      const isGood = choice.isGood !== false; // Default to good if not specified

      // Record choice
      setChoiceHistory(prev => [
        ...prev,
        {
          sceneId: currentSceneId,
          choiceIndex,
          isGood,
          timeMs: responseTimeMs,
        },
      ]);

      // Update counts
      if (isGood) {
        setGoodChoices(prev => prev + 1);
        consecutiveBad.current = 0;
        setShowEncouragement(false);
      } else {
        setBadChoices(prev => prev + 1);
        consecutiveBad.current += 1;

        // Adapt: show encouragement after 3 bad choices
        if (consecutiveBad.current >= 3) {
          setShowEncouragement(true);
        }
      }

      // Show brief feedback
      setLastChoiceGood(isGood);
      setShowFeedback(true);

      // Report answer
      if (onAnswer) {
        onAnswer(isGood, currentScene.concept || `story:${currentSceneId}`, responseTimeMs);
      }

      // Stop any ongoing narration before navigating
      TTSManager.stop();

      // Navigate to next scene after feedback
      setTimeout(() => {
        if (!mountedRef.current) return;
        setShowFeedback(false);
        if (choice.next && scenes[choice.next]) {
          setCurrentSceneId(choice.next);
        } else {
          // No next scene = implicit end
          setIsEnded(true);
        }
      }, 800);
    },
    [currentScene, currentSceneId, scenes, onAnswer],
  );

  // Finish
  const handleFinish = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  // Get scene icon based on scene ID or index
  const getSceneIcon = useCallback((sceneId) => {
    const scene = scenes[sceneId];
    if (scene?.icon) return scene.icon;
    const hash = sceneId
      .split('')
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return SCENE_ICONS[hash % SCENE_ICONS.length];
  }, [scenes]);

  // Render end screen
  if (isEnded) {
    const totalChoices = goodChoices + badChoices;
    const goodPercent =
      totalChoices > 0 ? Math.round((goodChoices / totalChoices) * 100) : 0;
    const endMessage = currentScene?.message || 'Every choice matters!';

    let rating = 'Great Job!';
    let ratingIcon = 'star';
    let ratingColor = kidsColors.star;
    if (goodPercent >= 80) {
      rating = 'Amazing Choices!';
      ratingIcon = 'star-circle';
      ratingColor = kidsColors.starGold;
    } else if (goodPercent >= 50) {
      rating = 'Good Effort!';
      ratingIcon = 'star-half-full';
      ratingColor = kidsColors.starSilver;
    } else {
      rating = 'Keep Learning!';
      ratingIcon = 'heart';
      ratingColor = kidsColors.english;
    }

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.endContainer}>
          <Icon name="book-open-variant" size={70} color={kidsColors.accent} />
          <Text style={styles.endTitle}>The End</Text>

          {/* End message / moral */}
          <View style={styles.moralCard}>
            <Icon name="format-quote-open" size={24} color={kidsColors.accent} />
            <Text style={styles.moralText}>{endMessage}</Text>
          </View>

          {/* Rating */}
          <View style={styles.ratingRow}>
            <Icon name={ratingIcon} size={40} color={ratingColor} />
            <Text style={[styles.ratingText, {color: ratingColor}]}>
              {rating}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Icon
                name="thumb-up"
                size={24}
                color={kidsColors.correct}
              />
              <Text style={styles.statValue}>{goodChoices}</Text>
              <Text style={styles.statLabel}>Good Choices</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Icon
                name="thumb-down"
                size={24}
                color={kidsColors.incorrect}
              />
              <Text style={styles.statValue}>{badChoices}</Text>
              <Text style={styles.statLabel}>Bad Choices</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Icon
                name="map-marker-path"
                size={24}
                color={kidsColors.accent}
              />
              <Text style={styles.statValue}>{sceneCount.current}</Text>
              <Text style={styles.statLabel}>Scenes</Text>
            </View>
          </View>

          {/* Journey timeline */}
          <Text style={styles.journeyTitle}>Your Journey:</Text>
          <View style={styles.timeline}>
            {choiceHistory.map((entry, i) => (
              <View key={i} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: entry.isGood
                        ? kidsColors.correct
                        : kidsColors.incorrect,
                    },
                  ]}
                />
                {i < choiceHistory.length - 1 && (
                  <View style={styles.timelineLine} />
                )}
              </View>
            ))}
          </View>

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
        </ScrollView>
      </View>
    );
  }

  if (!currentScene) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Story scene not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Feedback overlay */}
      <FeedbackOverlay
        visible={showFeedback}
        isCorrect={lastChoiceGood}
        message={lastChoiceGood ? 'Kind choice!' : 'Hmm, think again next time...'}
        onDismiss={() => {}}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}>
        {/* Scene progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.choiceCounters}>
            <View style={styles.counterBadge}>
              <Icon name="thumb-up" size={14} color={kidsColors.correct} />
              <Text style={[styles.counterText, {color: kidsColors.correct}]}>
                {goodChoices}
              </Text>
            </View>
            <View style={styles.counterBadge}>
              <Icon name="thumb-down" size={14} color={kidsColors.incorrect} />
              <Text style={[styles.counterText, {color: kidsColors.incorrect}]}>
                {badChoices}
              </Text>
            </View>
          </View>
          <Text style={styles.sceneNumber}>
            Scene {sceneCount.current}
          </Text>
        </View>

        {/* Scene Illustration */}
        <Animated.View
          style={[
            styles.sceneIllustration,
            {
              transform: [
                {
                  scale: iconAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ],
              opacity: iconAnim,
            },
          ]}>
          <View style={styles.sceneIconCircle}>
            <Icon
              name={getSceneIcon(currentSceneId)}
              size={60}
              color={kidsColors.textOnDark}
            />
          </View>
        </Animated.View>

        {/* Story Text */}
        <Animated.View style={[styles.storyTextCard, {opacity: textAnim}]}>
          <Text style={styles.storyText}>{currentScene.text}</Text>
        </Animated.View>

        {/* Encouragement banner (adaptive) */}
        {showEncouragement && (
          <View style={styles.encouragementBanner}>
            <Icon name="heart" size={20} color={kidsColors.english} />
            <Text style={styles.encouragementText}>
              Think about what would make others feel happy. What is the kind
              thing to do?
            </Text>
          </View>
        )}

        {/* Choices */}
        {currentScene.choices && (
          <View style={styles.choicesContainer}>
            {currentScene.choices.map((choice, index) => {
              const choiceAnim = choiceAnims[index] || new Animated.Value(1);
              return (
                <Animated.View
                  key={index}
                  style={{
                    transform: [
                      {
                        translateY: choiceAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [50, 0],
                        }),
                      },
                    ],
                    opacity: choiceAnim,
                  }}>
                  <TouchableOpacity
                    style={[
                      styles.choiceButton,
                      {
                        backgroundColor:
                          CHOICE_COLORS[index % CHOICE_COLORS.length],
                      },
                    ]}
                    onPress={() => handleChoice(index)}
                    activeOpacity={0.8}
                    disabled={showFeedback}>
                    <Icon
                      name={
                        choice.icon ||
                        (index === 0
                          ? 'hand-pointing-right'
                          : index === 1
                          ? 'hand-pointing-right'
                          : 'hand-pointing-right')
                      }
                      size={24}
                      color={kidsColors.textOnDark}
                    />
                    <Text style={styles.choiceLabel}>{choice.label}</Text>
                    {/* Subtle hint for good choice when encouragement is on */}
                    {showEncouragement && choice.isGood && (
                      <Icon
                        name="star-four-points"
                        size={16}
                        color="rgba(255,255,255,0.7)"
                      />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: kidsSpacing.xxl,
  },
  // Progress row
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: kidsSpacing.lg,
    paddingTop: kidsSpacing.md,
  },
  choiceCounters: {
    flexDirection: 'row',
    gap: kidsSpacing.sm,
  },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: kidsColors.card,
    paddingHorizontal: kidsSpacing.sm,
    paddingVertical: kidsSpacing.xs,
    borderRadius: kidsBorderRadius.full,
    ...kidsShadows.card,
  },
  counterText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
  },
  sceneNumber: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
    fontWeight: kidsFontWeight.medium,
  },
  // Scene illustration
  sceneIllustration: {
    alignItems: 'center',
    paddingVertical: kidsSpacing.lg,
  },
  sceneIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: kidsColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...kidsShadows.float,
  },
  // Story text
  storyTextCard: {
    backgroundColor: kidsColors.card,
    marginHorizontal: kidsSpacing.lg,
    padding: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.xl,
    ...kidsShadows.card,
    marginBottom: kidsSpacing.lg,
  },
  storyText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textPrimary,
    lineHeight: 32,
    textAlign: 'center',
  },
  // Encouragement
  encouragementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.incorrectLight,
    marginHorizontal: kidsSpacing.lg,
    padding: kidsSpacing.md,
    borderRadius: kidsBorderRadius.md,
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.md,
    borderWidth: 1,
    borderColor: kidsColors.english,
  },
  encouragementText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  // Choices
  choicesContainer: {
    paddingHorizontal: kidsSpacing.lg,
    gap: kidsSpacing.md,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: kidsSpacing.lg,
    paddingHorizontal: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.xl,
    gap: kidsSpacing.md,
    ...kidsShadows.button,
  },
  choiceLabel: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
    flex: 1,
  },
  // End screen
  endContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kidsSpacing.xl,
    paddingBottom: kidsSpacing.xxl,
  },
  endTitle: {
    fontSize: kidsFontSize.display,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.accent,
    marginTop: kidsSpacing.md,
    marginBottom: kidsSpacing.lg,
  },
  moralCard: {
    backgroundColor: kidsColors.card,
    padding: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.xl,
    alignItems: 'center',
    marginBottom: kidsSpacing.lg,
    ...kidsShadows.card,
    width: '100%',
  },
  moralText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
    marginTop: kidsSpacing.sm,
    fontStyle: 'italic',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.lg,
  },
  ratingText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.lg,
    ...kidsShadows.card,
    width: '100%',
    marginBottom: kidsSpacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textPrimary,
  },
  statLabel: {
    fontSize: kidsFontSize.xs,
    color: kidsColors.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: kidsColors.border,
    marginHorizontal: kidsSpacing.sm,
  },
  journeyTitle: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textSecondary,
    marginBottom: kidsSpacing.sm,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: kidsSpacing.xl,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelineLine: {
    width: 20,
    height: 3,
    backgroundColor: kidsColors.border,
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
    marginTop: kidsSpacing.sm,
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

export default StoryBuilderTemplate;
