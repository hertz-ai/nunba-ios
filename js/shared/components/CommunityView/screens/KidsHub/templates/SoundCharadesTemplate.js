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
const BAR_COUNT = 20;
const RECORD_DURATION_MS = 3000;

const COLORS = {
  bg: '#F3E5F5',
  card: '#FFFFFF',
  accent: '#E040FB',
  correct: '#4CAF50',
  yellow: '#FFD600',
  pink: '#FF80AB',
  purple: '#9C27B0',
  orange: '#FF9800',
  textPrimary: '#333333',
  textMuted: '#888888',
  barActive: '#E040FB',
  barInactive: '#E1BEE7',
  starFill: '#FFD600',
  starEmpty: '#E0E0E0',
};

// Expected amplitude patterns for scoring
const PATTERNS = {
  spike: [0, 0.8, 0.1, 0.8, 0.1, 0],         // bark, clap
  sustained: [0.2, 0.5, 0.6, 0.6, 0.5, 0.3],  // bee, engine
  rising: [0.1, 0.2, 0.4, 0.6, 0.8, 0.9],     // siren, wind
  falling: [0.9, 0.7, 0.5, 0.3, 0.1, 0],       // splash
  'rising-falling': [0.1, 0.4, 0.7, 0.9, 0.6, 0.2], // wave
  wave: [0.3, 0.7, 0.3, 0.7, 0.3, 0.7],       // alternating
};

function computePatternScore(recorded, patternName) {
  const template = PATTERNS[patternName] || PATTERNS.sustained;
  if (recorded.length === 0) return 0;

  // Downsample recorded to template length
  const sampled = [];
  for (let i = 0; i < template.length; i++) {
    const idx = Math.floor((i / template.length) * recorded.length);
    sampled.push(recorded[Math.min(idx, recorded.length - 1)]);
  }

  // Normalize sampled
  const maxR = Math.max(...sampled, 0.01);
  const normalized = sampled.map(v => v / maxR);

  // Cosine similarity
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < template.length; i++) {
    dot += normalized[i] * template[i];
    magA += normalized[i] * normalized[i];
    magB += template[i] * template[i];
  }
  const similarity = dot / (Math.sqrt(magA) * Math.sqrt(magB) + 0.001);

  // Also consider that they actually made sound
  const avgAmp = sampled.reduce((s, v) => s + v, 0) / sampled.length;
  const volumeBonus = Math.min(avgAmp / 0.3, 1.0);

  const finalScore = similarity * 0.7 + volumeBonus * 0.3;

  if (finalScore > 0.75) return 3;
  if (finalScore > 0.5) return 2;
  if (finalScore > 0.25) return 1;
  return 0;
}

const StarDisplay = ({stars, maxStars = 3}) => (
  <View style={styles.starsRow}>
    {Array.from({length: maxStars}).map((_, i) => (
      <Text key={i} style={styles.starIcon}>
        {i < stars ? '\u2B50' : '\u2606'}
      </Text>
    ))}
  </View>
);

const SoundCharadesTemplate = ({config, onComplete, onAnswer}) => {
  const questions = config?.questions || config?.content?.charades || [];

  const {amplitude, isListening, startListening, stopListening} =
    useMicAmplitude(1.0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('ready'); // ready, recording, result
  const [recordedAmplitudes, setRecordedAmplitudes] = useState([]);
  const [stars, setStars] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [barHeights] = useState(() =>
    Array.from({length: BAR_COUNT}, () => new Animated.Value(0.05)),
  );

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const recordingRef = useRef([]);
  const recordIntervalRef = useRef(null);
  const timerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(1)).current;

  const currentQ = questions[currentIndex] || null;

  useEffect(() => {
    startListening();
    return () => {
      mountedRef.current = false;
      stopListening();
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Animate bars based on amplitude
  useEffect(() => {
    if (phase !== 'recording') return;
    barHeights.forEach((anim, i) => {
      const offset = Math.sin(Date.now() / 200 + i * 0.5) * 0.15;
      const target = Math.max(0.05, amplitude + offset * amplitude);
      Animated.timing(anim, {
        toValue: target,
        duration: 80,
        useNativeDriver: false,
      }).start();
    });
  }, [amplitude, phase]);

  // Emoji wobble during recording
  useEffect(() => {
    if (phase === 'recording') {
      const wobble = Animated.loop(
        Animated.sequence([
          Animated.timing(emojiScale, {
            toValue: 1.1 + amplitude * 0.3,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(emojiScale, {
            toValue: 1.0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      );
      wobble.start();
      return () => wobble.stop();
    }
  }, [phase, amplitude]);

  const startRecording = useCallback(() => {
    recordingRef.current = [];
    setPhase('recording');

    // Sample amplitude every 100ms
    recordIntervalRef.current = setInterval(() => {
      recordingRef.current.push(amplitude);
    }, 100);

    // Stop after RECORD_DURATION_MS
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
      finishRecording();
    }, RECORD_DURATION_MS);
  }, [amplitude]);

  const finishRecording = useCallback(() => {
    const recorded = recordingRef.current;
    setRecordedAmplitudes(recorded);

    const patternName = currentQ?.pattern || 'sustained';
    const earnedStars = computePatternScore(recorded, patternName);

    setStars(earnedStars);
    setTotalStars(prev => prev + earnedStars);
    setTotalScore(prev => prev + earnedStars);
    setPhase('result');

    onAnswer(earnedStars >= 2);

    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / questions.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, currentQ, questions.length, onAnswer]);

  const nextQuestion = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setPhase('ready');
      setStars(0);
      setRecordedAmplitudes([]);
      recordingRef.current = [];
    } else if (!completedRef.current) {
      completedRef.current = true;
      onComplete({
        score: totalScore + stars,
        total: questions.length * 3,
        correct: Math.round((totalStars + stars) / 2),
        wrong: questions.length - Math.round((totalStars + stars) / 2),
        timeSpent: Math.round((Date.now() - startTimeRef.current) / 1000),
      });
    }
  }, [currentIndex, questions.length, totalScore, totalStars, stars, onComplete]);

  if (questions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No charades available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sound Charades</Text>
        <Text style={styles.headerScore}>
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

      {/* Main display */}
      <View style={styles.mainArea}>
        {currentQ && (
          <>
            <Animated.Text
              style={[
                styles.emojiDisplay,
                {transform: [{scale: emojiScale}]},
              ]}>
              {currentQ.emoji || ''}
            </Animated.Text>
            <Text style={styles.labelText}>
              {currentQ.label || 'Make this sound!'}
            </Text>
          </>
        )}

        {/* Waveform visualizer */}
        {phase === 'recording' && (
          <View style={styles.waveform}>
            {barHeights.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, 80],
                    }),
                    backgroundColor:
                      amplitude > 0.3 ? COLORS.barActive : COLORS.barInactive,
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Phase-specific UI */}
        {phase === 'ready' && (
          <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
            <Text style={styles.recordButtonEmoji}>{'\uD83C\uDFA4'}</Text>
            <Text style={styles.recordButtonText}>
              Make the sound of: {currentQ?.label || ''}
            </Text>
            <Text style={styles.recordButtonSub}>Tap to start (3 seconds)</Text>
          </TouchableOpacity>
        )}

        {phase === 'recording' && (
          <View style={styles.recordingIndicator}>
            <Text style={styles.recordingDot}>{'\uD83D\uDD34'}</Text>
            <Text style={styles.recordingText}>Recording... Make the sound!</Text>
          </View>
        )}

        {phase === 'result' && (
          <View style={styles.resultArea}>
            <StarDisplay stars={stars} />
            <Text style={styles.resultText}>
              {stars === 3
                ? 'Amazing! Perfect sound!'
                : stars === 2
                ? 'Great job!'
                : stars === 1
                ? 'Good try!'
                : 'Try to be louder!'}
            </Text>
            <TouchableOpacity style={styles.nextButton} onPress={nextQuestion}>
              <Text style={styles.nextButtonText}>
                {currentIndex + 1 < questions.length ? 'Next Sound' : 'Finish'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Total score */}
      <View style={styles.scoreArea}>
        <Text style={styles.totalLabel}>Total Stars</Text>
        <Text style={styles.totalValue}>
          {totalStars} / {questions.length * 3}
        </Text>
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
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.purple,
  },
  headerScore: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.barInactive,
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  mainArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiDisplay: {
    fontSize: 80,
    marginBottom: 12,
  },
  labelText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 90,
    gap: 3,
    marginVertical: 16,
  },
  bar: {
    width: (SCREEN_WIDTH - 80) / BAR_COUNT - 3,
    borderRadius: 3,
    minHeight: 4,
  },
  recordButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.purple,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  recordButtonEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  recordButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  recordButtonSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  recordingDot: {
    fontSize: 20,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.purple,
  },
  resultArea: {
    alignItems: 'center',
    gap: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starIcon: {
    fontSize: 40,
  },
  resultText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nextButton: {
    backgroundColor: COLORS.correct,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scoreArea: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.yellow,
  },
});

export default SoundCharadesTemplate;
