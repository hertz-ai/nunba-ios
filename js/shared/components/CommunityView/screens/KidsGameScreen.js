import React, {useState, useCallback, useRef, useEffect} from 'react';
import {SafeAreaView, View, StyleSheet} from 'react-native';
import KidsThemeProvider from '../components/KidsLearning/KidsThemeProvider';
import GameShell from '../components/KidsLearning/GameShell';
import GameHeader from '../components/KidsLearning/GameHeader';
import GameComplete from '../components/KidsLearning/GameComplete';
import StarReward from '../components/KidsLearning/StarReward';
import StreakFire from '../components/KidsLearning/StreakFire';
import OfflineBanner from '../components/KidsLearning/OfflineBanner';
import DynamicTemplateEngine, {getRenderMode} from '../components/KidsLearning/DynamicTemplateEngine';
import {getTemplateComponent, isLocalTemplate} from '../components/KidsLearning/data/gameRegistry';
import useKidsLearningStore from '../../../kidsLearningStore';
import useKidsIntelligenceStore from '../../../kidsIntelligenceStore';
import {kidsLearningApi} from '../../../services/kidsLearningApi';
import {kidsColors} from '../../../theme/kidsColors';

/**
 * KidsGameScreen - Universal game container with 4 rendering modes.
 *
 * Rendering modes (determined by DynamicTemplateEngine):
 *
 * 1. LOCAL TEMPLATE + GameShell (offline, polished UX):
 *    Config has `template` matching one of 15 built-in templates.
 *    GameShell provides loading→intro→playing→complete flow, haptics, confetti.
 *
 * 2. SERVER-DRIVEN NATIVE (hybrid, native feel):
 *    Config has `serverLayout` — JSON UI tree rendered to native RN components.
 *    Managed by DynamicTemplateEngine + ServerDrivenUI.
 *
 * 3. DYNAMIC TEMPLATE (cached server template):
 *    Config has `dynamicTemplate` ID referencing a cached template definition.
 *    Fetched once from server, cached in AsyncStorage, rendered natively.
 *
 * 4. HTML5 WEBVIEW (fully dynamic, any UI):
 *    Config has `serverHtml` or `serverUrl`.
 *    Rendered by DynamicGameRenderer in a sandboxed WebView.
 *
 * All modes share: GameHeader, StarReward, StreakFire, GameComplete, OfflineBanner.
 * All modes report to kidsLearningStore + kidsIntelligenceStore for 3R tracking.
 */
const KidsGameScreen = ({route, navigation}) => {
  const {gameConfig} = route.params;
  const {
    startGame, recordAnswer, completeGame, currentScore,
    currentStreak, questionsAnswered, isOnline,
  } = useKidsLearningStore();
  const intelligenceStore = useKidsIntelligenceStore();
  const {recordConceptAnswer} = intelligenceStore;

  // For dynamic games (server-driven, HTML5, dynamic-template)
  const [showComplete, setShowComplete] = useState(false);
  const [showStar, setShowStar] = useState(false);
  const [starCount, setStarCount] = useState(1);
  const [result, setResult] = useState(null);
  const questionStartTime = useRef(Date.now());
  const mountedRef = useRef(true);

  const useLocalTemplate = isLocalTemplate(gameConfig);

  useEffect(() => {
    startGame({
      id: gameConfig.id,
      title: gameConfig.title,
      category: gameConfig.category,
      template: gameConfig.template,
    });
    questionStartTime.current = Date.now();
    return () => { mountedRef.current = false; };
  }, []);

  // Handle answer from dynamic games (local templates use GameShell's handler)
  const handleDynamicAnswer = useCallback((isCorrect, concept, responseTimeMs) => {
    const elapsed = responseTimeMs || (Date.now() - questionStartTime.current);
    recordAnswer(isCorrect, isCorrect ? 10 : 0);

    if (concept) {
      const conceptKey = `${gameConfig.category || 'general'}:${concept}`;
      recordConceptAnswer(conceptKey, isCorrect, elapsed);
    }

    if (isCorrect) {
      const streak = useKidsLearningStore.getState().currentStreak;
      setStarCount(streak >= 5 ? 3 : streak >= 3 ? 2 : 1);
      setShowStar(true);
      setTimeout(() => {
        if (mountedRef.current) setShowStar(false);
      }, 800);
    }

    questionStartTime.current = Date.now();
  }, [gameConfig]);

  // Handle dynamic game completion
  const handleDynamicComplete = useCallback(async () => {
    const gameResult = completeGame();
    if (gameResult) {
      setResult(gameResult);
      setShowComplete(true);
      reportToServer(gameResult);
    }
  }, [isOnline]);

  // Handle GameShell completion (local templates)
  const handleShellComplete = useCallback(async (shellResult) => {
    const gameResult = completeGame();
    const finalResult = gameResult ? {...gameResult, ...shellResult} : shellResult;
    reportToServer(finalResult);
  }, [isOnline]);

  const reportToServer = useCallback(async (gameResult) => {
    if (isOnline) {
      try {
        await kidsLearningApi.reportGameCompletion(gameResult);
      } catch (_) {
        useKidsLearningStore.getState().queueForSync(gameResult);
      }
    } else {
      useKidsLearningStore.getState().queueForSync(gameResult);
    }
  }, [isOnline]);

  const handleExit = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handlePlayAgain = useCallback(() => {
    setShowComplete(false);
    setResult(null);
    startGame({
      id: gameConfig.id,
      title: gameConfig.title,
      category: gameConfig.category,
      template: gameConfig.template,
    });
    questionStartTime.current = Date.now();
  }, [gameConfig]);

  // ── DYNAMIC GAME PATH (server-driven, HTML5, dynamic-template) ──
  if (!useLocalTemplate) {
    return (
      <KidsThemeProvider>
        <SafeAreaView style={styles.container}>
          <OfflineBanner visible={!isOnline} />
          <GameHeader
            title={gameConfig.title}
            score={currentScore}
            streak={currentStreak}
            questionsAnswered={questionsAnswered}
            totalQuestions={gameConfig.questionsPerSession || 10}
            onBack={handleExit}
          />
          <View style={styles.gameArea}>
            <DynamicTemplateEngine
              config={gameConfig}
              onAnswer={handleDynamicAnswer}
              onComplete={handleDynamicComplete}
            />
          </View>
          <StarReward
            visible={showStar}
            count={starCount}
            onComplete={() => setShowStar(false)}
          />
          <StreakFire streak={currentStreak} visible={currentStreak >= 3} />
          {showComplete && result && (
            <GameComplete result={result} onPlayAgain={handlePlayAgain} onHome={handleExit} />
          )}
        </SafeAreaView>
      </KidsThemeProvider>
    );
  }

  // ── LOCAL TEMPLATE PATH (GameShell with premium UX) ──
  const TemplateComponent = getTemplateComponent(gameConfig.template);

  return (
    <KidsThemeProvider>
      <SafeAreaView style={styles.container}>
        <OfflineBanner visible={!isOnline} />
        <GameShell
          config={gameConfig}
          onComplete={handleShellComplete}
          onExit={handleExit}
          intelligenceStore={intelligenceStore}
        >
          {(templateProps) => {
            if (!TemplateComponent) return null;
            return <TemplateComponent {...templateProps} />;
          }}
        </GameShell>
      </SafeAreaView>
    </KidsThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
  },
  gameArea: {
    flex: 1,
  },
});

export default KidsGameScreen;
