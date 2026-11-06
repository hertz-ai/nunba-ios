import React, {useState, useCallback, useRef, useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
// NOT react-native's SafeAreaView: that one is
// `Platform.select({ios: RCTSafeAreaView, default: View})`, so on Android it is
// a plain View and reserves nothing.  This screen looked safe-area aware for
// years while every kids game drew under the system bars on Android.
import {SafeAreaView} from 'react-native-safe-area-context';
import KidsThemeProvider from '../components/KidsLearning/KidsThemeProvider';
import GameShell from '../components/KidsLearning/GameShell';
import GameHeader from '../components/KidsLearning/GameHeader';
import GameComplete from '../components/KidsLearning/GameComplete';
import StarReward from '../components/KidsLearning/StarReward';
import StreakFire from '../components/KidsLearning/StreakFire';
import OfflineBanner from '../components/KidsLearning/OfflineBanner';
import DynamicTemplateEngine, {getRenderMode} from '../components/KidsLearning/DynamicTemplateEngine';
import {getTemplateComponent, isLocalTemplate} from '../components/KidsLearning/data/gameRegistry';
import {getGameById} from '../components/KidsLearning/data/gameConfigs';
import UniqueGameRenderer from '../components/KidsLearning/UniqueGameRenderer';
import { composeUniqueBrief } from '../../../services/kidsAssetGen';
import { isAwesomeGame } from '../../../services/awesomeGames';
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
// The app targets SDK 36 and Android 15+ enforces edge-to-edge, so the window
// spans the whole screen and the bars are translucent scrims drawn over it.
// Reserve the two bars that actually overlap game content; left/right are left
// alone because games are played full-width in landscape on tablets.
const SYSTEM_BAR_EDGES = ['top', 'bottom'];

const KidsGameScreen = ({route, navigation}) => {
  // A deep link carries only an id, never the config: deepLinkService's
  // RESOURCE_ROUTE_MAP.kids_game is {screen:'KidsGame', paramKey:'gameId'} and
  // the linking table registers `r/kids_game/:gameId`, with host `r` whitelisted
  // for hevolve:// in AndroidManifest. So every shared link reached this screen
  // with gameConfig undefined and died on isLocalTemplate(gameConfig) below --
  // the same "Cannot read property 'template' of undefined" GameHubScreen's
  // comment records from 2026-05-28. getGameById is the catalogue's own O(1)
  // lookup (data/gameConfigs.js), so this resolves rather than duplicating it.
  const {gameConfig: passedConfig, gameId} = route.params || {};
  const gameConfig = passedConfig || (gameId ? getGameById(gameId) : null);
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

  // Both helpers dereference the config (isLocalTemplate reads .template), so a
  // deep link naming an id that is not in the catalogue must not reach them.
  const useLocalTemplate = !!gameConfig && isLocalTemplate(gameConfig);
  const useUniqueBrief = !!gameConfig && isAwesomeGame(gameConfig);

  // Unique-brief path state: brief comes either pre-composed via
  // route params (gameConfig.brief) or freshly composed on mount when
  // gameConfig.requestNewBrief is true.  Composer call respects the
  // novelty guard via recentBriefSignatures from the store so the same
  // mechanic+palette+style+character tuple never lands twice in a row.
  const [brief, setBrief] = useState(gameConfig?.brief || null);
  const [briefLoading, setBriefLoading] = useState(useUniqueBrief && !gameConfig?.brief);
  const recentBriefSignatures = useKidsLearningStore.getState().recentBriefSignatures || [];
  const recordBriefSignature = useKidsLearningStore.getState().recordBriefSignature;

  useEffect(() => {
    if (gameConfig) {
      startGame({
        id: gameConfig.id,
        title: gameConfig.title,
        category: gameConfig.category,
        template: gameConfig.template,
      });
    }
    questionStartTime.current = Date.now();
    return () => { mountedRef.current = false; };
  }, []);

  // Compose-on-mount for the brief-backed path.  When this returns,
  // UniqueGameRenderer mounts and the Speech Companion agent takes
  // over the LiquidOverlay surface (see UniqueGameRenderer for details).
  useEffect(() => {
    if (!useUniqueBrief || brief) return;
    let cancelled = false;
    (async () => {
      try {
        const { brief: composed } = await composeUniqueBrief({
          ageGroup: gameConfig.ageGroup || 'early',
          theme: gameConfig.theme,
          recentSignatures: recentBriefSignatures,
        });
        if (!cancelled && mountedRef.current) setBrief(composed);
      } catch (_) {
        // composeUniqueBrief already has its own local-fallback path;
        // a thrown error here is genuinely fatal — exit back to the hub.
        if (!cancelled && mountedRef.current) navigation.goBack();
      } finally {
        if (!cancelled && mountedRef.current) setBriefLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [useUniqueBrief, brief, gameConfig?.ageGroup, gameConfig?.theme, recentBriefSignatures, navigation]);

  const handleBriefComplete = useCallback((briefId, signature) => {
    if (recordBriefSignature) recordBriefSignature(signature);
    const gameResult = completeGame();
    if (gameResult) {
      setResult(gameResult);
      setShowComplete(true);
      reportToServer({ ...gameResult, briefId, kind: 'unique-brief' });
    }
  }, [completeGame, recordBriefSignature]);

  const handleBriefReroll = useCallback(async () => {
    setBriefLoading(true);
    setBrief(null);
    try {
      const { brief: composed } = await composeUniqueBrief({
        ageGroup: gameConfig.ageGroup || 'early',
        theme: gameConfig.theme,
        recentSignatures: useKidsLearningStore.getState().recentBriefSignatures || [],
      });
      if (mountedRef.current) setBrief(composed);
    } finally {
      if (mountedRef.current) setBriefLoading(false);
    }
  }, [gameConfig?.ageGroup, gameConfig?.theme]);

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
  }, [completeGame, reportToServer, isOnline]);

  // Handle GameShell completion (local templates)
  const handleShellComplete = useCallback(async (shellResult) => {
    const gameResult = completeGame();
    const finalResult = gameResult ? {...gameResult, ...shellResult} : shellResult;
    reportToServer(finalResult);
  }, [isOnline]);

  const reportToServer = useCallback(async (gameResult) => {
    if (isOnline) {
      try {
        // No node stores kids results yet: the api answers {stored: false}
        // instead of throwing, so keep the result queued rather than lose it.
        const r = await kidsLearningApi.reportGameCompletion(gameResult);
        if (!r || r.stored === false) {
          useKidsLearningStore.getState().queueForSync(gameResult);
        }
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

  // A deep link can name an id that is not in the catalogue (old share link,
  // typo, a game pulled from the build). Show that plainly instead of throwing;
  // this sits AFTER every hook so hook order is unchanged.
  if (!gameConfig) {
    return (
      <KidsThemeProvider>
        <SafeAreaView style={styles.container} edges={SYSTEM_BAR_EDGES}>
          <GameHeader
            title="Game not found"
            score={0}
            streak={0}
            questionsAnswered={0}
            totalQuestions={0}
            onBack={handleExit}
          />
        </SafeAreaView>
      </KidsThemeProvider>
    );
  }

  // ── UNIQUE-BRIEF PATH (server-composed, per-launch novelty) ──
  if (useUniqueBrief) {
    return (
      <KidsThemeProvider>
        <SafeAreaView style={styles.container} edges={SYSTEM_BAR_EDGES}>
          <OfflineBanner visible={!isOnline} />
          <View style={styles.gameArea}>
            <UniqueGameRenderer
              brief={brief}
              recentSignatures={recentBriefSignatures}
              onComplete={handleBriefComplete}
              onRequestReroll={handleBriefReroll}
            />
          </View>
          {showComplete && result && (
            <GameComplete result={result} onPlayAgain={handleBriefReroll} onHome={handleExit} />
          )}
        </SafeAreaView>
      </KidsThemeProvider>
    );
  }

  // ── DYNAMIC GAME PATH (server-driven, HTML5, dynamic-template) ──
  if (!useLocalTemplate) {
    return (
      <KidsThemeProvider>
        <SafeAreaView style={styles.container} edges={SYSTEM_BAR_EDGES}>
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
      <SafeAreaView style={styles.container} edges={SYSTEM_BAR_EDGES}>
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
