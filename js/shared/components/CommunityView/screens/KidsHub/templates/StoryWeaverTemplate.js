import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import useMicAmplitude from '../../../../../hooks/useMicAmplitude';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CONFIRM_THRESHOLD = 0.4;
const CONFIRM_DURATION_MS = 800;

const SCENE_COLORS = ['#E8F5E9', '#E3F2FD', '#FFF3E0', '#F3E5F5', '#FCE4EC'];
const SCENE_EMOJIS_DEFAULT = ['\uD83C\uDFF0', '\uD83C\uDF1F', '\uD83C\uDF0A', '\uD83C\uDF3F', '\u2728'];

const COLORS = {
  bg: '#FFF9E6',
  card: '#FFFFFF',
  accent: '#7C4DFF',
  correct: '#4CAF50',
  pink: '#FF80AB',
  yellow: '#FFD600',
  purple: '#B388FF',
  textPrimary: '#333333',
  textMuted: '#888888',
  choiceDefault: '#F5F5F5',
  choiceActive: '#EDE7F6',
  choiceConfirmed: '#C8E6C9',
};

const StoryWeaverTemplate = ({config, onComplete, onAnswer}) => {
  const questions = config?.questions || config?.content?.scenes || [];

  const {amplitude, isListening, startListening, stopListening} =
    useMicAmplitude(1.0);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [holdingChoice, setHoldingChoice] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [scenesCompleted, setScenesCompleted] = useState(0);

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const holdStartRef = useRef(null);
  const holdTimerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const choiceAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const currentScene = questions[sceneIndex] || null;

  useEffect(() => {
    startListening();
    // Animate choices in
    choiceAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: 300 + i * 100,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      mountedRef.current = false;
      stopListening();
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, []);

  // Track hold + amplitude for confirmation
  useEffect(() => {
    if (holdingChoice !== null && amplitude >= CONFIRM_THRESHOLD) {
      if (!holdStartRef.current) {
        holdStartRef.current = Date.now();
      }

      if (!holdTimerRef.current) {
        holdTimerRef.current = setInterval(() => {
          if (!mountedRef.current) return;
          const elapsed = Date.now() - (holdStartRef.current || Date.now());
          const progress = Math.min(elapsed / CONFIRM_DURATION_MS, 1);
          setHoldProgress(progress);

          if (progress >= 1) {
            clearInterval(holdTimerRef.current);
            holdTimerRef.current = null;
            confirmChoice(holdingChoice);
          }
        }, 50);
      }
    } else {
      // Reset if voice drops
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      holdStartRef.current = null;
      if (!confirmed) setHoldProgress(0);
    }

    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [holdingChoice, amplitude, confirmed]);

  const confirmChoice = useCallback(
    (choiceIdx) => {
      if (confirmed) return;
      setConfirmed(true);
      setSelectedChoice(choiceIdx);
      setScenesCompleted(prev => prev + 1);
      onAnswer(true);

      Animated.timing(progressAnim, {
        toValue: (sceneIndex + 1) / questions.length,
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Transition to next scene
      const timeout = setTimeout(() => {
        if (!mountedRef.current) return;

        const nextScenes = currentScene?.nextScenes;
        let nextIndex = sceneIndex + 1;
        if (nextScenes && nextScenes[choiceIdx] !== undefined) {
          nextIndex = nextScenes[choiceIdx];
        }

        if (nextIndex < questions.length) {
          // Fade transition
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            if (!mountedRef.current) return;
            setSceneIndex(nextIndex);
            setSelectedChoice(null);
            setHoldingChoice(null);
            setHoldProgress(0);
            setConfirmed(false);

            // Reset choice animations
            choiceAnims.forEach(anim => anim.setValue(0));

            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();

            // Animate choices in
            choiceAnims.forEach((anim, i) => {
              Animated.timing(anim, {
                toValue: 1,
                duration: 400,
                delay: 200 + i * 100,
                useNativeDriver: true,
              }).start();
            });
          });
        } else if (!completedRef.current) {
          completedRef.current = true;
          onComplete({
            score: scenesCompleted + 1,
            total: questions.length,
            correct: scenesCompleted + 1,
            wrong: 0,
            timeSpent: Math.round(
              (Date.now() - startTimeRef.current) / 1000,
            ),
          });
        }
      }, 1200);

      return () => clearTimeout(timeout);
    },
    [confirmed, sceneIndex, currentScene, questions.length, scenesCompleted],
  );

  const handlePressIn = (idx) => {
    if (confirmed) return;
    setHoldingChoice(idx);
  };

  const handlePressOut = () => {
    setHoldingChoice(null);
    holdStartRef.current = null;
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!confirmed) setHoldProgress(0);
  };

  if (questions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No story scenes available</Text>
      </View>
    );
  }

  const bgColor = SCENE_COLORS[sceneIndex % SCENE_COLORS.length];
  const sceneEmoji =
    currentScene?.emoji ||
    SCENE_EMOJIS_DEFAULT[sceneIndex % SCENE_EMOJIS_DEFAULT.length];
  const choices = currentScene?.choices || [];

  return (
    <Animated.View style={[styles.container, {backgroundColor: bgColor, opacity: fadeAnim}]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Story Weaver</Text>
        <Text style={styles.headerScene}>
          Scene {sceneIndex + 1}/{questions.length}
        </Text>
      </View>

      {/* Progress */}
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Scene illustration */}
      <View style={styles.illustrationArea}>
        <Text style={styles.sceneEmoji}>{sceneEmoji}</Text>
      </View>

      {/* Story text */}
      <View style={styles.storyCard}>
        <Text style={styles.storyText}>
          {currentScene?.scene || currentScene?.text || ''}
        </Text>
      </View>

      {/* Voice indicator */}
      <View style={styles.voiceHint}>
        <Text style={styles.voiceHintText}>
          {confirmed
            ? 'Choice confirmed!'
            : holdingChoice !== null
            ? amplitude >= CONFIRM_THRESHOLD
              ? 'Keep speaking to confirm...'
              : 'Speak while holding to confirm!'
            : 'Hold a choice + speak to select'}
        </Text>
      </View>

      {/* Choices */}
      <View style={styles.choicesArea}>
        {choices.map((choice, i) => {
          const isHolding = holdingChoice === i;
          const isConfirmed = confirmed && selectedChoice === i;

          return (
            <Animated.View
              key={i}
              style={{
                opacity: choiceAnims[i] || 1,
                transform: [
                  {
                    translateY: (choiceAnims[i] || new Animated.Value(1)).interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              }}>
              <TouchableOpacity
                style={[
                  styles.choiceButton,
                  isHolding && styles.choiceHolding,
                  isConfirmed && styles.choiceConfirmed,
                ]}
                onPressIn={() => handlePressIn(i)}
                onPressOut={handlePressOut}
                activeOpacity={0.8}
                disabled={confirmed}>
                {/* Hold progress bar */}
                {isHolding && !confirmed && (
                  <View style={styles.holdProgressBg}>
                    <View
                      style={[
                        styles.holdProgressFill,
                        {width: `${holdProgress * 100}%`},
                      ]}
                    />
                  </View>
                )}
                <Text style={styles.choiceText}>
                  {typeof choice === 'string' ? choice : choice.text || ''}
                </Text>
                {isConfirmed && (
                  <Text style={styles.confirmCheck}>{'\u2705'}</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.accent,
  },
  headerScene: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  illustrationArea: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sceneEmoji: {
    fontSize: 72,
  },
  storyCard: {
    backgroundColor: COLORS.card,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  storyText: {
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.textPrimary,
    lineHeight: 26,
    textAlign: 'center',
  },
  voiceHint: {
    alignItems: 'center',
    marginBottom: 12,
  },
  voiceHintText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
    fontStyle: 'italic',
  },
  choicesArea: {
    gap: 10,
    paddingBottom: 20,
  },
  choiceButton: {
    backgroundColor: COLORS.choiceDefault,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceHolding: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.choiceActive,
  },
  choiceConfirmed: {
    borderColor: COLORS.correct,
    backgroundColor: COLORS.choiceConfirmed,
  },
  choiceText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  confirmCheck: {
    fontSize: 20,
    marginLeft: 8,
  },
  holdProgressBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  holdProgressFill: {
    height: '100%',
    backgroundColor: COLORS.accent + '20',
  },
});

export default StoryWeaverTemplate;
