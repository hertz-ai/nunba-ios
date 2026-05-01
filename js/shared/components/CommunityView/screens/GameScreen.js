import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import { useNavigation, useRoute } from '@react-navigation/native';

import { gamesApi } from '../../../services/socialApi';
import useMultiplayerSync from '../../../hooks/useMultiplayerSync';
import MultiplayerLobby from '../components/Games/MultiplayerLobby';
import PhaserWebViewBridge from '../components/Games/PhaserWebViewBridge';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
} from '../../../theme/colors';

// ---------------------------------------------------------------------------
// Inline Trivia Engine (RN)
// ---------------------------------------------------------------------------

const ANSWER_FLASH_MS = 1200;
const DEFAULT_TIMER = 15;

const TriviaEngineRN = ({ questions: propQuestions, onComplete, multiplayer }) => {
  const [questions, setQuestions] = useState(propQuestions || []);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [timer, setTimer] = useState(DEFAULT_TIMER);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Load questions from multiplayer state if not provided
  useEffect(() => {
    if (multiplayer?.state?.questions && (!propQuestions || propQuestions.length === 0)) {
      setQuestions(multiplayer.state.questions);
    }
  }, [multiplayer?.state?.questions, propQuestions]);

  // Timer countdown
  useEffect(() => {
    if (finished || selectedAnswer !== null || questions.length === 0) return;
    setTimer(DEFAULT_TIMER);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIdx, finished, questions.length]);

  const handleTimeUp = useCallback(() => {
    if (questions.length === 0) return;
    const q = questions[currentIdx];
    const correct = q.correct_answer || q.answer || q.options?.[0];
    setCorrectAnswer(correct);
    setTimeout(() => advanceQuestion(), ANSWER_FLASH_MS);
  }, [currentIdx, questions]);

  const handleAnswer = useCallback(
    (answer) => {
      if (selectedAnswer !== null || finished) return;
      if (timerRef.current) clearInterval(timerRef.current);

      const q = questions[currentIdx];
      const correct = q.correct_answer || q.answer || q.options?.[0];
      const isCorrect = answer === correct;

      setSelectedAnswer(answer);
      setCorrectAnswer(correct);

      if (isCorrect) {
        setScore((prev) => prev + 1);
      }

      // Flash animation
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();

      setTimeout(() => advanceQuestion(), ANSWER_FLASH_MS);
    },
    [selectedAnswer, finished, currentIdx, questions, flashAnim],
  );

  const advanceQuestion = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= questions.length) {
      setFinished(true);
      if (onComplete) onComplete(score);
      return;
    }
    setCurrentIdx(nextIdx);
    setSelectedAnswer(null);
    setCorrectAnswer(null);
  }, [currentIdx, questions.length, score, onComplete]);

  if (questions.length === 0) {
    return (
      <View style={triviaStyles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={triviaStyles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  if (finished) {
    return (
      <Animatable.View animation="bounceIn" style={triviaStyles.finishedContainer}>
        <Icon name="trophy" size={64} color={colors.pulse} />
        <Text style={triviaStyles.finishedTitle}>Round Complete!</Text>
        <Text style={triviaStyles.finishedScore}>
          {score} / {questions.length}
        </Text>
      </Animatable.View>
    );
  }

  const q = questions[currentIdx];
  const options = q.options || q.incorrect_answers
    ? [...(q.incorrect_answers || []), q.correct_answer].sort()
    : [];

  const getOptionStyle = (option) => {
    if (selectedAnswer === null) return triviaStyles.optionDefault;
    if (option === correctAnswer) return triviaStyles.optionCorrect;
    if (option === selectedAnswer && option !== correctAnswer)
      return triviaStyles.optionIncorrect;
    return triviaStyles.optionDimmed;
  };

  return (
    <View style={triviaStyles.container}>
      {/* Progress + Timer */}
      <View style={triviaStyles.topBar}>
        <Text style={triviaStyles.progress}>
          {currentIdx + 1} / {questions.length}
        </Text>
        <View style={triviaStyles.timerWrap}>
          <Icon
            name="timer-outline"
            size={18}
            color={timer <= 5 ? colors.error : colors.textSecondary}
          />
          <Text
            style={[
              triviaStyles.timerText,
              timer <= 5 && { color: colors.error },
            ]}
          >
            {timer}s
          </Text>
        </View>
        <View style={triviaStyles.scoreBadge}>
          <Icon name="star" size={16} color={colors.pulse} />
          <Text style={triviaStyles.scoreText}>{score}</Text>
        </View>
      </View>

      {/* Timer bar */}
      <View style={triviaStyles.timerBar}>
        <Animated.View
          style={[
            triviaStyles.timerFill,
            {
              width: `${(timer / DEFAULT_TIMER) * 100}%`,
              backgroundColor: timer <= 5 ? colors.error : colors.accent,
            },
          ]}
        />
      </View>

      {/* Question */}
      <Animatable.View animation="fadeIn" key={currentIdx} style={triviaStyles.questionWrap}>
        <Text style={triviaStyles.questionText}>
          {q.question || q.text}
        </Text>
      </Animatable.View>

      {/* Options (2x2 grid) */}
      <View style={triviaStyles.optionsGrid}>
        {options.map((option, idx) => (
          <TouchableOpacity
            key={idx}
            style={[triviaStyles.optionBtn, getOptionStyle(option)]}
            onPress={() => handleAnswer(option)}
            disabled={selectedAnswer !== null}
            activeOpacity={0.7}
          >
            <Text style={triviaStyles.optionLetter}>
              {String.fromCharCode(65 + idx)}
            </Text>
            <Text style={triviaStyles.optionText} numberOfLines={3}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const triviaStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progress: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.pulse + '20',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  scoreText: {
    color: colors.pulse,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  timerBar: {
    height: 4,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  timerFill: {
    height: '100%',
    borderRadius: 2,
  },
  questionWrap: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    minHeight: 120,
    justifyContent: 'center',
    ...shadows.md,
  },
  questionText: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    lineHeight: 28,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionBtn: {
    width: '48%',
    flexGrow: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionDefault: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  optionCorrect: {
    backgroundColor: colors.success + '22',
    borderColor: colors.success,
  },
  optionIncorrect: {
    backgroundColor: colors.error + '22',
    borderColor: colors.error,
  },
  optionDimmed: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    opacity: 0.5,
  },
  optionLetter: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    width: 22,
  },
  optionText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  finishedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  finishedTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  finishedScore: {
    color: colors.pulse,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
  },
});

// PhaserWebViewBridge imported from ../components/Games/PhaserWebViewBridge

// ---------------------------------------------------------------------------
// GameScreen (Unified)
// ---------------------------------------------------------------------------

const GameScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { gameId } = route.params || {};

  const [phase, setPhase] = useState('loading'); // loading | lobby | playing | complete
  const [gameInfo, setGameInfo] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const multiplayer = useMultiplayerSync({
    gameConfigId: gameId,
    gameTitle: 'Game',
    gameType: 'trivia',
    enabled: true,
  });

  // ---- Load game info ----
  useEffect(() => {
    if (!gameId) {
      setError('No game ID provided');
      return;
    }
    const load = async () => {
      setPhase('loading');
      try {
        // Try catalog first (for game metadata)
        let info = null;
        try {
          const catalogRes = await gamesApi.catalog({ id: gameId });
          const catalogData = catalogRes.data || catalogRes.games || [];
          info = Array.isArray(catalogData)
            ? catalogData.find((g) => String(g.id) === String(gameId))
            : catalogData;
        } catch (_) {}

        // Fallback: try session endpoint
        if (!info) {
          try {
            const sessionRes = await gamesApi.get(gameId);
            info = sessionRes.data || sessionRes;
          } catch (_) {}
        }

        if (info) {
          setGameInfo(info);
          // Determine initial phase based on session status
          const status = info.status || info.state;
          if (status === 'playing' || status === 'in_progress') {
            setPhase('playing');
          } else if (status === 'completed' || status === 'finished') {
            setPhase('complete');
            setResults(info.results || null);
          } else {
            setPhase('lobby');
          }
        } else {
          // No info found - default to lobby
          setGameInfo({ id: gameId, title: 'Game', engine: 'unknown' });
          setPhase('lobby');
        }
      } catch (e) {
        setError('Failed to load game');
      }
    };
    load();
  }, [gameId]);

  // Listen to multiplayer state changes for phase transitions
  useEffect(() => {
    if (!multiplayer?.state) return;
    const mpStatus = multiplayer.state.status || multiplayer.state.phase;
    if (mpStatus === 'playing' || mpStatus === 'in_progress') {
      setPhase('playing');
    } else if (mpStatus === 'completed' || mpStatus === 'finished') {
      setPhase('complete');
      setResults(multiplayer.state.results || null);
    }
  }, [multiplayer?.state]);

  // ---- Actions ----

  const handleStartSolo = useCallback(async () => {
    try {
      const res = await gamesApi.create({
        game_id: gameId,
        mode: 'solo',
      });
      if (res.data) setGameInfo((prev) => ({ ...prev, ...res.data }));
      setPhase('playing');
    } catch (_) {
      setPhase('playing');
    }
  }, [gameId]);

  const handleGameStart = useCallback(() => {
    setPhase('playing');
  }, []);

  const handleTriviaComplete = useCallback(
    async (finalScore) => {
      setPhase('complete');
      const resultData = { score: finalScore };
      setResults(resultData);
      try {
        await gamesApi.move(gameId, { action: 'complete', score: finalScore });
      } catch (_) {}
    },
    [gameId],
  );

  const handlePlayAgain = useCallback(() => {
    setPhase('lobby');
    setResults(null);
  }, []);

  const handleBackToHub = useCallback(() => {
    navigation.navigate('GameHub');
  }, [navigation]);

  // ---- Phase renderers ----

  const getEngineType = () => {
    if (!gameInfo) return 'unknown';
    return (
      gameInfo.engine ||
      gameInfo.engine_type ||
      gameInfo.game_type ||
      'unknown'
    );
  };

  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.loadingText}>Loading game...</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.centerContainer}>
      <Icon name="alert-circle-outline" size={48} color={colors.error} />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={handleBackToHub}>
        <Text style={styles.retryBtnText}>Back to Games</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLobby = () => (
    <MultiplayerLobby
      multiplayer={multiplayer}
      onStartSolo={handleStartSolo}
      onGameStart={handleGameStart}
      gameTitle={gameInfo?.title || gameInfo?.name || 'Game'}
    />
  );

  const renderPlaying = () => {
    const engine = getEngineType();
    switch (engine) {
      case 'opentdb_trivia':
      case 'trivia':
        return (
          <TriviaEngineRN
            questions={gameInfo?.questions || []}
            multiplayer={multiplayer}
            onComplete={handleTriviaComplete}
          />
        );
      case 'phaser':
        return (
          <PhaserWebViewBridge
            sceneId={gameInfo?.engine_config?.scene_id || 'snake'}
            config={gameInfo?.engine_config || {}}
            multiplayer={multiplayer}
            onScoreUpdate={(score) => {
              if (multiplayer?.submitMove) {
                multiplayer.submitMove({ action: 'score_update', score });
              }
            }}
            onGameComplete={(finalScore) => {
              handleTriviaComplete(finalScore);
            }}
          />
        );
      default:
        return (
          <View style={styles.centerContainer}>
            <Icon name="puzzle-outline" size={64} color={colors.textMuted} />
            <Text style={styles.comingSoonText}>
              {engine} coming soon
            </Text>
          </View>
        );
    }
  };

  const renderComplete = () => {
    const scores = results?.scores || results?.leaderboard || [];
    const myScore = results?.score ?? results?.my_score;
    return (
      <ScrollView contentContainerStyle={styles.completeContainer}>
        <Animatable.View animation="bounceIn" style={styles.completeHeader}>
          <Icon name="trophy" size={72} color={colors.pulse} />
          <Text style={styles.completeTitle}>Game Over!</Text>
          {myScore !== undefined && (
            <Text style={styles.completeScore}>
              Your Score: {myScore}
            </Text>
          )}
        </Animatable.View>

        {/* Scores list */}
        {scores.length > 0 && (
          <View style={styles.scoresList}>
            <Text style={styles.scoresTitle}>Scoreboard</Text>
            {scores.map((entry, idx) => (
              <View key={idx} style={styles.scoreRow}>
                <Text style={styles.scoreRank}>#{idx + 1}</Text>
                <Text style={styles.scoreName}>
                  {entry.username || entry.name || `Player ${idx + 1}`}
                </Text>
                <Text style={styles.scoreValue}>{entry.score ?? 0}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.completeActions}>
          <TouchableOpacity
            style={styles.playAgainBtn}
            onPress={handlePlayAgain}
            activeOpacity={0.7}
          >
            <Icon name="replay" size={20} color={colors.textPrimary} />
            <Text style={styles.playAgainText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backToHubBtn}
            onPress={handleBackToHub}
            activeOpacity={0.7}
          >
            <Icon name="gamepad-variant" size={20} color={colors.accent} />
            <Text style={styles.backToHubText}>Back to Hub</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (error) return renderError();
    switch (phase) {
      case 'loading':
        return renderLoading();
      case 'lobby':
        return renderLobby();
      case 'playing':
        return renderPlaying();
      case 'complete':
        return renderComplete();
      default:
        return renderLoading();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header bar (always visible) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {gameInfo?.title || gameInfo?.name || 'Game'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {renderContent()}
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },

  // Center container (loading, error, placeholder)
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  retryBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  comingSoonText: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    marginTop: spacing.md,
    fontWeight: fontWeight.medium,
  },

  // Complete phase
  completeContainer: {
    flexGrow: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  completeHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  completeTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.md,
  },
  completeScore: {
    color: colors.pulse,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    marginTop: spacing.sm,
  },

  // Scores
  scoresList: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  scoresTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scoreRank: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    width: 36,
  },
  scoreName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    flex: 1,
  },
  scoreValue: {
    color: colors.pulse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },

  // Complete actions
  completeActions: {
    width: '100%',
    gap: spacing.sm,
  },
  playAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  playAgainText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  backToHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  backToHubText: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
});

export default GameScreen;
