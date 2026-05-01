import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import useMicAmplitude from '../../../../../hooks/useMicAmplitude';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const COLORS = {
  bg: '#FFF9E6',
  card: '#FFFFFF',
  accent: '#7C4DFF',
  correct: '#4CAF50',
  incorrect: '#FF5252',
  star: '#FFD600',
  pink: '#FF80AB',
  green: '#69F0AE',
  purple: '#B388FF',
  yellow: '#FFE082',
  textPrimary: '#333333',
  textMuted: '#999999',
  amplitudeBar: '#7C4DFF',
  amplitudeBg: '#EDE7F6',
};

const AMPLITUDE_THRESHOLD = 0.3;

/**
 * VoiceSpellTemplate - Word appears with missing letters.
 * Kid says the word out loud. Amplitude threshold triggers letter reveal.
 * Higher amplitude = faster reveal.
 */

const LetterBox = ({letter, revealed, index}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (revealed) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [revealed]);

  const bgColor = revealed ? COLORS.green : COLORS.amplitudeBg;

  return (
    <Animated.View
      style={[
        styles.letterBox,
        {
          backgroundColor: bgColor,
          transform: [
            {
              scale: revealed
                ? scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  })
                : 1,
            },
          ],
        },
      ]}>
      <Text style={styles.letterText}>
        {revealed ? letter.toUpperCase() : '_'}
      </Text>
    </Animated.View>
  );
};

const VoiceSpellTemplate = ({config, onComplete, onAnswer}) => {
  const questions = config?.questions || config?.content?.words || [];
  const difficulty = config?.difficulty || 1;
  const sensitivity = difficulty <= 2 ? 1.2 : 1.0;

  const {amplitude, isListening, startListening, stopListening} =
    useMicAmplitude(sensitivity);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [silenceTimer, setSilenceTimer] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const wordStartRef = useRef(Date.now());
  const silenceRef = useRef(null);
  const revealTimerRef = useRef(null);
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const amplitudeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentQuestion =
    questions.length > 0 ? questions[currentIndex] : null;
  const currentWord = currentQuestion?.word || '';
  const totalLetters = currentWord.length;

  // Start listening on mount
  useEffect(() => {
    startListening();
    return () => {
      mountedRef.current = false;
      stopListening();
      if (silenceRef.current) clearInterval(silenceRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // Animate amplitude bar
  useEffect(() => {
    Animated.timing(amplitudeAnim, {
      toValue: amplitude,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [amplitude]);

  // Reveal letters when speaking loud enough
  useEffect(() => {
    if (!currentWord || showSuccess) return;

    if (amplitude >= AMPLITUDE_THRESHOLD && revealedCount < totalLetters) {
      // Speed based on amplitude: higher = faster reveal
      const delay = Math.max(200, 800 - amplitude * 600);

      if (!revealTimerRef.current) {
        revealTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setRevealedCount(prev => {
            const next = Math.min(prev + 1, totalLetters);
            // Bounce animation on reveal
            Animated.sequence([
              Animated.timing(bounceAnim, {
                toValue: 1.3,
                duration: 100,
                useNativeDriver: true,
              }),
              Animated.spring(bounceAnim, {
                toValue: 1,
                friction: 3,
                useNativeDriver: true,
              }),
            ]).start();
            return next;
          });
          revealTimerRef.current = null;
        }, delay);
      }
    } else if (amplitude < 0.1 && revealedCount < totalLetters) {
      // Silence tracking - reset progress if quiet too long
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    }

    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [amplitude, revealedCount, totalLetters, showSuccess, currentWord]);

  // Check word completion
  useEffect(() => {
    if (revealedCount >= totalLetters && totalLetters > 0 && !showSuccess) {
      const timeForWord = (Date.now() - wordStartRef.current) / 1000;
      const wordScore = Math.max(1, Math.round(10 - timeForWord));

      setShowSuccess(true);
      setScore(prev => prev + wordScore);
      setCorrect(prev => prev + 1);
      onAnswer(true);

      // Progress animation
      Animated.timing(progressAnim, {
        toValue: (currentIndex + 1) / questions.length,
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Next word after a brief celebration
      const timeout = setTimeout(() => {
        if (!mountedRef.current) return;
        if (currentIndex + 1 < questions.length) {
          setCurrentIndex(prev => prev + 1);
          setRevealedCount(0);
          setShowSuccess(false);
          wordStartRef.current = Date.now();
        } else if (!completedRef.current) {
          completedRef.current = true;
          onComplete({
            score,
            total: questions.length,
            correct: correct + 1,
            wrong,
            timeSpent: Math.round((Date.now() - startTimeRef.current) / 1000),
          });
        }
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [revealedCount, totalLetters]);

  if (questions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No words available</Text>
      </View>
    );
  }

  const amplitudeWidth = amplitudeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Voice Spell</Text>
        <Text style={styles.headerScore}>
          {currentIndex + 1}/{questions.length}
        </Text>
      </View>

      {/* Progress bar */}
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

      {/* Hint and emoji */}
      {currentQuestion && (
        <View style={styles.hintArea}>
          <Text style={styles.emojiDisplay}>
            {currentQuestion.image || currentQuestion.emoji || ''}
          </Text>
          <Text style={styles.hintText}>
            {currentQuestion.hint || 'Say the word!'}
          </Text>
        </View>
      )}

      {/* Letter boxes */}
      <Animated.View
        style={[styles.wordContainer, {transform: [{scale: bounceAnim}]}]}>
        {currentWord.split('').map((letter, i) => (
          <LetterBox
            key={`${currentIndex}-${i}`}
            letter={letter}
            revealed={i < revealedCount}
            index={i}
          />
        ))}
      </Animated.View>

      {/* Success banner */}
      {showSuccess && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>Awesome! You spelled it!</Text>
        </View>
      )}

      {/* Amplitude visualizer */}
      <View style={styles.amplitudeArea}>
        <Text style={styles.micLabel}>
          {isListening ? 'Speak the word out loud!' : 'Microphone starting...'}
        </Text>
        <View style={styles.amplitudeBarBg}>
          <Animated.View
            style={[
              styles.amplitudeBarFill,
              {width: amplitudeWidth},
              amplitude >= AMPLITUDE_THRESHOLD && styles.amplitudeBarActive,
            ]}
          />
        </View>
        <View style={styles.thresholdIndicator}>
          <View style={[styles.thresholdLine, {left: '30%'}]} />
          <Text style={[styles.thresholdLabel, {left: '25%'}]}>Min</Text>
        </View>
      </View>

      {/* Score */}
      <View style={styles.scoreArea}>
        <Text style={styles.scoreLabel}>Score</Text>
        <Text style={styles.scoreValue}>{score}</Text>
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
  headerScore: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.amplitudeBg,
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.correct,
    borderRadius: 4,
  },
  hintArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emojiDisplay: {
    fontSize: 64,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  wordContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  letterBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.purple,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  letterText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  successBanner: {
    backgroundColor: COLORS.correct,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: 16,
  },
  successText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  amplitudeArea: {
    marginBottom: 16,
    alignItems: 'center',
  },
  micLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  amplitudeBarBg: {
    width: '100%',
    height: 24,
    backgroundColor: COLORS.amplitudeBg,
    borderRadius: 12,
    overflow: 'hidden',
  },
  amplitudeBarFill: {
    height: '100%',
    backgroundColor: COLORS.amplitudeBar,
    borderRadius: 12,
  },
  amplitudeBarActive: {
    backgroundColor: COLORS.correct,
  },
  thresholdIndicator: {
    width: '100%',
    height: 20,
    position: 'relative',
  },
  thresholdLine: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 10,
    backgroundColor: COLORS.incorrect,
  },
  thresholdLabel: {
    position: 'absolute',
    top: 10,
    fontSize: 10,
    color: COLORS.incorrect,
    fontWeight: '600',
  },
  scoreArea: {
    alignItems: 'center',
    marginTop: 8,
  },
  scoreLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.star,
  },
});

export default VoiceSpellTemplate;
