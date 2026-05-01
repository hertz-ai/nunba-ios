import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  PanResponder,
  Dimensions,
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
import ProgressDots from '../shared/ProgressDots';
import FeedbackOverlay from '../shared/FeedbackOverlay';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_WIDTH - kidsSpacing.md * 2, 340);
const TRACE_LINE_WIDTH = 12;

/**
 * TracingTemplate - Trace letters, numbers, or shapes with finger.
 *
 * Shows a large faded guide of the target. The child traces over it using
 * their finger (PanResponder). Scoring is based on proximity to the guide
 * path. Implements real-time difficulty adaptation.
 *
 * Props:
 * - config: { content: { items: [{ type, value, concept }] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 */

// Generate guide path points for a given value
const generateGuidePath = (type, value, canvasSize) => {
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const margin = canvasSize * 0.15;
  const size = canvasSize - margin * 2;
  const points = [];

  if (type === 'shape') {
    if (value === 'circle') {
      const radius = size / 2.4;
      for (let i = 0; i <= 60; i++) {
        const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
        points.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      }
    } else if (value === 'square') {
      const half = size / 2.8;
      const left = cx - half;
      const right = cx + half;
      const top = cy - half;
      const bottom = cy + half;
      // Top side
      for (let i = 0; i <= 10; i++) points.push({x: left + (right - left) * (i / 10), y: top});
      // Right side
      for (let i = 1; i <= 10; i++) points.push({x: right, y: top + (bottom - top) * (i / 10)});
      // Bottom side
      for (let i = 1; i <= 10; i++) points.push({x: right - (right - left) * (i / 10), y: bottom});
      // Left side
      for (let i = 1; i <= 10; i++) points.push({x: left, y: bottom - (bottom - top) * (i / 10)});
    } else if (value === 'triangle') {
      const half = size / 2.6;
      const topPoint = {x: cx, y: cy - half};
      const bottomLeft = {x: cx - half, y: cy + half * 0.8};
      const bottomRight = {x: cx + half, y: cy + half * 0.8};
      for (let i = 0; i <= 10; i++) {
        points.push({
          x: topPoint.x + (bottomRight.x - topPoint.x) * (i / 10),
          y: topPoint.y + (bottomRight.y - topPoint.y) * (i / 10),
        });
      }
      for (let i = 1; i <= 10; i++) {
        points.push({
          x: bottomRight.x + (bottomLeft.x - bottomRight.x) * (i / 10),
          y: bottomRight.y + (bottomLeft.y - bottomRight.y) * (i / 10),
        });
      }
      for (let i = 1; i <= 10; i++) {
        points.push({
          x: bottomLeft.x + (topPoint.x - bottomLeft.x) * (i / 10),
          y: bottomLeft.y + (topPoint.y - bottomLeft.y) * (i / 10),
        });
      }
    } else if (value === 'star') {
      const outerR = size / 2.4;
      const innerR = outerR * 0.4;
      for (let i = 0; i <= 10; i++) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        points.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        });
      }
    }
    return points;
  }

  // Letters and numbers: simplified stroke paths
  // These are approximate guide paths for common characters
  const charValue = String(value).toUpperCase();

  const letterPaths = {
    A: () => {
      const pts = [];
      // Left stroke
      for (let i = 0; i <= 10; i++) {
        pts.push({x: cx - size * 0.25 + size * 0.25 * (i / 10), y: cy + size * 0.35 - size * 0.7 * (i / 10)});
      }
      // Right stroke
      for (let i = 0; i <= 10; i++) {
        pts.push({x: cx + size * 0.25 * (i / 10), y: cy - size * 0.35 + size * 0.7 * (i / 10)});
      }
      // Crossbar
      for (let i = 0; i <= 6; i++) {
        pts.push({x: cx - size * 0.12 + size * 0.24 * (i / 6), y: cy + size * 0.02});
      }
      return pts;
    },
    B: () => {
      const pts = [];
      const left = cx - size * 0.2;
      // Vertical line down
      for (let i = 0; i <= 10; i++) {
        pts.push({x: left, y: cy - size * 0.35 + size * 0.7 * (i / 10)});
      }
      // Top bump
      for (let i = 0; i <= 8; i++) {
        const angle = -Math.PI / 2 + Math.PI * (i / 8);
        pts.push({x: left + Math.cos(angle) * size * 0.18, y: cy - size * 0.17 + Math.sin(angle) * size * 0.17});
      }
      // Bottom bump
      for (let i = 0; i <= 8; i++) {
        const angle = -Math.PI / 2 + Math.PI * (i / 8);
        pts.push({x: left + Math.cos(angle) * size * 0.2, y: cy + size * 0.17 + Math.sin(angle) * size * 0.17});
      }
      return pts;
    },
    C: () => {
      const pts = [];
      const radius = size * 0.3;
      for (let i = 0; i <= 16; i++) {
        const angle = -Math.PI * 0.3 + (Math.PI * 1.6) * (i / 16);
        pts.push({x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius});
      }
      return pts;
    },
  };

  const numberPaths = {
    0: () => {
      const pts = [];
      const rx = size * 0.2;
      const ry = size * 0.3;
      for (let i = 0; i <= 20; i++) {
        const angle = (i / 20) * Math.PI * 2 - Math.PI / 2;
        pts.push({x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry});
      }
      return pts;
    },
    1: () => {
      const pts = [];
      // Small top hook
      pts.push({x: cx - size * 0.08, y: cy - size * 0.25});
      for (let i = 0; i <= 10; i++) {
        pts.push({x: cx, y: cy - size * 0.3 + size * 0.6 * (i / 10)});
      }
      // Bottom line
      for (let i = 0; i <= 5; i++) {
        pts.push({x: cx - size * 0.12 + size * 0.24 * (i / 5), y: cy + size * 0.3});
      }
      return pts;
    },
    2: () => {
      const pts = [];
      const r = size * 0.2;
      // Top curve
      for (let i = 0; i <= 10; i++) {
        const angle = -Math.PI * 0.8 + Math.PI * 1.2 * (i / 10);
        pts.push({x: cx + Math.cos(angle) * r, y: cy - size * 0.12 + Math.sin(angle) * r});
      }
      // Diagonal
      for (let i = 0; i <= 5; i++) {
        pts.push({x: cx + r * 0.5 - size * 0.35 * (i / 5), y: cy + size * 0.05 + size * 0.25 * (i / 5)});
      }
      // Bottom line
      for (let i = 0; i <= 5; i++) {
        pts.push({x: cx - size * 0.2 + size * 0.4 * (i / 5), y: cy + size * 0.3});
      }
      return pts;
    },
    3: () => {
      const pts = [];
      const r = size * 0.18;
      // Top curve
      for (let i = 0; i <= 10; i++) {
        const angle = -Math.PI * 0.7 + Math.PI * 1.2 * (i / 10);
        pts.push({x: cx + Math.cos(angle) * r, y: cy - size * 0.15 + Math.sin(angle) * r});
      }
      // Bottom curve
      for (let i = 0; i <= 10; i++) {
        const angle = -Math.PI * 0.5 + Math.PI * 1.2 * (i / 10);
        pts.push({x: cx + Math.cos(angle) * r * 1.1, y: cy + size * 0.15 + Math.sin(angle) * r * 1.1});
      }
      return pts;
    },
    4: () => {
      const pts = [];
      // Down stroke
      for (let i = 0; i <= 8; i++) {
        pts.push({x: cx - size * 0.05, y: cy - size * 0.3 + size * 0.4 * (i / 8)});
      }
      // Horizontal
      for (let i = 0; i <= 8; i++) {
        pts.push({x: cx - size * 0.2 + size * 0.4 * (i / 8), y: cy + size * 0.1});
      }
      // Vertical right
      for (let i = 0; i <= 8; i++) {
        pts.push({x: cx + size * 0.15, y: cy - size * 0.2 + size * 0.5 * (i / 8)});
      }
      return pts;
    },
    5: () => {
      const pts = [];
      // Top horizontal
      for (let i = 0; i <= 5; i++) {
        pts.push({x: cx + size * 0.15 - size * 0.3 * (i / 5), y: cy - size * 0.3});
      }
      // Down
      for (let i = 0; i <= 5; i++) {
        pts.push({x: cx - size * 0.15, y: cy - size * 0.3 + size * 0.3 * (i / 5)});
      }
      // Bottom curve
      const r = size * 0.2;
      for (let i = 0; i <= 10; i++) {
        const angle = -Math.PI * 0.5 + Math.PI * 1.2 * (i / 10);
        pts.push({x: cx + Math.cos(angle) * r * 0.9, y: cy + size * 0.15 + Math.sin(angle) * r});
      }
      return pts;
    },
    6: () => {
      const pts = [];
      const r = size * 0.2;
      // Top hook down
      for (let i = 0; i <= 8; i++) {
        const angle = -Math.PI * 0.3 - Math.PI * 0.7 * (i / 8);
        pts.push({x: cx + Math.cos(angle) * r * 1.2, y: cy - size * 0.1 + Math.sin(angle) * size * 0.25});
      }
      // Bottom circle
      for (let i = 0; i <= 14; i++) {
        const angle = Math.PI + Math.PI * 2 * (i / 14);
        pts.push({x: cx + Math.cos(angle) * r, y: cy + size * 0.12 + Math.sin(angle) * r});
      }
      return pts;
    },
    7: () => {
      const pts = [];
      // Top horizontal
      for (let i = 0; i <= 6; i++) {
        pts.push({x: cx - size * 0.2 + size * 0.4 * (i / 6), y: cy - size * 0.3});
      }
      // Diagonal down
      for (let i = 0; i <= 10; i++) {
        pts.push({x: cx + size * 0.2 - size * 0.25 * (i / 10), y: cy - size * 0.3 + size * 0.6 * (i / 10)});
      }
      return pts;
    },
    8: () => {
      const pts = [];
      const r = size * 0.16;
      // Top circle
      for (let i = 0; i <= 12; i++) {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        pts.push({x: cx + Math.cos(angle) * r, y: cy - size * 0.14 + Math.sin(angle) * r});
      }
      // Bottom circle
      for (let i = 0; i <= 12; i++) {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        pts.push({x: cx + Math.cos(angle) * r * 1.15, y: cy + size * 0.15 + Math.sin(angle) * r * 1.15});
      }
      return pts;
    },
    9: () => {
      const pts = [];
      const r = size * 0.2;
      // Top circle
      for (let i = 0; i <= 14; i++) {
        const angle = (i / 14) * Math.PI * 2 - Math.PI / 2;
        pts.push({x: cx + Math.cos(angle) * r, y: cy - size * 0.12 + Math.sin(angle) * r});
      }
      // Tail down
      for (let i = 0; i <= 6; i++) {
        pts.push({x: cx + r, y: cy + size * 0.05 + size * 0.25 * (i / 6)});
      }
      return pts;
    },
  };

  // Try letter path, then number path, then generate a default path
  if (letterPaths[charValue]) return letterPaths[charValue]();
  if (numberPaths[charValue]) return numberPaths[charValue]();

  // Default: draw a generic fallback (straight line down then across)
  const fallbackPts = [];
  for (let i = 0; i <= 10; i++) {
    fallbackPts.push({x: cx, y: cy - size * 0.3 + size * 0.6 * (i / 10)});
  }
  return fallbackPts;
};

// Calculate score based on how close the trace is to the guide path
const calculateScore = (tracePath, guidePath, threshold) => {
  if (tracePath.length < 5) return 0;

  let closePoints = 0;
  const totalCheck = Math.min(tracePath.length, 200);
  const step = Math.max(1, Math.floor(tracePath.length / totalCheck));

  for (let i = 0; i < tracePath.length; i += step) {
    const tp = tracePath[i];
    let minDist = Infinity;

    for (let j = 0; j < guidePath.length; j++) {
      const gp = guidePath[j];
      const dist = Math.sqrt(
        Math.pow(tp.x - gp.x, 2) + Math.pow(tp.y - gp.y, 2),
      );
      if (dist < minDist) minDist = dist;
    }

    if (minDist <= threshold) {
      closePoints++;
    }
  }

  return Math.round((closePoints / Math.ceil(tracePath.length / step)) * 100);
};

const TracingTemplate = ({config, onAnswer, onComplete}) => {
  const items = config?.content?.items || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tracePath, setTracePath] = useState([]);
  const [isTracing, setIsTracing] = useState(false);
  const [scored, setScored] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [toleranceMultiplier, setToleranceMultiplier] = useState(1);

  // Animations
  const guideAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const traceColorAnim = useRef(new Animated.Value(0)).current;

  // Feedback
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);

  // Timing
  const itemStartTime = useRef(Date.now());
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Canvas layout ref
  const canvasRef = useRef(null);
  const canvasLayout = useRef({x: 0, y: 0});

  const currentItem = items[currentIndex] || {};
  const guidePath = generateGuidePath(
    currentItem.type,
    currentItem.value,
    CANVAS_SIZE,
  );

  // Base threshold for scoring
  const BASE_THRESHOLD = CANVAS_SIZE * 0.12;
  const threshold = BASE_THRESHOLD * toleranceMultiplier;

  // Animate guide in on item change
  useEffect(() => {
    guideAnim.setValue(0);
    scoreAnim.setValue(0);
    traceColorAnim.setValue(0);
    setTracePath([]);
    setScored(false);
    setScore(0);

    Animated.timing(guideAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Pulse animation to draw attention to the guide
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {toValue: 1.03, duration: 1000, useNativeDriver: true}),
        Animated.timing(pulseAnim, {toValue: 1, duration: 1000, useNativeDriver: true}),
      ]),
    );
    pulse.start();

    itemStartTime.current = Date.now();

    return () => pulse.stop();
  }, [currentIndex]);

  // Adaptive: increase tolerance when struggling
  useEffect(() => {
    if (consecutiveWrong >= 3) {
      setToleranceMultiplier(1.6);
    } else if (consecutiveWrong >= 2) {
      setToleranceMultiplier(1.3);
    } else {
      setToleranceMultiplier(1);
    }
  }, [consecutiveWrong]);

  const submitTrace = useCallback(() => {
    if (scored || tracePath.length < 5) return;

    const responseTimeMs = Date.now() - itemStartTime.current;
    const traceScore = calculateScore(tracePath, guidePath, threshold);
    const isCorrect = traceScore >= 50;

    setScore(traceScore);
    setScored(true);

    // Adaptive tracking
    if (isCorrect) {
      setConsecutiveWrong(0);
    } else {
      setConsecutiveWrong(prev => prev + 1);
    }

    setResults(prev => [...prev, isCorrect]);

    // Feedback
    setFeedbackCorrect(isCorrect);
    setFeedbackVisible(true);

    // Report
    onAnswer(isCorrect, currentItem.concept, responseTimeMs);

    // Animate score
    Animated.timing(scoreAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [scored, tracePath, guidePath, threshold, currentItem, onAnswer]);

  // PanResponder for tracing - re-created when scored/currentIndex change
  const [panVersion, setPanVersion] = useState(0);
  const panRef = useRef(null);

  useEffect(() => {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => !scored,
      onMoveShouldSetPanResponder: () => !scored,
      onPanResponderGrant: evt => {
        if (scored) return;
        setIsTracing(true);
        const {locationX, locationY} = evt.nativeEvent;
        setTracePath([{x: locationX, y: locationY}]);

        Animated.timing(traceColorAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: evt => {
        if (scored) return;
        const {locationX, locationY} = evt.nativeEvent;
        setTracePath(prev => [...prev, {x: locationX, y: locationY}]);
      },
      onPanResponderRelease: () => {
        setIsTracing(false);
      },
    });
    setPanVersion(v => v + 1);
  }, [scored, currentIndex]);

  const handleRetry = useCallback(() => {
    setTracePath([]);
    setScored(false);
    setScore(0);
    scoreAnim.setValue(0);
    traceColorAnim.setValue(0);
    itemStartTime.current = Date.now();
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (mountedRef.current && onComplete) {
      onComplete();
    }
  }, [currentIndex, items.length, onComplete]);

  const handleFeedbackDismiss = useCallback(() => {
    setFeedbackVisible(false);
  }, []);

  // Get the display text for the guide
  const getGuideDisplay = () => {
    if (currentItem.type === 'shape') {
      return currentItem.value?.charAt(0).toUpperCase() + currentItem.value?.slice(1);
    }
    return String(currentItem.value || '').toUpperCase();
  };

  // Get star rating based on score
  const getStars = () => {
    if (score >= 80) return 3;
    if (score >= 60) return 2;
    if (score >= 40) return 1;
    return 0;
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="alert-circle-outline" size={48} color={kidsColors.textMuted} />
        <Text style={styles.emptyText}>No tracing items available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress */}
      <ProgressDots
        total={items.length}
        current={currentIndex}
        results={results}
      />

      {/* Title */}
      <View style={styles.titleRow}>
        <Icon name="draw" size={24} color={kidsColors.accent} />
        <Text style={styles.titleText}>
          Trace the{' '}
          {currentItem.type === 'letter'
            ? 'letter'
            : currentItem.type === 'number'
            ? 'number'
            : 'shape'}
          !
        </Text>
      </View>

      {/* Target display */}
      <View style={styles.targetRow}>
        <View style={styles.targetBadge}>
          <Text style={styles.targetText}>{getGuideDisplay()}</Text>
        </View>
        {consecutiveWrong >= 3 && (
          <View style={styles.hintBadge}>
            <Icon name="lightbulb-on-outline" size={16} color={kidsColors.star} />
            <Text style={styles.hintBadgeText}>Wider tolerance to help you!</Text>
          </View>
        )}
      </View>

      {/* Tracing canvas */}
      <Animated.View
        style={[
          styles.canvasContainer,
          {
            opacity: guideAnim,
            transform: [{scale: scored ? 1 : pulseAnim}],
          },
        ]}>
        <View
          ref={canvasRef}
          style={[styles.canvas, {width: CANVAS_SIZE, height: CANVAS_SIZE}]}
          onLayout={evt => {
            canvasLayout.current = {
              x: evt.nativeEvent.layout.x,
              y: evt.nativeEvent.layout.y,
            };
          }}
          {...(panRef.current ? panRef.current.panHandlers : {})}>
          {/* Guide path rendered as dots */}
          {guidePath.map((point, i) => (
            <View
              key={i}
              style={[
                styles.guideDot,
                {
                  left: point.x - 4,
                  top: point.y - 4,
                  opacity: 0.25,
                  backgroundColor: kidsColors.accent,
                },
              ]}
            />
          ))}

          {/* Large faded guide character */}
          <View style={styles.guideCharContainer} pointerEvents="none">
            <Text
              style={[
                styles.guideChar,
                {fontSize: CANVAS_SIZE * 0.6},
              ]}>
              {currentItem.type === 'shape' ? '' : String(currentItem.value || '').toUpperCase()}
            </Text>
          </View>

          {/* Shape guide SVG-like path using dots (for shapes) */}
          {currentItem.type === 'shape' && guidePath.length > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {guidePath.map((point, i) => (
                <View
                  key={`guide-thick-${i}`}
                  style={[
                    styles.guideThickDot,
                    {
                      left: point.x - 6,
                      top: point.y - 6,
                      backgroundColor: kidsColors.accentLight,
                      opacity: 0.35,
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* User trace path */}
          {tracePath.map((point, i) => (
            <View
              key={`trace-${i}`}
              style={[
                styles.traceDot,
                {
                  left: point.x - TRACE_LINE_WIDTH / 2,
                  top: point.y - TRACE_LINE_WIDTH / 2,
                  width: TRACE_LINE_WIDTH,
                  height: TRACE_LINE_WIDTH,
                  borderRadius: TRACE_LINE_WIDTH / 2,
                  backgroundColor: scored
                    ? feedbackCorrect
                      ? kidsColors.correct
                      : kidsColors.incorrect
                    : kidsColors.english,
                },
              ]}
            />
          ))}

          {/* "Draw here" prompt when canvas is empty */}
          {tracePath.length === 0 && !scored && (
            <View style={styles.drawPrompt} pointerEvents="none">
              <Icon name="gesture" size={32} color={kidsColors.textMuted} />
              <Text style={styles.drawPromptText}>
                Use your finger to trace!
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Score result */}
      {scored && (
        <Animated.View
          style={[
            styles.scoreCard,
            {
              opacity: scoreAnim,
              transform: [
                {
                  translateY: scoreAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}>
          <View style={styles.starsRow}>
            {[1, 2, 3].map(star => (
              <Icon
                key={star}
                name={star <= getStars() ? 'star' : 'star-outline'}
                size={32}
                color={star <= getStars() ? kidsColors.star : kidsColors.border}
              />
            ))}
          </View>
          <Text style={styles.scoreText}>Score: {score}%</Text>
          <Text style={styles.scoreMessage}>
            {score >= 80
              ? 'Excellent tracing!'
              : score >= 60
              ? 'Good job!'
              : score >= 40
              ? 'Nice try!'
              : 'Keep practicing!'}
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.retryButton]}
              onPress={handleRetry}
              activeOpacity={0.7}>
              <Icon name="refresh" size={22} color={kidsColors.textOnDark} />
              <Text style={styles.actionButtonText}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.nextButton]}
              onPress={handleNext}
              activeOpacity={0.7}>
              <Icon name="arrow-right" size={22} color={kidsColors.textOnDark} />
              <Text style={styles.actionButtonText}>
                {currentIndex < items.length - 1 ? 'Next' : 'Finish'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Submit button (if trace has enough points but finger lifted) */}
      {!scored && tracePath.length > 10 && !isTracing && (
        <View style={styles.submitRow}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleRetry}
            activeOpacity={0.7}>
            <Icon name="eraser" size={22} color={kidsColors.textSecondary} />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={submitTrace}
            activeOpacity={0.7}>
            <Icon name="check" size={22} color={kidsColors.textOnDark} />
            <Text style={styles.submitButtonText}>Done!</Text>
          </TouchableOpacity>
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
    alignItems: 'center',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.sm,
  },
  titleText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.md,
    marginBottom: kidsSpacing.md,
  },
  targetBadge: {
    backgroundColor: kidsColors.accent,
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.lg,
    borderRadius: kidsBorderRadius.full,
    ...kidsShadows.button,
  },
  targetText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textOnDark,
  },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
    backgroundColor: kidsColors.hintBg,
    paddingVertical: kidsSpacing.xs,
    paddingHorizontal: kidsSpacing.sm,
    borderRadius: kidsBorderRadius.md,
  },
  hintBadgeText: {
    fontSize: kidsFontSize.xs,
    color: kidsColors.textPrimary,
    fontWeight: kidsFontWeight.medium,
  },
  canvasContainer: {
    ...kidsShadows.float,
    borderRadius: kidsBorderRadius.xl,
  },
  canvas: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    borderWidth: 3,
    borderColor: kidsColors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    position: 'relative',
  },
  guideDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  guideThickDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  guideCharContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideChar: {
    color: kidsColors.accentLight,
    fontWeight: kidsFontWeight.extrabold,
    opacity: 0.12,
  },
  traceDot: {
    position: 'absolute',
  },
  drawPrompt: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: kidsSpacing.sm,
  },
  drawPromptText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textMuted,
    fontWeight: kidsFontWeight.medium,
  },
  scoreCard: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.lg,
    marginTop: kidsSpacing.md,
    alignItems: 'center',
    width: CANVAS_SIZE,
    ...kidsShadows.card,
  },
  starsRow: {
    flexDirection: 'row',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.sm,
  },
  scoreText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textPrimary,
  },
  scoreMessage: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textSecondary,
    marginBottom: kidsSpacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: kidsSpacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.lg,
    borderRadius: kidsBorderRadius.full,
    ...kidsShadows.button,
  },
  retryButton: {
    backgroundColor: kidsColors.star,
  },
  nextButton: {
    backgroundColor: kidsColors.correct,
  },
  actionButtonText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
  submitRow: {
    flexDirection: 'row',
    gap: kidsSpacing.md,
    marginTop: kidsSpacing.md,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.lg,
    borderRadius: kidsBorderRadius.full,
    backgroundColor: kidsColors.card,
    borderWidth: 2,
    borderColor: kidsColors.border,
  },
  clearButtonText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textSecondary,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
    paddingVertical: kidsSpacing.sm,
    paddingHorizontal: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.full,
    backgroundColor: kidsColors.correct,
    ...kidsShadows.button,
  },
  submitButtonText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
});

export default TracingTemplate;
