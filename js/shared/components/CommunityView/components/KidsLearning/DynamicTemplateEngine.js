import React, {useState, useCallback, useRef, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ServerDrivenUI from './ServerDrivenUI';
import DynamicGameRenderer from './DynamicGameRenderer';
import FeedbackOverlay from './shared/FeedbackOverlay';
import ProgressDots from './shared/ProgressDots';
import {getTemplateComponent} from './data/gameRegistry';
import {
  kidsColors,
  kidsSpacing,
  kidsFontSize,
  kidsFontWeight,
} from '../../../../theme/kidsColors';

const CACHE_KEY = '@kidsLearning:dynamicTemplates';

/**
 * DynamicTemplateEngine - Unified rendering engine for all game modes.
 *
 * Determines the best rendering strategy for any game config:
 *
 * Mode 1 - LOCAL TEMPLATE (offline, fastest):
 *   Config has `template` matching one of 15 built-in template names.
 *   Renders the local React Native component.
 *
 * Mode 2 - SERVER-DRIVEN NATIVE (hybrid, native feel):
 *   Config has `serverLayout` — a JSON UI descriptor.
 *   Rendered by ServerDrivenUI using native RN components.
 *   Server defines layout + data schema, client handles rendering.
 *
 * Mode 3 - HTML5 WEBVIEW (fully dynamic, any UI):
 *   Config has `serverHtml` or `serverUrl`.
 *   Rendered by DynamicGameRenderer in a WebView.
 *   Server sends complete HTML5 game.
 *
 * Mode 4 - DYNAMIC TEMPLATE (server-defined template, cached):
 *   Config has `dynamicTemplate` ID referencing a cached server template.
 *   Template definition fetched once and cached in AsyncStorage.
 *   Rendered via ServerDrivenUI with the cached layout.
 *
 * The engine also handles:
 * - Template caching and versioning
 * - State management for server-driven games (questions, score, etc.)
 * - Bridging onAnswer/onComplete callbacks across all modes
 */

// Determine rendering mode from game config
export const getRenderMode = (config) => {
  if (!config) return 'error';
  if (config.serverHtml || config.serverUrl) return 'html5';
  if (config.serverLayout) return 'server-driven';
  if (config.dynamicTemplate) return 'dynamic-template';
  if (config.template && config.template !== 'dynamic') return 'local';
  return 'html5'; // fallback for unknown template types
};

// ── Dynamic Template Cache ──

const templateCache = new Map();

export const cacheDynamicTemplate = async (templateId, templateDef) => {
  templateCache.set(templateId, templateDef);
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    const all = stored ? JSON.parse(stored) : {};
    if (typeof all !== 'object' || all === null) return;
    all[templateId] = {
      ...templateDef,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('[KidsLearning] Template cache write failed:', e.message);
  }
};

export const getCachedTemplate = async (templateId) => {
  // Check memory cache first
  if (templateCache.has(templateId)) {
    return templateCache.get(templateId);
  }
  // Check AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (stored) {
      const all = JSON.parse(stored);
      if (!all || typeof all !== 'object') return null;
      const template = all[templateId];
      if (template && typeof template === 'object') {
        templateCache.set(templateId, template);
        return template;
      }
    }
  } catch (e) {
    console.warn('[KidsLearning] Template cache read failed:', e.message);
  }
  return null;
};

export const clearTemplateCache = async () => {
  templateCache.clear();
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (e) {
    console.warn('[KidsLearning] Template cache clear failed:', e.message);
  }
};

// ── Server-Driven Game State Manager ──

const useServerDrivenGameState = (config, onAnswer, onComplete) => {
  const content = config?.content || {};
  const questions = content.questions || content.items || content.words || content.pairs || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [streak, setStreak] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const startTimeRef = useRef(Date.now());
  const mountedRef = useRef(true);
  const completedRef = useRef(false);

  useEffect(() => {
    startTimeRef.current = Date.now();
    return () => { mountedRef.current = false; };
  }, []);

  const currentQuestion = questions[currentIndex] || null;
  const totalQuestions = config?.questionsPerSession || questions.length || 10;
  const progress = currentIndex / totalQuestions;

  const handleAction = useCallback((actionName, payload) => {
    switch (actionName) {
      case 'selectOption':
      case 'submitAnswer': {
        const responseTime = Date.now() - startTimeRef.current;
        const answer = payload?.value || payload?.text || inputValue;
        const correct = currentQuestion
          ? (answer === currentQuestion.answer || answer === currentQuestion.correct || payload?.isCorrect)
          : false;

        setResults(prev => [...prev, correct]);
        setFeedbackCorrect(correct);
        setFeedbackVisible(true);

        if (correct) {
          setScore(prev => prev + (config?.rewards?.starsPerCorrect || 1));
          setStreak(prev => prev + 1);
        } else {
          setStreak(0);
        }

        if (onAnswer) {
          const concept = currentQuestion?.concept || currentQuestion?.word || `q${currentIndex}`;
          onAnswer(correct, concept, responseTime);
        }

        // Advance after feedback delay
        setTimeout(() => {
          if (!mountedRef.current) return;
          setFeedbackVisible(false);
          setInputValue('');
          startTimeRef.current = Date.now();

          if (currentIndex + 1 >= totalQuestions && !completedRef.current) {
            completedRef.current = true;
            if (mountedRef.current && onComplete) onComplete();
          } else {
            setCurrentIndex(prev => prev + 1);
          }
        }, 800);
        break;
      }

      case 'inputChange':
        if (payload?.text !== undefined) setInputValue(payload.text);
        break;

      case 'numberPress':
        setInputValue(prev => prev + String(payload?.number || ''));
        break;

      case 'numberDelete':
        setInputValue(prev => prev.slice(0, -1));
        break;

      case 'numberSubmit':
        handleAction('submitAnswer', {value: inputValue});
        break;

      case 'feedbackDismiss':
        setFeedbackVisible(false);
        break;

      case 'timeUp':
        if (!completedRef.current) {
          completedRef.current = true;
          if (mountedRef.current && onComplete) onComplete();
        }
        break;

      case 'skip':
        setResults(prev => [...prev, false]);
        setCurrentIndex(prev => prev + 1);
        startTimeRef.current = Date.now();
        if (currentIndex + 1 >= totalQuestions && !completedRef.current) {
          completedRef.current = true;
          if (mountedRef.current && onComplete) onComplete();
        }
        break;

      case 'hint':
        // Hint handling - expose hint data
        break;

      default:
        // Custom action - pass through
        break;
    }
  }, [currentIndex, currentQuestion, totalQuestions, inputValue, onAnswer, onComplete, config]);

  return {
    state: {
      currentIndex,
      currentQuestion,
      totalQuestions,
      score,
      results,
      streak,
      progress,
      inputValue,
      feedbackVisible,
      feedbackCorrect,
      questions,
    },
    handleAction,
  };
};

// ── Main Component ──

const DynamicTemplateEngine = ({
  config,
  onAnswer,
  onComplete,
  onReady,
  onError,
}) => {
  const [dynamicLayout, setDynamicLayout] = useState(null);
  const [loading, setLoading] = useState(false);
  const renderMode = getRenderMode(config);

  // For server-driven and dynamic-template modes
  const {state, handleAction} = useServerDrivenGameState(config, onAnswer, onComplete);

  // Load dynamic template from cache if needed
  useEffect(() => {
    if (renderMode === 'dynamic-template' && config.dynamicTemplate) {
      setLoading(true);
      getCachedTemplate(config.dynamicTemplate).then(template => {
        if (template) {
          setDynamicLayout(template.layout);
        }
        setLoading(false);
        if (onReady) onReady();
      });
    } else if (renderMode === 'server-driven') {
      // Validate layout structure
      const layout = config.serverLayout;
      if (layout && typeof layout === 'object' && typeof layout.type === 'string') {
        setDynamicLayout(layout);
      } else {
        console.warn('[DynamicTemplateEngine] Invalid serverLayout structure');
      }
      if (onReady) onReady();
    }
  }, [config]);

  // Build data context for ServerDrivenUI bindings
  const dataContext = {
    state,
    config,
    content: config?.content || {},
    question: state.currentQuestion,
    item: state.currentQuestion,
    index: state.currentIndex,
  };

  // ── Mode 1: Local Template ──
  if (renderMode === 'local') {
    const TemplateComponent = getTemplateComponent(config.template);
    if (!TemplateComponent) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Template "{config.template}" not found</Text>
        </View>
      );
    }
    return <TemplateComponent config={config} onAnswer={onAnswer} onComplete={onComplete} />;
  }

  // ── Mode 3: HTML5 WebView ──
  if (renderMode === 'html5') {
    return (
      <DynamicGameRenderer
        htmlContent={config.serverHtml}
        gameUrl={config.serverUrl}
        gameConfig={config}
        onAnswer={(data) => onAnswer && onAnswer(data.correct, data.concept, data.responseTimeMs)}
        onComplete={onComplete}
        onReady={onReady}
        onError={onError}
      />
    );
  }

  // ── Mode 2 & 4: Server-Driven Native UI ──
  if (renderMode === 'server-driven' || renderMode === 'dynamic-template') {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading template...</Text>
        </View>
      );
    }

    if (!dynamicLayout) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {renderMode === 'dynamic-template'
              ? `Template "${config.dynamicTemplate}" not cached. Connect to internet to download.`
              : 'No layout provided by server.'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {/* Progress indicator */}
        <ProgressDots
          total={state.totalQuestions}
          current={state.currentIndex}
          results={state.results}
        />

        {/* Server-defined UI */}
        <ServerDrivenUI
          layout={dynamicLayout}
          data={dataContext}
          onAction={handleAction}
          style={styles.gameArea}
        />

        {/* Feedback overlay */}
        <FeedbackOverlay
          visible={state.feedbackVisible}
          isCorrect={state.feedbackCorrect}
          onDismiss={() => handleAction('feedbackDismiss')}
        />
      </View>
    );
  }

  // ── Fallback ──
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>Unknown game rendering mode</Text>
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: kidsColors.background,
  },
  loadingText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kidsSpacing.lg,
  },
  errorText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textSecondary,
    textAlign: 'center',
  },
});

export default DynamicTemplateEngine;
