/**
 * GameShell - Composable Game Isolation Container
 *
 * Provides LingoKids/Khan Academy-level UX wrapping around any game template:
 *
 * 1. ISOLATION: Each game runs in its own context with lifecycle management
 * 2. COMPOSABILITY: Any template plugs in via children/render props
 * 3. TRANSITIONS: Smooth enter/exit animations between game states
 * 4. HAPTIC FEEDBACK: Vibration patterns for correct/wrong/streak
 * 5. CELEBRATION SYSTEM: Confetti, star bursts, streak fire animations
 * 6. SOUND HOOKS: Abstracted sound cue triggers (delegated to native)
 * 7. ADAPTIVE UI: Layout adjusts based on performance and engagement
 * 8. LOADING STATES: Shimmer placeholders while content loads
 * 9. PAUSE/RESUME: Game state preserved on background/foreground
 * 10. ACCESSIBILITY: Large touch targets, high contrast, screen reader support
 *
 * Usage:
 * <GameShell config={gameConfig} onComplete={handleComplete}>
 *   {(shellProps) => <MultipleChoiceTemplate {...shellProps} />}
 * </GameShell>
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, createContext, useContext,
} from 'react';
import {
  View, Text, Animated, StyleSheet, Vibration, AppState, Dimensions,
  Platform, AccessibilityInfo,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize,
  kidsFontWeight, kidsShadows,
} from '../../../../theme/kidsColors';
import GameHeader from './GameHeader';
import GameComplete from './GameComplete';
import StarReward from './StarReward';
import StreakFire from './StreakFire';
import GameSounds from './shared/SoundManager';
import MediaCacheManager from './shared/MediaCacheManager';
import {getGameTheme, resolveTemplateType, SPRINGS} from './shared/gameThemes';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// ── Game Shell Context ─────────────────────────────────────────────
export const GameShellContext = createContext(null);

export const useGameShell = () => {
  const ctx = useContext(GameShellContext);
  if (!ctx) throw new Error('useGameShell must be used inside GameShell');
  return ctx;
};

// ── Haptic Patterns ────────────────────────────────────────────────
const HAPTIC = {
  correct: Platform.OS === 'android' ? [0, 30] : [0, 20],
  wrong: Platform.OS === 'android' ? [0, 50, 50, 50] : [0, 40, 30, 40],
  streak: Platform.OS === 'android' ? [0, 20, 30, 20, 30, 20] : [0, 15, 20, 15, 20, 15],
  complete: Platform.OS === 'android' ? [0, 50, 100, 50, 100, 80] : [0, 40, 80, 40, 80, 60],
  tap: Platform.OS === 'android' ? [0, 10] : [0, 8],
};

// ── Confetti Particle ──────────────────────────────────────────────
const ConfettiParticle = ({delay, color, startX}) => {
  const fallAnim = useRef(new Animated.Value(0)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim = null;
    const timeout = setTimeout(() => {
      anim = Animated.parallel([
        Animated.timing(fallAnim, {
          toValue: 1,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(swayAnim, {toValue: 1, duration: 300 + Math.random() * 200, useNativeDriver: true}),
            Animated.timing(swayAnim, {toValue: -1, duration: 300 + Math.random() * 200, useNativeDriver: true}),
          ]),
        ),
        Animated.loop(
          Animated.timing(rotateAnim, {toValue: 1, duration: 600, useNativeDriver: true}),
        ),
      ]);
      anim.start();
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (anim) anim.stop();
    };
  }, []);

  const translateY = fallAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, SCREEN_HEIGHT + 20],
  });
  const translateX = swayAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-20, 20],
  });
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const opacity = fallAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          left: startX,
          backgroundColor: color,
          transform: [{translateY}, {translateX}, {rotate}],
          opacity,
        },
      ]}
    />
  );
};

// ── Star Burst Effect ──────────────────────────────────────────────
const StarBurst = ({visible, count = 5}) => {
  if (!visible) return null;
  return (
    <View style={styles.starBurstContainer} pointerEvents="none">
      {Array.from({length: count}).map((_, i) => (
        <Animatable.View
          key={i}
          animation="zoomIn"
          delay={i * 80}
          duration={400}
          style={[
            styles.starBurstItem,
            {
              transform: [
                {rotate: `${(i * 360) / count}deg`},
                {translateY: -40},
              ],
            },
          ]}
        >
          <Icon name="star" size={20} color={kidsColors.star} />
        </Animatable.View>
      ))}
    </View>
  );
};

// ── Loading Shimmer ────────────────────────────────────────────────
const LoadingShimmer = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {toValue: 1, duration: 1000, useNativeDriver: true}),
        Animated.timing(shimmerAnim, {toValue: 0, duration: 1000, useNativeDriver: true}),
      ]),
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.shimmerContainer}>
      {[0.7, 0.5, 0.9, 0.6, 0.4].map((width, i) => (
        <Animated.View
          key={i}
          style={[
            styles.shimmerBar,
            {width: `${width * 100}%`, opacity},
          ]}
        />
      ))}
    </View>
  );
};

// ── Main GameShell Component ───────────────────────────────────────
const GameShell = ({
  config,
  onComplete,
  onExit,
  intelligenceStore,
  children,
}) => {
  // ── Game Lifecycle State ──
  const [phase, setPhase] = useState('loading'); // loading | intro | playing | paused | complete
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [starsEarned, setStarsEarned] = useState(0);
  const [showStar, setShowStar] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showStarBurst, setShowStarBurst] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Animations
  const introAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const completeAnim = useRef(new Animated.Value(0)).current;

  // Timers
  const startTimeRef = useRef(Date.now());
  const timerInterval = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Media cleanup on unmount
  useEffect(() => {
    return () => {
      GameSounds.cleanup();
    };
  }, []);

  // Resolve template type and theme
  const templateType = useMemo(() => resolveTemplateType(config), [config]);
  const gameTheme = useMemo(() => getGameTheme(templateType), [templateType]);

  // Confetti particles — colored per game theme
  const confettiParticles = useMemo(() =>
    Array.from({length: 30}).map((_, i) => ({
      id: i,
      delay: Math.random() * 800,
      color: gameTheme.confetti[i % gameTheme.confetti.length],
      startX: Math.random() * SCREEN_WIDTH,
    })), [gameTheme]);

  // ── Accessibility ──
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setIsReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsReducedMotion);
    return () => sub?.remove?.();
  }, []);

  // ── App State (pause/resume) ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        if (phase === 'playing') setPhase('paused');
        GameSounds.pauseBackgroundMusic();
      }
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        if (phase === 'paused') setPhase('playing');
        GameSounds.resumeBackgroundMusic();
      }
      appStateRef.current = nextState;
    });
    return () => sub?.remove?.();
  }, [phase]);

  // ── Timer ──
  useEffect(() => {
    if (phase === 'playing') {
      startTimeRef.current = Date.now() - elapsedTime;
      timerInterval.current = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [phase]);

  // ── Phase Transitions (themed per game type) ──
  useEffect(() => {
    if (phase === 'loading') {
      // Brief loading shimmer, then intro
      const t = setTimeout(() => setPhase('intro'), 600);
      return () => clearTimeout(t);
    }
    if (phase === 'intro') {
      // Animate intro card — uses SPRINGS.smooth instead of hardcoded friction/tension
      Animated.spring(introAnim, {toValue: 1, ...SPRINGS.smooth}).start();
      // Start background music — use theme-specific bgm category, fall back to generic
      const bgmKey = `bgm_${gameTheme.bgmCategory || config?.category || 'general'}_happy`;
      MediaCacheManager.get(bgmKey).then(path => {
        if (path) GameSounds.startBackgroundMusic(path, {fadeInMs: 2000, volume: 0.2});
      }).catch(() => {});
      // Auto-transition to playing
      const t = setTimeout(() => {
        Animated.timing(introAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setPhase('playing'));
      }, 1500);
      return () => clearTimeout(t);
    }
    if (phase === 'playing') {
      Animated.spring(contentAnim, {toValue: 1, ...SPRINGS.smooth}).start();
    }
    if (phase === 'complete') {
      Animated.spring(completeAnim, {toValue: 1, ...SPRINGS.bouncy}).start();
      // Stop background music for completion
      GameSounds.stopBackgroundMusic({fadeOutMs: 500});
    }
  }, [phase, gameTheme]);

  // ── Haptic + Sound Feedback (via centralized SoundManager) ──
  const triggerHaptic = useCallback((type) => {
    if (isReducedMotion) return;
    // Delegate to GameSounds which handles both haptic and audio
    if (type === 'correct') GameSounds.correct();
    else if (type === 'wrong') GameSounds.wrong();
    else if (type === 'streak') GameSounds.streak(streak);
    else if (type === 'complete') GameSounds.complete(correctCount === totalAnswered);
    else if (type === 'tap') GameSounds.tap();
  }, [isReducedMotion, streak, correctCount, totalAnswered]);

  // ── Answer Handler (called by template) ──
  const handleAnswer = useCallback((isCorrect, concept, responseTimeMs) => {
    setTotalAnswered(prev => prev + 1);

    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      setStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > bestStreak) setBestStreak(newStreak);

        // Streak multiplier for stars
        let stars = config.rewards?.starsPerCorrect || 1;
        if (newStreak >= 5) stars *= 3;
        else if (newStreak >= 3) stars *= 2;
        setStarsEarned(s => s + stars);
        setScore(s => s + stars * 10);

        // Show star animation
        if (!isReducedMotion) {
          setShowStar(true);
          setTimeout(() => {
            if (mountedRef.current) setShowStar(false);
          }, 800);
        }

        // Streak milestone celebrations
        if (newStreak === 3 || newStreak === 5 || newStreak === 10) {
          triggerHaptic('streak');
          if (!isReducedMotion) {
            setShowStarBurst(true);
            setTimeout(() => {
              if (mountedRef.current) setShowStarBurst(false);
            }, 600);
          }
        } else {
          triggerHaptic('correct');
        }

        return newStreak;
      });
    } else {
      setStreak(0);
      triggerHaptic('wrong');
    }

    // Report to 3R intelligence
    if (intelligenceStore?.recordConceptAnswer) {
      intelligenceStore.recordConceptAnswer(concept, isCorrect, responseTimeMs);
    }
  }, [config, bestStreak, isReducedMotion, intelligenceStore, triggerHaptic]);

  // ── Complete Handler (called by template) ──
  const handleComplete = useCallback(() => {
    triggerHaptic('complete');

    // Perfect game bonus
    if (correctCount === totalAnswered && totalAnswered > 0) {
      const bonus = config.rewards?.bonusStars || 5;
      setStarsEarned(s => s + bonus);
    }

    // Show confetti for good performance
    const accuracy = totalAnswered > 0 ? correctCount / totalAnswered : 0;
    if (accuracy >= 0.7 && !isReducedMotion) {
      setShowConfetti(true);
    }

    setPhase('complete');

    // Report completion
    if (onComplete) {
      onComplete({
        gameId: config.id,
        score,
        starsEarned,
        correctCount,
        totalAnswered,
        accuracy,
        bestStreak,
        elapsedTimeMs: elapsedTime,
      });
    }
  }, [correctCount, totalAnswered, score, starsEarned, bestStreak, elapsedTime, config, isReducedMotion, triggerHaptic, onComplete]);

  // ── Context value (shared with template via useGameShell) ──
  const shellContext = useMemo(() => ({
    config,
    phase,
    score,
    streak,
    bestStreak,
    starsEarned,
    correctCount,
    totalAnswered,
    elapsedTime,
    isReducedMotion,
    triggerHaptic,
    speakText: GameSounds.speakText,
    templateType,
    gameTheme,
    feedbackStyle: gameTheme.feedbackStyle,
  }), [config, phase, score, streak, bestStreak, starsEarned, correctCount, totalAnswered, elapsedTime, isReducedMotion, triggerHaptic, templateType, gameTheme]);

  // ── Template props (passed to children render function) ──
  const templateProps = useMemo(() => ({
    config,
    onAnswer: handleAnswer,
    onComplete: handleComplete,
  }), [config, handleAnswer, handleComplete]);

  // ── Render ──
  return (
    <GameShellContext.Provider value={shellContext}>
      <View style={styles.container}>
        {/* Header - always visible during play */}
        {phase === 'playing' && (
          <GameHeader
            title={config.title}
            score={score}
            streak={streak}
            onBack={onExit}
            totalQuestions={config.questionsPerSession || 10}
            questionsAnswered={totalAnswered}
          />
        )}

        {/* Loading Phase */}
        {phase === 'loading' && <LoadingShimmer />}

        {/* Intro Phase */}
        {phase === 'intro' && (
          <Animated.View
            style={[
              styles.introContainer,
              {
                opacity: introAnim,
                transform: [{
                  scale: introAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                }],
              },
            ]}
          >
            <Animatable.View animation={gameTheme.entrAnim || 'bounceIn'} duration={gameTheme.entrDuration || 500} style={styles.introCard}>
              <View style={[styles.introIcon, {backgroundColor: config.color + '20'}]}>
                <Icon name={config.icon || 'gamepad-variant'} size={48} color={config.color} />
              </View>
              <Text style={styles.introTitle}>{config.title}</Text>
              <Text style={styles.introSubtitle}>
                {config.learningObjectives?.join(' | ') || 'Let\'s learn!'}
              </Text>
              <View style={styles.introBadges}>
                <View style={styles.introBadge}>
                  <Icon name="star" size={14} color={kidsColors.star} />
                  <Text style={styles.introBadgeText}>
                    {config.rewards?.starsPerCorrect || 1} per correct
                  </Text>
                </View>
                <View style={styles.introBadge}>
                  <Icon name="clock-outline" size={14} color={kidsColors.textMuted} />
                  <Text style={styles.introBadgeText}>
                    ~{config.estimatedMinutes || 3} min
                  </Text>
                </View>
              </View>
            </Animatable.View>
          </Animated.View>
        )}

        {/* Playing Phase */}
        {phase === 'playing' && (
          <Animated.View
            style={[
              styles.gameArea,
              {
                opacity: contentAnim,
                transform: [{
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                }],
              },
            ]}
          >
            {typeof children === 'function' ? children(templateProps) : children}
          </Animated.View>
        )}

        {/* Paused Overlay */}
        {phase === 'paused' && (
          <Animatable.View animation="fadeIn" style={styles.pauseOverlay}>
            <Animatable.View animation="bounceIn" style={styles.pauseCard}>
              <Icon name="pause-circle" size={64} color={kidsColors.accent} />
              <Text style={styles.pauseTitle}>Game Paused</Text>
              <Text style={styles.pauseText}>Come back when you're ready!</Text>
            </Animatable.View>
          </Animatable.View>
        )}

        {/* Complete Phase */}
        {phase === 'complete' && (
          <Animated.View
            style={[
              styles.completeContainer,
              {
                opacity: completeAnim,
                transform: [{
                  scale: completeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                }],
              },
            ]}
          >
            <GameComplete
              templateType={templateType}
              result={{
                correct: correctCount,
                total: totalAnswered,
                stars: starsEarned,
                bestStreak: bestStreak,
                accuracy: totalAnswered > 0 ? correctCount / totalAnswered : 0,
              }}
              onPlayAgain={() => {
                setPhase('loading');
                setScore(0);
                setTotalAnswered(0);
                setCorrectCount(0);
                setStreak(0);
                setBestStreak(0);
                setStarsEarned(0);
                setElapsedTime(0);
                setShowConfetti(false);
              }}
              onHome={onExit}
            />
          </Animated.View>
        )}

        {/* ── Celebration Overlays (above everything) ── */}
        <StarReward visible={showStar} />

        <StarBurst visible={showStarBurst} />

        {streak >= 3 && phase === 'playing' && (
          <View style={styles.streakContainer} pointerEvents="none">
            <StreakFire streak={streak} visible={true} />
          </View>
        )}

        {/* Confetti celebration */}
        {showConfetti && (
          <View style={styles.confettiContainer} pointerEvents="none">
            {confettiParticles.map(p => (
              <ConfettiParticle
                key={p.id}
                delay={p.delay}
                color={p.color}
                startX={p.startX}
              />
            ))}
          </View>
        )}
      </View>
    </GameShellContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
  },
  // Loading
  shimmerContainer: {
    flex: 1,
    padding: kidsSpacing.xl,
    gap: kidsSpacing.md,
    justifyContent: 'center',
  },
  shimmerBar: {
    height: 20,
    backgroundColor: kidsColors.border,
    borderRadius: kidsBorderRadius.sm,
    marginBottom: kidsSpacing.md,
  },
  // Intro
  introContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kidsSpacing.xl,
  },
  introCard: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.xxl,
    alignItems: 'center',
    ...kidsShadows.float,
    width: '90%',
    maxWidth: 340,
  },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: kidsSpacing.md,
  },
  introTitle: {
    fontSize: kidsFontSize.xxl || 28,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    marginBottom: kidsSpacing.xs,
  },
  introSubtitle: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
    textAlign: 'center',
    marginBottom: kidsSpacing.lg,
  },
  introBadges: {
    flexDirection: 'row',
    gap: kidsSpacing.md,
  },
  introBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
    backgroundColor: kidsColors.backgroundSecondary,
    paddingHorizontal: kidsSpacing.sm,
    paddingVertical: kidsSpacing.xs,
    borderRadius: kidsBorderRadius.full,
  },
  introBadgeText: {
    fontSize: kidsFontSize.xs,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textSecondary,
  },
  // Game Area
  gameArea: {
    flex: 1,
  },
  // Pause
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  pauseCard: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.xxl,
    alignItems: 'center',
    ...kidsShadows.float,
  },
  pauseTitle: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    marginTop: kidsSpacing.md,
  },
  pauseText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textMuted,
    marginTop: kidsSpacing.xs,
  },
  // Complete
  completeContainer: {
    flex: 1,
  },
  // Celebrations
  streakContainer: {
    position: 'absolute',
    top: 60,
    right: kidsSpacing.md,
    zIndex: 50,
  },
  starBurstContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 - 40,
    left: SCREEN_WIDTH / 2 - 40,
    width: 80,
    height: 80,
    zIndex: 200,
  },
  starBurstItem: {
    position: 'absolute',
    top: 30,
    left: 30,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
  },
  confettiParticle: {
    position: 'absolute',
    width: 8,
    height: 12,
    borderRadius: 2,
  },
});

export default GameShell;
