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
const CANVAS_SIZE = Math.min(SCREEN_WIDTH - 40, 340);
const PAINT_THRESHOLD = 0.2;
const COLOR_CYCLE_MS = 2000;
const STEP_INTERVAL = 120; // ms between path steps

const BRUSH_COLORS = [
  '#FF6D00', '#E040FB', '#00BFA5', '#FF1744',
  '#2979FF', '#FFD600', '#76FF03', '#F50057',
];

const COLORS = {
  bg: '#E8EAF6',
  card: '#FFFFFF',
  accent: '#536DFE',
  correct: '#4CAF50',
  yellow: '#FFD600',
  textPrimary: '#333333',
  textMuted: '#888888',
  canvas: '#FAFAFA',
  canvasBorder: '#C5CAE9',
  targetPath: '#E0E0E0',
  targetDot: '#BDBDBD',
};

// Pre-built shapes as point arrays (normalized 0-1 within canvas)
const SHAPE_PATHS = {
  star: (() => {
    const pts = [];
    const cx = 0.5, cy = 0.5, outerR = 0.45, innerR = 0.2;
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 2) + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? outerR : innerR;
      pts.push([cx + r * Math.cos(angle), cy - r * Math.sin(angle)]);
    }
    pts.push(pts[0]); // close
    return pts;
  })(),
  heart: (() => {
    const pts = [];
    for (let t = 0; t <= Math.PI * 2; t += 0.15) {
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push([0.5 + x / 40, 0.5 + y / 40]);
    }
    return pts;
  })(),
  house: [
    [0.2, 0.9], [0.2, 0.5], [0.5, 0.15], [0.8, 0.5],
    [0.8, 0.9], [0.2, 0.9], [0.2, 0.5], [0.5, 0.15],
    [0.8, 0.5], [0.5, 0.9], [0.5, 0.65], [0.65, 0.65],
    [0.65, 0.9],
  ],
  A: [
    [0.15, 0.9], [0.5, 0.1], [0.85, 0.9],
    [0.68, 0.55], [0.32, 0.55],
  ],
  triangle: [
    [0.5, 0.1], [0.9, 0.9], [0.1, 0.9], [0.5, 0.1],
  ],
  circle: (() => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      pts.push([0.5 + 0.4 * Math.cos(angle), 0.5 + 0.4 * Math.sin(angle)]);
    }
    return pts;
  })(),
  square: [
    [0.15, 0.15], [0.85, 0.15], [0.85, 0.85],
    [0.15, 0.85], [0.15, 0.15],
  ],
};

const VoicePaintTemplate = ({config, onComplete, onAnswer}) => {
  const questions = config?.questions || config?.content?.shapes || [];

  const {amplitude, isListening, startListening, stopListening} =
    useMicAmplitude(1.0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [pathIndex, setPathIndex] = useState(0);
  const [paintedDots, setPaintedDots] = useState([]);
  const [currentColorIdx, setCurrentColorIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [roundDone, setRoundDone] = useState(false);

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const stepTimerRef = useRef(null);
  const colorTimerRef = useRef(null);
  const amplitudeRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  amplitudeRef.current = amplitude;

  const currentQ = questions[currentIndex] || null;
  const shapeName = currentQ?.shape || 'star';
  const targetPath =
    currentQ?.points?.map(p => [p[0] / CANVAS_SIZE, p[1] / CANVAS_SIZE]) ||
    SHAPE_PATHS[shapeName] ||
    SHAPE_PATHS.star;

  useEffect(() => {
    startListening();
    return () => {
      mountedRef.current = false;
      stopListening();
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      if (colorTimerRef.current) clearInterval(colorTimerRef.current);
    };
  }, []);

  // Color cycling
  useEffect(() => {
    colorTimerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setCurrentColorIdx(prev => (prev + 1) % BRUSH_COLORS.length);
    }, COLOR_CYCLE_MS);
    return () => {
      if (colorTimerRef.current) clearInterval(colorTimerRef.current);
    };
  }, []);

  // Path stepping: advance along path when painting
  useEffect(() => {
    if (roundDone) return;

    stepTimerRef.current = setInterval(() => {
      if (!mountedRef.current || roundDone) return;

      if (amplitudeRef.current >= PAINT_THRESHOLD && pathIndex < targetPath.length) {
        const pt = targetPath[pathIndex];
        const dotSize = Math.max(6, amplitudeRef.current * 24);
        const colorIdx = Math.floor(Date.now() / COLOR_CYCLE_MS) % BRUSH_COLORS.length;

        setPaintedDots(prev => [
          ...prev,
          {
            x: pt[0] * CANVAS_SIZE,
            y: pt[1] * CANVAS_SIZE,
            size: dotSize,
            color: BRUSH_COLORS[colorIdx],
          },
        ]);

        setPathIndex(prev => prev + 1);

        // Pulse on paint
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 50,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, STEP_INTERVAL);

    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [pathIndex, roundDone, targetPath]);

  // Check completion
  useEffect(() => {
    if (pathIndex >= targetPath.length && targetPath.length > 0 && !roundDone) {
      setRoundDone(true);

      const coverage = paintedDots.length / targetPath.length;
      const roundPts = Math.round(coverage * 10);
      setScore(roundPts);
      setTotalScore(prev => prev + roundPts);
      onAnswer(coverage > 0.5);

      Animated.timing(progressAnim, {
        toValue: (currentIndex + 1) / questions.length,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [pathIndex, targetPath.length, roundDone]);

  const nextShape = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setPathIndex(0);
      setPaintedDots([]);
      setRoundDone(false);
      setScore(0);
    } else if (!completedRef.current) {
      completedRef.current = true;
      onComplete({
        score: totalScore + score,
        total: questions.length * 10,
        correct: Math.round(
          ((totalScore + score) / (questions.length * 10)) * questions.length,
        ),
        wrong:
          questions.length -
          Math.round(
            ((totalScore + score) / (questions.length * 10)) * questions.length,
          ),
        timeSpent: Math.round((Date.now() - startTimeRef.current) / 1000),
      });
    }
  }, [currentIndex, questions.length, totalScore, score]);

  if (questions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No shapes available</Text>
      </View>
    );
  }

  const brushColor = BRUSH_COLORS[currentColorIdx];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Voice Paint</Text>
        <Text style={styles.headerInfo}>
          {currentIndex + 1}/{questions.length}
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

      {/* Shape label */}
      <View style={styles.labelArea}>
        <Text style={styles.labelEmoji}>{'\uD83C\uDFA8'}</Text>
        <Text style={styles.labelText}>
          Draw: {currentQ?.label || shapeName}
        </Text>
      </View>

      {/* Canvas */}
      <Animated.View
        style={[
          styles.canvasWrapper,
          {transform: [{scale: pulseAnim}]},
        ]}>
        <View style={styles.canvas}>
          {/* Target path dots (faint guide) */}
          {targetPath.map((pt, i) => (
            <View
              key={`t-${i}`}
              style={[
                styles.targetDot,
                {
                  left: pt[0] * CANVAS_SIZE - 3,
                  top: pt[1] * CANVAS_SIZE - 3,
                },
              ]}
            />
          ))}

          {/* Painted dots */}
          {paintedDots.map((dot, i) => (
            <View
              key={`p-${i}`}
              style={[
                styles.paintDot,
                {
                  left: dot.x - dot.size / 2,
                  top: dot.y - dot.size / 2,
                  width: dot.size,
                  height: dot.size,
                  borderRadius: dot.size / 2,
                  backgroundColor: dot.color,
                },
              ]}
            />
          ))}

          {/* Current brush position indicator */}
          {pathIndex < targetPath.length && (
            <View
              style={[
                styles.brushIndicator,
                {
                  left: targetPath[pathIndex][0] * CANVAS_SIZE - 12,
                  top: targetPath[pathIndex][1] * CANVAS_SIZE - 12,
                  backgroundColor:
                    amplitude >= PAINT_THRESHOLD
                      ? brushColor
                      : 'transparent',
                  borderColor: brushColor,
                },
              ]}
            />
          )}
        </View>
      </Animated.View>

      {/* Voice instruction */}
      <View style={styles.voiceArea}>
        <Text style={styles.voiceEmoji}>
          {amplitude >= PAINT_THRESHOLD ? '\uD83C\uDFA4' : '\uD83E\uDD2B'}
        </Text>
        <Text style={styles.voiceText}>
          {roundDone
            ? 'Masterpiece!'
            : amplitude >= PAINT_THRESHOLD
            ? 'Painting... Louder = bigger brush!'
            : 'Speak to paint!'}
        </Text>
      </View>

      {/* Amplitude meter */}
      <View style={styles.ampArea}>
        <View style={styles.ampBarBg}>
          <View
            style={[
              styles.ampBarFill,
              {
                width: `${Math.min(amplitude * 100, 100)}%`,
                backgroundColor: brushColor,
              },
            ]}
          />
        </View>
        <View style={styles.colorPreview}>
          <View
            style={[styles.colorDot, {backgroundColor: brushColor}]}
          />
        </View>
      </View>

      {/* Path progress */}
      <Text style={styles.pathProgress}>
        {Math.round((pathIndex / targetPath.length) * 100)}% drawn
      </Text>

      {/* Round done */}
      {roundDone && (
        <TouchableOpacity style={styles.nextButton} onPress={nextShape}>
          <Text style={styles.nextButtonText}>
            {currentIndex + 1 < questions.length ? 'Next Shape' : 'Finish'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Score */}
      <View style={styles.scoreArea}>
        <Text style={styles.scoreLabel}>Total Score</Text>
        <Text style={styles.scoreValue}>{totalScore}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: 'center',
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
    width: '100%',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.accent,
  },
  headerInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  labelArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  labelEmoji: {
    fontSize: 28,
  },
  labelText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  canvasWrapper: {
    marginBottom: 12,
  },
  canvas: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: COLORS.canvas,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.canvasBorder,
    position: 'relative',
    overflow: 'hidden',
  },
  targetDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.targetDot,
  },
  paintDot: {
    position: 'absolute',
  },
  brushIndicator: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
  },
  voiceArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  voiceEmoji: {
    fontSize: 24,
  },
  voiceText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  ampArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 4,
  },
  ampBarBg: {
    flex: 1,
    height: 14,
    backgroundColor: '#E0E0E0',
    borderRadius: 7,
    overflow: 'hidden',
  },
  ampBarFill: {
    height: '100%',
    borderRadius: 7,
  },
  colorPreview: {
    padding: 4,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 2,
  },
  pathProgress: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  nextButton: {
    backgroundColor: COLORS.correct,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginBottom: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scoreArea: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  scoreLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.yellow,
  },
});

export default VoicePaintTemplate;
