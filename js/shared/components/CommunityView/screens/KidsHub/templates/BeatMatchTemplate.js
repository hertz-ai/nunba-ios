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
const BEAT_THRESHOLD = 0.5;
const PERFECT_WINDOW = 100; // ms
const GOOD_WINDOW = 200; // ms

const COLORS = {
  bg: '#FFF3E0',
  card: '#FFFFFF',
  accent: '#FF6D00',
  purple: '#7C4DFF',
  pink: '#FF80AB',
  green: '#4CAF50',
  yellow: '#FFD600',
  red: '#F44336',
  textPrimary: '#333333',
  textMuted: '#888888',
  beatDefault: '#FFE0B2',
  beatPerfect: '#4CAF50',
  beatGood: '#FF9800',
  beatMiss: '#EF5350',
  beatActive: '#FF6D00',
  timeline: '#FFE0B2',
};

const BeatMatchTemplate = ({config, onComplete, onAnswer}) => {
  const questions = config?.questions || config?.content?.patterns || [];

  const {amplitude, isListening, startListening, stopListening} =
    useMicAmplitude(1.2);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('demo'); // demo, play, result
  const [beatResults, setBeatResults] = useState([]); // per-beat: 'perfect','good','miss'
  const [currentBeatIdx, setCurrentBeatIdx] = useState(-1);
  const [playerBeats, setPlayerBeats] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const playStartRef = useRef(0);
  const lastBeatRef = useRef(0);
  const demoTimerRef = useRef(null);
  const playTimerRef = useRef(null);
  const beatDetectedRef = useRef(false);

  // Animations
  const pulseAnims = useRef([]).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const currentQ = questions[currentIndex] || null;
  const beats = currentQ?.beats || [];
  const tempo = currentQ?.tempo || 'medium';
  const tempoMultiplier = tempo === 'slow' ? 1.5 : tempo === 'fast' ? 0.7 : 1.0;

  // Ensure we have enough pulse anims
  while (pulseAnims.length < beats.length) {
    pulseAnims.push(new Animated.Value(0));
  }

  useEffect(() => {
    startListening();
    return () => {
      mountedRef.current = false;
      stopListening();
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, []);

  // Demo: show the pattern
  useEffect(() => {
    if (phase !== 'demo' || beats.length === 0) return;

    setBeatResults([]);
    setPlayerBeats([]);
    setCurrentBeatIdx(-1);

    let timeouts = [];
    beats.forEach((beatTime, i) => {
      const t = setTimeout(() => {
        if (!mountedRef.current) return;
        setCurrentBeatIdx(i);

        // Pulse animation
        if (pulseAnims[i]) {
          pulseAnims[i].setValue(0);
          Animated.sequence([
            Animated.timing(pulseAnims[i], {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnims[i], {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
      }, beatTime * tempoMultiplier);
      timeouts.push(t);
    });

    // After demo finishes, switch to play
    const lastBeat = beats[beats.length - 1] || 0;
    const demoEnd = setTimeout(() => {
      if (!mountedRef.current) return;
      setCurrentBeatIdx(-1);
      setPhase('play');
      playStartRef.current = Date.now();
      lastBeatRef.current = 0;
    }, (lastBeat + 500) * tempoMultiplier);
    timeouts.push(demoEnd);

    return () => timeouts.forEach(clearTimeout);
  }, [phase, currentIndex]);

  // Detect beats during play phase
  useEffect(() => {
    if (phase !== 'play') return;

    if (amplitude >= BEAT_THRESHOLD && !beatDetectedRef.current) {
      beatDetectedRef.current = true;
      const now = Date.now() - playStartRef.current;

      // Find closest expected beat
      let closestIdx = -1;
      let closestDist = Infinity;

      beats.forEach((beatTime, i) => {
        const adjustedTime = beatTime * tempoMultiplier;
        const dist = Math.abs(now - adjustedTime);
        if (dist < closestDist && !playerBeats.includes(i)) {
          closestDist = dist;
          closestIdx = i;
        }
      });

      if (closestIdx >= 0) {
        let result = 'miss';
        if (closestDist <= PERFECT_WINDOW) result = 'perfect';
        else if (closestDist <= GOOD_WINDOW) result = 'good';

        setPlayerBeats(prev => [...prev, closestIdx]);
        setBeatResults(prev => {
          const updated = [...prev];
          updated[closestIdx] = result;
          return updated;
        });

        // Animate the beat circle
        if (pulseAnims[closestIdx]) {
          pulseAnims[closestIdx].setValue(0);
          Animated.spring(pulseAnims[closestIdx], {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
          }).start();
        }

        // Bounce animation
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1.3,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.spring(bounceAnim, {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }

    if (amplitude < 0.2) {
      beatDetectedRef.current = false;
    }
  }, [amplitude, phase, playerBeats]);

  // Check if play phase is done
  useEffect(() => {
    if (phase !== 'play') return;

    const lastBeat = beats[beats.length - 1] || 0;
    const totalTime = (lastBeat + 1000) * tempoMultiplier;

    playTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      finishRound();
    }, totalTime);

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [phase, currentIndex]);

  const finishRound = useCallback(() => {
    // Score the round
    const results = [];
    beats.forEach((_, i) => {
      if (!beatResults[i]) results[i] = 'miss';
      else results[i] = beatResults[i];
    });
    setBeatResults(results);

    let score = 0;
    results.forEach(r => {
      if (r === 'perfect') score += 3;
      else if (r === 'good') score += 2;
      else if (r !== 'miss') score += 1;
    });

    setRoundScore(score);
    setTotalScore(prev => prev + score);
    setPhase('result');

    const isGoodRound = score >= beats.length * 2;
    onAnswer(isGoodRound);

    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / questions.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [beatResults, beats, currentIndex, questions.length]);

  const nextRound = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setPhase('demo');
      setBeatResults([]);
      setPlayerBeats([]);
      setRoundScore(0);
      beatDetectedRef.current = false;
      pulseAnims.forEach(a => a.setValue(0));
    } else if (!completedRef.current) {
      completedRef.current = true;
      const maxScore = questions.reduce(
        (sum, q) => sum + (q.beats?.length || 0) * 3,
        0,
      );
      onComplete({
        score: totalScore + roundScore,
        total: maxScore,
        correct: Math.round(
          ((totalScore + roundScore) / Math.max(maxScore, 1)) *
            questions.length,
        ),
        wrong:
          questions.length -
          Math.round(
            ((totalScore + roundScore) / Math.max(maxScore, 1)) *
              questions.length,
          ),
        timeSpent: Math.round((Date.now() - startTimeRef.current) / 1000),
      });
    }
  }, [currentIndex, questions.length, totalScore, roundScore]);

  if (questions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No beat patterns available</Text>
      </View>
    );
  }

  const getBeatColor = (idx) => {
    if (beatResults[idx] === 'perfect') return COLORS.beatPerfect;
    if (beatResults[idx] === 'good') return COLORS.beatGood;
    if (beatResults[idx] === 'miss') return COLORS.beatMiss;
    if (phase === 'demo' && idx === currentBeatIdx) return COLORS.beatActive;
    return COLORS.beatDefault;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Beat Match</Text>
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

      {/* Phase label */}
      <View style={styles.phaseArea}>
        <Text style={styles.phaseEmoji}>
          {phase === 'demo'
            ? '\uD83D\uDC40'
            : phase === 'play'
            ? '\uD83D\uDC4F'
            : '\u2B50'}
        </Text>
        <Text style={styles.phaseText}>
          {phase === 'demo'
            ? 'Watch the pattern...'
            : phase === 'play'
            ? 'Your turn! Clap to match!'
            : 'Results'}
        </Text>
        {currentQ?.label && (
          <Text style={styles.patternLabel}>{currentQ.label}</Text>
        )}
      </View>

      {/* Beat timeline */}
      <View style={styles.timelineArea}>
        <View style={styles.timeline}>
          {beats.map((_, i) => {
            const color = getBeatColor(i);
            const scale =
              pulseAnims[i]?.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.4],
              }) || 1;

            return (
              <Animated.View
                key={i}
                style={[
                  styles.beatCircle,
                  {
                    backgroundColor: color,
                    transform: [{scale}],
                  },
                ]}>
                <Text style={styles.beatNumber}>{i + 1}</Text>
                {beatResults[i] && phase === 'result' && (
                  <Text style={styles.beatResultLabel}>
                    {beatResults[i] === 'perfect'
                      ? '\u2728'
                      : beatResults[i] === 'good'
                      ? '\uD83D\uDC4D'
                      : '\u274C'}
                  </Text>
                )}
              </Animated.View>
            );
          })}
        </View>
      </View>

      {/* Amplitude feedback during play */}
      {phase === 'play' && (
        <Animated.View
          style={[
            styles.clapIndicator,
            {transform: [{scale: bounceAnim}]},
          ]}>
          <Text style={styles.clapEmoji}>
            {amplitude > BEAT_THRESHOLD ? '\uD83D\uDC4F' : '\uD83E\uDD1A'}
          </Text>
          <View style={styles.ampBar}>
            <View
              style={[
                styles.ampFill,
                {
                  width: `${Math.min(amplitude * 100, 100)}%`,
                  backgroundColor:
                    amplitude > BEAT_THRESHOLD ? COLORS.green : COLORS.accent,
                },
              ]}
            />
          </View>
        </Animated.View>
      )}

      {/* Result */}
      {phase === 'result' && (
        <View style={styles.resultArea}>
          <Text style={styles.resultScore}>
            {roundScore} / {beats.length * 3} points
          </Text>
          <View style={styles.resultBreakdown}>
            <Text style={styles.resultItem}>
              {'\u2728'} Perfect:{' '}
              {beatResults.filter(r => r === 'perfect').length}
            </Text>
            <Text style={styles.resultItem}>
              {'\uD83D\uDC4D'} Good:{' '}
              {beatResults.filter(r => r === 'good').length}
            </Text>
            <Text style={styles.resultItem}>
              {'\u274C'} Miss:{' '}
              {beatResults.filter(r => r === 'miss' || !r).length}
            </Text>
          </View>
          <TouchableOpacity style={styles.nextButton} onPress={nextRound}>
            <Text style={styles.nextButtonText}>
              {currentIndex + 1 < questions.length ? 'Next Beat' : 'Finish'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Total */}
      <View style={styles.totalArea}>
        <Text style={styles.totalLabel}>Total Score</Text>
        <Text style={styles.totalValue}>{totalScore}</Text>
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
    color: COLORS.accent,
  },
  headerInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.timeline,
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  phaseArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  phaseEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  phaseText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  patternLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 4,
  },
  timelineArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timeline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  beatCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  beatNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  beatResultLabel: {
    position: 'absolute',
    bottom: -16,
    fontSize: 14,
  },
  clapIndicator: {
    alignItems: 'center',
    marginBottom: 16,
  },
  clapEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  ampBar: {
    width: '80%',
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  ampFill: {
    height: '100%',
    borderRadius: 8,
  },
  resultArea: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  resultScore: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.accent,
  },
  resultBreakdown: {
    flexDirection: 'row',
    gap: 16,
  },
  resultItem: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  nextButton: {
    backgroundColor: COLORS.green,
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
  totalArea: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.yellow,
  },
});

export default BeatMatchTemplate;
