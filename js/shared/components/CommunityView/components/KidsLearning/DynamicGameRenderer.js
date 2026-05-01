import React, {useRef, useCallback, useEffect} from 'react';
import {View, StyleSheet, ActivityIndicator, Text} from 'react-native';
import {WebView} from 'react-native-webview';
import {kidsColors, kidsSpacing, kidsFontSize} from '../../../../theme/kidsColors';
import useKidsLearningStore from '../../../../kidsLearningStore';
import useKidsIntelligenceStore from '../../../../kidsIntelligenceStore';
import GameSounds from './shared/SoundManager';

// Whitelist of allowed GameSounds methods callable from WebView bridge
const ALLOWED_SOUND_EVENTS = new Set([
  'tap', 'correct', 'wrong', 'streak', 'complete', 'starEarned',
  'cardFlip', 'matchFound', 'dragStart', 'dragDrop',
  'countdownTick', 'countdownEnd', 'intro',
]);

/**
 * DynamicGameRenderer - Renders server-generated HTML5 games in a WebView.
 *
 * The server (LLM agent) creates complete single-page HTML5 games with:
 * - Full HTML/CSS/JS in a single string
 * - Standardized postMessage API for score/answer reporting
 * - Self-contained (no external dependencies or inline from CDN)
 * - Responsive design that fills the WebView
 *
 * Communication protocol (game -> app):
 * - { type: 'answer', correct: bool, concept: string, responseTimeMs: number }
 * - { type: 'complete', score: number, correct: number, total: number }
 * - { type: 'ready' } - game loaded and ready
 * - { type: 'error', message: string }
 *
 * Communication protocol (app -> game):
 * - { type: 'config', difficulty: number, ageGroup: string, studentName: string }
 * - { type: 'threeR', conceptData: object } - sends 3R data for adaptive behavior
 * - { type: 'evolve', evolutionType: string } - request game to adapt difficulty
 * - { type: 'theme', colors: object } - send theme colors for consistent styling
 */
const DynamicGameRenderer = ({
  htmlContent,
  gameUrl,
  gameConfig,
  onAnswer,
  onComplete,
  onReady,
  onError,
}) => {
  const webViewRef = useRef(null);
  const mountedRef = useRef(true);
  const recordAnswer = useKidsLearningStore(s => s.recordAnswer);
  const recordConcept = useKidsIntelligenceStore(s => s.recordConceptAnswer);
  const startTime = useRef(Date.now());

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Wrap server HTML with our communication bridge
  const wrappedHtml = htmlContent
    ? `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; }
    html, body { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <script>
    // Bridge: game can call these to communicate with the app
    window.KidsGameBridge = {
      reportAnswer: function(correct, concept, responseTimeMs) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'answer', correct: correct, concept: concept, responseTimeMs: responseTimeMs || 0
        }));
      },
      reportComplete: function(score, correct, total) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'complete', score: score, correct: correct, total: total
        }));
      },
      reportReady: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      },
      reportError: function(message) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: message }));
      },
      playSound: function(eventName) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'playSound', event: eventName
        }));
      },
      speakText: function(text, voice) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'speakText', text: text, voice: voice || ''
        }));
      },
      playMusic: function(url) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'playMusic', url: url
        }));
      },
      stopMusic: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'stopMusic'
        }));
      },
      // Theme colors from the app for consistent styling
      theme: ${JSON.stringify({
        background: kidsColors.background,
        card: kidsColors.card,
        accent: kidsColors.accent,
        correct: kidsColors.correct,
        incorrect: kidsColors.incorrect,
        star: kidsColors.star,
        textPrimary: kidsColors.textPrimary,
        textSecondary: kidsColors.textSecondary,
        textOnDark: kidsColors.textOnDark,
        border: kidsColors.border,
      })}
    };
    // Listen for messages from the app
    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (window.onGameConfig && data.type === 'config') window.onGameConfig(data);
        if (window.onThreeRData && data.type === 'threeR') window.onThreeRData(data.conceptData);
        if (window.onEvolve && data.type === 'evolve') window.onEvolve(data.evolutionType);
        if (window.onThemeUpdate && data.type === 'theme') window.onThemeUpdate(data.colors);
      } catch(e) {}
    });
  </script>
  ${htmlContent}
</body>
</html>`
    : null;

  const handleMessage = useCallback((event) => {
    if (!mountedRef.current) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'answer':
          if (!mountedRef.current) return;
          recordAnswer(data.correct, data.correct ? 10 : 0);
          if (data.concept) {
            recordConcept(
              `${gameConfig?.category || 'general'}:${data.concept}`,
              data.correct,
              data.responseTimeMs !== undefined ? data.responseTimeMs : (Date.now() - startTime.current),
            );
          }
          startTime.current = Date.now();
          if (onAnswer) onAnswer(data);
          break;
        case 'complete':
          if (!mountedRef.current) return;
          if (onComplete) onComplete(data);
          break;
        case 'ready':
          // Send config to the game
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              if (window.onGameConfig) {
                window.onGameConfig(${JSON.stringify({
                  type: 'config',
                  difficulty: gameConfig?.difficulty || 1,
                  ageGroup: gameConfig?.ageGroup || gameConfig?.ageRange || [5, 12],
                  category: gameConfig?.category || 'general',
                })});
              }
              true;
            `);
          }
          if (onReady) onReady();
          break;
        case 'playSound':
          if (data.event && ALLOWED_SOUND_EVENTS.has(data.event) && GameSounds[data.event]) {
            GameSounds[data.event]();
          }
          break;
        case 'speakText':
          if (data.text) {
            GameSounds.speakText(data.text, {voice: data.voice}).catch(() => {});
          }
          break;
        case 'playMusic':
          if (data.url) {
            GameSounds.startBackgroundMusic(data.url, {loop: true, volume: 0.3});
          }
          break;
        case 'stopMusic':
          GameSounds.stopBackgroundMusic({fadeOutMs: 500});
          break;
        case 'error':
          if (onError) onError(data.message);
          break;
      }
    } catch (e) {
      if (e instanceof SyntaxError) return; // Non-JSON message, ignore
      console.warn('[DynamicGameRenderer] Message handler error:', e.message);
    }
  }, [gameConfig, onAnswer, onComplete, onReady, onError]);

  const renderLoading = () => (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={kidsColors.accent} />
      <Text style={styles.loadingText}>Loading game...</Text>
    </View>
  );

  if (gameUrl) {
    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{uri: gameUrl}}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={renderLoading}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
        />
      </View>
    );
  }

  if (wrappedHtml) {
    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{html: wrappedHtml}}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={renderLoading}
          style={styles.webview}
          originWhitelist={['*']}
          scrollEnabled={false}
          bounces={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>No game content available</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: kidsColors.background,
  },
  loadingText: {
    marginTop: kidsSpacing.md,
    fontSize: kidsFontSize.md,
    color: kidsColors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textSecondary,
  },
});

export default DynamicGameRenderer;
