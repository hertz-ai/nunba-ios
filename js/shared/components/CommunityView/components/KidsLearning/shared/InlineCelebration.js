import React, {useEffect, useRef, useMemo} from 'react';
import {View, Text, Animated, Easing, StyleSheet} from 'react-native';
import {kidsColors, kidsFontSize, kidsFontWeight} from '../../../../../theme/kidsColors';
import TTSManager from './TTSManager';
import {SPRINGS} from './gameThemes';

/**
 * InlineCelebration (React Native) — per-game micro-celebration registry.
 *
 * Each of the 24 game templates gets a UNIQUE celebration animation using
 * React Native's Animated API. This is the RN parity counterpart to the
 * web InlineCelebration.jsx.
 *
 * Props:
 *   type: 'correct' | 'streak' | 'perfect' | 'complete' | 'wrong'
 *   gameTemplate: string
 *   visible: boolean
 *   onDone: () => void
 *   streakCount?: number
 *   score?: { correct: number, total: number }
 */

// ── Shared constants ────────────────────────────────────────────

const STREAK_PHRASES = ['', 'Nice!', 'Awesome!', 'On fire!', 'Unstoppable!', 'Legendary!'];
const WRONG_PHRASES = ['Try again!', 'Almost!', 'So close!', 'One more time!', 'Keep going!'];

function pickWrong() {
  return WRONG_PHRASES[Math.floor(Math.random() * WRONG_PHRASES.length)];
}

function resolvePhrase(type, defaultPhrase, streakCount, score) {
  if (type === 'wrong') return pickWrong();
  if (type === 'streak' && streakCount > 1)
    return STREAK_PHRASES[Math.min(streakCount, STREAK_PHRASES.length - 1)];
  if (type === 'perfect') return 'Perfect score!';
  if (type === 'complete') {
    const pct = score?.total > 0 ? score.correct / score.total : 0;
    return pct >= 0.9 ? 'Amazing!' : pct >= 0.7 ? 'Well done!' : 'Good try!';
  }
  return defaultPhrase;
}

// ── Reusable animated helpers ───────────────────────────────────

function useAnimVal(init = 0) {
  return useRef(new Animated.Value(init)).current;
}

function useAnimVals(count, init = 0) {
  return useRef(Array.from({length: count}, () => new Animated.Value(init))).current;
}

function shakeSeq(anim, mag = 6) {
  return Animated.sequence([
    Animated.timing(anim, {toValue: mag, duration: 50, useNativeDriver: true}),
    Animated.timing(anim, {toValue: -mag, duration: 50, useNativeDriver: true}),
    Animated.timing(anim, {toValue: mag, duration: 50, useNativeDriver: true}),
    Animated.timing(anim, {toValue: 0, duration: 50, useNativeDriver: true}),
  ]);
}

// ── PhrasePill ──────────────────────────────────────────────────

function PhrasePill({text, color}) {
  return (
    <View style={[styles.pill, {backgroundColor: color}]}>
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

function StreakBadge({type, streakCount}) {
  if (type !== 'streak' || streakCount <= 1) return null;
  return <Text style={styles.streakBadge}>{streakCount}x streak!</Text>;
}

function ScoreDisplay({type, score}) {
  if (type !== 'complete' || !score) return null;
  return <Text style={styles.scoreText}>{score.correct}/{score.total}</Text>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PER-GAME CELEBRATION RENDERERS (24 unique Animated animations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── VOICE GAMES ─────────────────────────────────────────────────

// voice_spell: Letters scatter then reassemble
function VoiceSpellRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Perfect pronunciation!', streakCount, score);
  const isWrong = type === 'wrong';
  const letters = ['S', 'P', 'E', 'L', 'L'];
  const anims = useAnimVals(letters.length, 0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    anims.forEach(a => a.setValue(0));
    shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.stagger(60, anims.map(a =>
        Animated.spring(a, {toValue: 1, ...SPRINGS.bouncy})
      )).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      <View style={styles.row}>
        {letters.map((l, i) => {
          const trans = anims[i].interpolate({inputRange: [0, 0.5, 1], outputRange: [0, -20, 0]});
          const scale = anims[i].interpolate({inputRange: [0, 0.5, 1], outputRange: [0.3, 1.3, 1]});
          return (
            <Animated.Text key={i} style={[styles.letterText, {
              color: isWrong ? '#ccc' : '#6C63FF',
              transform: [{translateY: trans}, {scale}],
            }]}>
              {l}
            </Animated.Text>
          );
        })}
      </View>
      {isWrong && <Animated.Text style={[styles.emoji, {transform: [{translateX: shakeAnim}]}]}>📝</Animated.Text>}
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#6C63FF'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// voice_balloon_pop: Balloon burst with confetti particles
function BalloonPopRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Pop!', streakCount, score);
  const isWrong = type === 'wrong';
  const colors = ['#FF6B6B', '#6C63FF', '#4ECDC4', '#FF9F43', '#E040FB', '#2ECC71', '#FFD700', '#FF6B81'];
  const particles = useRef(colors.map(() => ({
    x: new Animated.Value(0), y: new Animated.Value(0), op: new Animated.Value(0),
  }))).current;
  const popScale = useAnimVal(isWrong ? 1 : 2);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    particles.forEach(p => {p.x.setValue(0); p.y.setValue(0); p.op.setValue(0);});
    popScale.setValue(isWrong ? 1 : 2);
    shakeAnim.setValue(0);

    if (isWrong) {
      Animated.sequence([
        Animated.timing(popScale, {toValue: 0.3, duration: 400, useNativeDriver: true}),
      ]).start();
      shakeSeq(shakeAnim).start();
    } else {
      Animated.timing(popScale, {toValue: 0.5, duration: 200, useNativeDriver: true}).start();
      particles.forEach((p, i) => {
        const angle = (i / colors.length) * Math.PI * 2;
        const dist = 50 + Math.random() * 20;
        Animated.parallel([
          Animated.timing(p.x, {toValue: Math.cos(angle) * dist, duration: 400, useNativeDriver: true}),
          Animated.timing(p.y, {toValue: Math.sin(angle) * dist, duration: 400, useNativeDriver: true}),
          Animated.sequence([
            Animated.timing(p.op, {toValue: 1, duration: 100, useNativeDriver: true}),
            Animated.timing(p.op, {toValue: 0, duration: 300, useNativeDriver: true}),
          ]),
        ]).start();
      });
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      <Animated.Text style={[styles.emoji, {transform: [{scale: popScale}, {translateX: shakeAnim}]}]}>
        {isWrong ? '🎈' : '💥'}
      </Animated.Text>
      {!isWrong && particles.map((p, i) => (
        <Animated.View key={i} style={[styles.particle, {
          backgroundColor: colors[i],
          transform: [{translateX: p.x}, {translateY: p.y}],
          opacity: p.op,
        }]} />
      ))}
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#FF6B6B'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// beat_match: Concentric rhythm rings pulsing from center
function BeatMatchRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'On beat!', streakCount, score);
  const isWrong = type === 'wrong';
  const rings = useRef([0, 1, 2].map(() => ({
    scale: new Animated.Value(0), op: new Animated.Value(0.8),
  }))).current;
  const iconScale = useAnimVal(0.8);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    rings.forEach(r => {r.scale.setValue(0); r.op.setValue(0.8);});
    iconScale.setValue(0.8);
    shakeAnim.setValue(0);

    if (isWrong) {
      shakeSeq(shakeAnim).start();
      Animated.spring(iconScale, {toValue: 1, ...SPRINGS.standard}).start();
    } else {
      Animated.spring(iconScale, {toValue: 1, ...SPRINGS.bouncy}).start();
      rings.forEach((r, i) => {
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.parallel([
            Animated.timing(r.scale, {toValue: 3, duration: 500, easing: Easing.out(Easing.circle), useNativeDriver: true}),
            Animated.timing(r.op, {toValue: 0, duration: 500, useNativeDriver: true}),
          ]),
        ]).start();
      });
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      {!isWrong && rings.map((r, i) => (
        <Animated.View key={i} style={[styles.ring, {
          borderColor: '#FF9F43',
          transform: [{scale: r.scale}],
          opacity: r.op,
        }]} />
      ))}
      <Animated.Text style={[styles.emoji, {transform: [{scale: iconScale}, {translateX: shakeAnim}]}]}>
        {isWrong ? '🎵' : '🥁'}
      </Animated.Text>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#FF9F43'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// whisper_shout: Sound wave bars crescendo
function WhisperShoutRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Great control!', streakCount, score);
  const isWrong = type === 'wrong';
  const barCount = 7;
  const bars = useAnimVals(barCount, 0);

  useEffect(() => {
    if (!visible) return;
    bars.forEach(b => b.setValue(0));
    Animated.stagger(50, bars.map((b, i) =>
      Animated.timing(b, {
        toValue: isWrong ? 0.3 : (i + 1) / barCount,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      })
    )).start();
  }, [visible]);

  return (
    <View style={styles.center}>
      <View style={[styles.row, {height: 40, alignItems: 'flex-end', marginBottom: 6}]}>
        {bars.map((b, i) => {
          const height = b.interpolate({inputRange: [0, 1], outputRange: [4, 36]});
          return (
            <Animated.View key={i} style={{
              width: 5, borderRadius: 3, marginHorizontal: 1.5,
              backgroundColor: isWrong ? '#FF4444' : '#00D2D3',
              height,
            }} />
          );
        })}
      </View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#00D2D3'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// sound_charades: Emoji spins and scales with starburst
function SoundCharadesRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Nailed it!', streakCount, score);
  const isWrong = type === 'wrong';
  const spin = useAnimVal(0);
  const scale = useAnimVal(0.3);
  const burstOp = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    spin.setValue(0); scale.setValue(0.3); burstOp.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      Animated.spring(scale, {toValue: 1, ...SPRINGS.standard}).start();
      shakeSeq(shakeAnim).start();
    } else {
      Animated.parallel([
        Animated.timing(spin, {toValue: 1, duration: 600, useNativeDriver: true}),
        Animated.spring(scale, {toValue: 1, ...SPRINGS.bouncy}),
        Animated.sequence([
          Animated.timing(burstOp, {toValue: 0.8, duration: 200, useNativeDriver: true}),
          Animated.timing(burstOp, {toValue: 0, duration: 300, useNativeDriver: true}),
        ]),
      ]).start();
    }
  }, [visible]);

  const rotate = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});

  return (
    <View style={styles.center}>
      {!isWrong && <Animated.View style={[styles.starburst, {opacity: burstOp, transform: [{scale: Animated.multiply(scale, 1.5)}]}]} />}
      <Animated.Text style={[styles.emojiLg, {transform: [{rotate}, {scale}, {translateX: shakeAnim}]}]}>
        🎭
      </Animated.Text>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#A29BFE'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// story_weaver: Page-turn with golden text
function StoryWeaverRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Great storytelling!', streakCount, score);
  const isWrong = type === 'wrong';
  const pageRotate = useAnimVal(isWrong ? 0 : -90);
  const textOp = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    pageRotate.setValue(isWrong ? 0 : -90); textOp.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.sequence([
        Animated.spring(pageRotate, {toValue: 0, ...SPRINGS.standard}),
        Animated.timing(textOp, {toValue: 1, duration: 300, useNativeDriver: true}),
      ]).start();
    }
  }, [visible]);

  const rotateY = pageRotate.interpolate({inputRange: [-90, 0], outputRange: ['-90deg', '0deg']});

  return (
    <View style={styles.center}>
      <Animated.View style={[styles.pageCard, {
        backgroundColor: isWrong ? '#666' : '#FFF8DC',
        borderColor: isWrong ? '#999' : '#DAA520',
        transform: [{perspective: 600}, {rotateY}, {translateX: shakeAnim}],
      }]}>
        <Animated.Text style={[styles.goldenText, {
          opacity: isWrong ? 0.4 : textOp,
          color: isWrong ? '#999' : '#DAA520',
        }]}>
          {isWrong ? '...' : 'The End'}
        </Animated.Text>
      </Animated.View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#2ECC71'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// voice_paint: Paint splatters from center
function VoicePaintRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Beautiful!', streakCount, score);
  const isWrong = type === 'wrong';
  const splatColors = ['#FF6B81', '#6C63FF', '#00D2D3', '#FF9F43', '#2ECC71', '#E040FB'];
  const splats = useRef(splatColors.map(() => ({
    x: new Animated.Value(0), y: new Animated.Value(0), scale: new Animated.Value(0), op: new Animated.Value(0),
  }))).current;
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    splats.forEach(s => {s.x.setValue(0); s.y.setValue(0); s.scale.setValue(0); s.op.setValue(0);});
    shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      splats.forEach((s, i) => {
        const angle = (i / splatColors.length) * Math.PI * 2;
        const dist = 25 + (i % 3) * 10;
        Animated.parallel([
          Animated.timing(s.x, {toValue: Math.cos(angle) * dist, duration: 400, useNativeDriver: true}),
          Animated.timing(s.y, {toValue: Math.sin(angle) * dist, duration: 400, useNativeDriver: true}),
          Animated.spring(s.scale, {toValue: 1, ...SPRINGS.bouncy}),
          Animated.sequence([
            Animated.timing(s.op, {toValue: 0.9, duration: 150, useNativeDriver: true}),
            Animated.timing(s.op, {toValue: 0.7, duration: 250, useNativeDriver: true}),
          ]),
        ]).start();
      });
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      {!isWrong && splats.map((s, i) => (
        <Animated.View key={i} style={[styles.splat, {
          backgroundColor: splatColors[i],
          transform: [{translateX: s.x}, {translateY: s.y}, {scale: s.scale}],
          opacity: s.op,
        }]} />
      ))}
      <Animated.Text style={[styles.emoji, {transform: [{translateX: shakeAnim}]}]}>
        {isWrong ? '🎨' : '🎨'}
      </Animated.Text>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#FF6B81'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// peekaboo: Curtains slide open to reveal character
function PeekabooRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'You found me!', streakCount, score);
  const isWrong = type === 'wrong';
  const leftX = useAnimVal(0);
  const rightX = useAnimVal(0);
  const charScale = useAnimVal(0.5);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    leftX.setValue(0); rightX.setValue(0); charScale.setValue(0.5); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.parallel([
        Animated.timing(leftX, {toValue: -40, duration: 400, useNativeDriver: true}),
        Animated.timing(rightX, {toValue: 40, duration: 400, useNativeDriver: true}),
        Animated.sequence([
          Animated.delay(200),
          Animated.spring(charScale, {toValue: 1, ...SPRINGS.bouncy}),
        ]),
      ]).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      <View style={styles.peekContainer}>
        <Animated.Text style={[styles.emoji, {
          transform: [{scale: charScale}],
          position: 'absolute', zIndex: 1,
        }]}>
          {isWrong ? '🙈' : '👶'}
        </Animated.Text>
        <Animated.View style={[styles.curtain, styles.curtainLeft, {transform: [{translateX: leftX}]}]} />
        <Animated.View style={[styles.curtain, styles.curtainRight, {transform: [{translateX: rightX}]}]} />
      </View>
      {isWrong && <Animated.Text style={[styles.emoji, {transform: [{translateX: shakeAnim}]}]}>🙈</Animated.Text>}
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#FFD700'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// speech_bubble: Bubble inflates then pops into fragments
function SpeechBubbleRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Bubble popped!', streakCount, score);
  const isWrong = type === 'wrong';
  const bubbleScale = useAnimVal(0);
  const fragments = ['A', 'B', 'C', 'D', 'E'];
  const frags = useRef(fragments.map(() => ({
    x: new Animated.Value(0), y: new Animated.Value(0), op: new Animated.Value(0),
  }))).current;
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    bubbleScale.setValue(0);
    frags.forEach(f => {f.x.setValue(0); f.y.setValue(0); f.op.setValue(0);});
    shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.sequence([
        Animated.timing(bubbleScale, {toValue: 1.3, duration: 300, useNativeDriver: true}),
        Animated.timing(bubbleScale, {toValue: 0, duration: 100, useNativeDriver: true}),
      ]).start();
      frags.forEach((f, i) => {
        const angle = (i / fragments.length) * Math.PI * 2;
        Animated.sequence([
          Animated.delay(350),
          Animated.parallel([
            Animated.timing(f.x, {toValue: Math.cos(angle) * 35, duration: 300, useNativeDriver: true}),
            Animated.timing(f.y, {toValue: Math.sin(angle) * 35, duration: 300, useNativeDriver: true}),
            Animated.sequence([
              Animated.timing(f.op, {toValue: 1, duration: 50, useNativeDriver: true}),
              Animated.timing(f.op, {toValue: 0, duration: 250, useNativeDriver: true}),
            ]),
          ]),
        ]).start();
      });
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      {!isWrong && <Animated.View style={[styles.bubble, {transform: [{scale: bubbleScale}]}]} />}
      {!isWrong && frags.map((f, i) => (
        <Animated.Text key={i} style={[styles.fragText, {
          color: '#00D2D3',
          transform: [{translateX: f.x}, {translateY: f.y}],
          opacity: f.op,
        }]}>{fragments[i]}</Animated.Text>
      ))}
      {isWrong && <Animated.Text style={[styles.emoji, {transform: [{translateX: shakeAnim}]}]}>💬</Animated.Text>}
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#00D2D3'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// ── TOUCH GAMES ─────────────────────────────────────────────────

// multiple_choice: Card glows + checkmark stamp
function MultipleChoiceRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Right answer!', streakCount, score);
  const isWrong = type === 'wrong';
  const stampScale = useAnimVal(isWrong ? 0.5 : 2);
  const glowOp = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    stampScale.setValue(isWrong ? 0.5 : 2); glowOp.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      Animated.spring(stampScale, {toValue: 1, ...SPRINGS.standard}).start();
      shakeSeq(shakeAnim).start();
    } else {
      Animated.parallel([
        Animated.spring(stampScale, {toValue: 1, ...SPRINGS.bouncy}),
        Animated.sequence([
          Animated.timing(glowOp, {toValue: 0.6, duration: 200, useNativeDriver: true}),
          Animated.timing(glowOp, {toValue: 0.2, duration: 400, useNativeDriver: true}),
        ]),
      ]).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      <Animated.View style={[styles.choiceCard, {
        backgroundColor: isWrong ? '#FFE8E8' : '#D5F5E3',
        borderColor: isWrong ? '#E74C3C' : '#2ECC71',
        opacity: Animated.add(0.4, glowOp),
      }]}>
        <Animated.Text style={[styles.stampText, {
          color: isWrong ? '#E74C3C' : '#2ECC71',
          transform: [{scale: stampScale}, {translateX: shakeAnim}],
        }]}>
          {isWrong ? '✗' : '✓'}
        </Animated.Text>
      </Animated.View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#2ECC71'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// drag_to_zone: Lock/keyhole turning animation
function DragToZoneRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Perfect placement!', streakCount, score);
  const isWrong = type === 'wrong';
  const keyRotate = useAnimVal(0);
  const shackleY = useAnimVal(-6);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    keyRotate.setValue(0); shackleY.setValue(-6); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.parallel([
        Animated.timing(keyRotate, {toValue: 90, duration: 400, useNativeDriver: true}),
        Animated.spring(shackleY, {toValue: 0, ...SPRINGS.standard}),
      ]).start();
    }
  }, [visible]);

  const rotate = keyRotate.interpolate({inputRange: [0, 90], outputRange: ['0deg', '90deg']});

  return (
    <View style={styles.center}>
      <View style={styles.lockBody}>
        <Animated.View style={[styles.keyhole, {
          backgroundColor: isWrong ? '#999' : '#FFD700',
          transform: [{rotate}],
        }]} />
        <Animated.View style={[styles.shackle, {
          borderColor: isWrong ? '#ccc' : '#6C63FF',
          transform: [{translateY: shackleY}, {translateX: shakeAnim}],
        }]} />
      </View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#6C63FF'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// match_pairs: Cards merge with flash
function MatchPairsRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Matched!', streakCount, score);
  const isWrong = type === 'wrong';
  const leftX = useAnimVal(-12);
  const rightX = useAnimVal(12);
  const flashOp = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    leftX.setValue(-12); rightX.setValue(12); flashOp.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.parallel([
        Animated.timing(leftX, {toValue: 4, duration: 400, useNativeDriver: true}),
        Animated.timing(rightX, {toValue: -4, duration: 400, useNativeDriver: true}),
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(flashOp, {toValue: 0.8, duration: 100, useNativeDriver: true}),
          Animated.timing(flashOp, {toValue: 0, duration: 200, useNativeDriver: true}),
        ]),
      ]).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      <View style={[styles.row, {marginBottom: 6}]}>
        <Animated.View style={[styles.miniCard, {
          backgroundColor: isWrong ? '#ddd' : '#FF9F43',
          transform: [{translateX: leftX}, {translateX: shakeAnim}],
        }]} />
        <Animated.View style={[styles.miniCard, {
          backgroundColor: isWrong ? '#ddd' : '#FF9F43',
          transform: [{translateX: rightX}, {translateX: shakeAnim}],
        }]} />
        <Animated.View style={[styles.flashOverlay, {opacity: flashOp}]} />
      </View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#FF9F43'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// sequence_order: Dots chain together with connecting lines
function SequenceOrderRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'In order!', streakCount, score);
  const isWrong = type === 'wrong';
  const count = 4;
  const dots = useAnimVals(count, 0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    dots.forEach(d => d.setValue(0)); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.stagger(120, dots.map(d =>
        Animated.spring(d, {toValue: 1, ...SPRINGS.bouncy})
      )).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      <Animated.View style={[styles.row, {marginBottom: 6, transform: [{translateX: shakeAnim}]}]}>
        {Array.from({length: count}).map((_, i) => (
          <React.Fragment key={i}>
            <Animated.View style={[styles.seqDot, {
              backgroundColor: isWrong ? '#ccc' : '#00D2D3',
              transform: [{scale: dots[i]}],
            }]} />
            {i < count - 1 && (
              <Animated.View style={[styles.seqLine, {
                backgroundColor: isWrong ? '#ddd' : '#00D2D3',
                opacity: dots[i],
              }]} />
            )}
          </React.Fragment>
        ))}
      </Animated.View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#00D2D3'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// word_build: Letters slam together like magnets
function WordBuildRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Word complete!', streakCount, score);
  const isWrong = type === 'wrong';
  const letters = ['W', 'O', 'R', 'D'];
  const anims = useAnimVals(letters.length, 0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    anims.forEach(a => a.setValue(0)); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.stagger(50, anims.map((a, i) => {
        const startX = (i - 1.5) * 30;
        a.setValue(startX);
        return Animated.spring(a, {toValue: 0, ...SPRINGS.bouncy});
      })).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      <Animated.View style={[styles.row, {marginBottom: 6, transform: [{translateX: shakeAnim}]}]}>
        {letters.map((l, i) => (
          <Animated.Text key={i} style={[styles.letterText, {
            color: isWrong ? '#ccc' : '#A29BFE',
            transform: [{translateX: anims[i]}],
          }]}>
            {l}
          </Animated.Text>
        ))}
      </Animated.View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#A29BFE'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// fill_blank: Ink flows in from edges
function FillBlankRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Filled in!', streakCount, score);
  const isWrong = type === 'wrong';
  const fillWidth = useAnimVal(0);
  const textOp = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    fillWidth.setValue(0); textOp.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.sequence([
        Animated.timing(fillWidth, {toValue: 1, duration: 400, useNativeDriver: false}),
        Animated.timing(textOp, {toValue: 1, duration: 200, useNativeDriver: true}),
      ]).start();
    }
  }, [visible]);

  const width = fillWidth.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']});

  return (
    <View style={styles.center}>
      <View style={[styles.blankBox, {borderColor: isWrong ? '#ccc' : '#2ECC71'}]}>
        {!isWrong && <Animated.View style={[styles.fillInk, {width, backgroundColor: '#2ECC71'}]} />}
        <Animated.Text style={[styles.fillCheck, {
          opacity: isWrong ? 0.4 : textOp,
          color: isWrong ? '#ccc' : '#fff',
          transform: [{translateX: shakeAnim}],
        }]}>
          {isWrong ? '___' : '✓'}
        </Animated.Text>
      </View>
      {isWrong && <Animated.Text style={[styles.emoji, {transform: [{translateX: shakeAnim}]}]}>✏️</Animated.Text>}
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#2ECC71'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// memory_flip: Synchronized card backflip
function MemoryFlipRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Great memory!', streakCount, score);
  const isWrong = type === 'wrong';
  const flip1 = useAnimVal(0);
  const flip2 = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    flip1.setValue(0); flip2.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.parallel([
        Animated.timing(flip1, {toValue: 1, duration: 600, useNativeDriver: true}),
        Animated.sequence([
          Animated.delay(80),
          Animated.timing(flip2, {toValue: 1, duration: 600, useNativeDriver: true}),
        ]),
      ]).start();
    }
  }, [visible]);

  const rot1 = flip1.interpolate({inputRange: [0, 1], outputRange: ['0deg', '-360deg']});
  const rot2 = flip2.interpolate({inputRange: [0, 1], outputRange: ['0deg', '-360deg']});

  return (
    <View style={styles.center}>
      <View style={[styles.row, {marginBottom: 6}]}>
        <Animated.View style={[styles.flipMiniCard, {
          backgroundColor: isWrong ? '#ddd' : '#FF6B81',
          transform: [{perspective: 400}, {rotateX: rot1}, {translateX: shakeAnim}],
        }]}>
          <Text style={styles.flipCardText}>{isWrong ? '?' : '🧠'}</Text>
        </Animated.View>
        <Animated.View style={[styles.flipMiniCard, {
          backgroundColor: isWrong ? '#ddd' : '#FF6B81',
          transform: [{perspective: 400}, {rotateX: rot2}, {translateX: shakeAnim}],
        }]}>
          <Text style={styles.flipCardText}>{isWrong ? '?' : '🧠'}</Text>
        </Animated.View>
      </View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#FF6B81'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// true_false: Thumbs stamp with ink splat
function TrueFalseRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'You know it!', streakCount, score);
  const isWrong = type === 'wrong';
  const stampY = useAnimVal(-20);
  const stampScale = useAnimVal(2);
  const splatScale = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    stampY.setValue(-20); stampScale.setValue(2); splatScale.setValue(0);
    Animated.parallel([
      Animated.spring(stampY, {toValue: 0, ...SPRINGS.playful}),
      Animated.spring(stampScale, {toValue: 1, ...SPRINGS.bouncy}),
      Animated.spring(splatScale, {toValue: 1, ...SPRINGS.standard}),
    ]).start();
  }, [visible]);

  return (
    <View style={styles.center}>
      <Animated.View style={[styles.inkSplat, {
        backgroundColor: isWrong ? '#E74C3C22' : '#2ECC7122',
        transform: [{scale: splatScale}],
      }]} />
      <Animated.Text style={[styles.emojiLg, {
        transform: [{translateY: stampY}, {scale: stampScale}],
      }]}>
        {isWrong ? '👎' : '👍'}
      </Animated.Text>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#2ECC71'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// counting: Numbers cascade and stack
function CountingRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Well counted!', streakCount, score);
  const isWrong = type === 'wrong';
  const nums = [1, 2, 3, 4, 5];
  const anims = useAnimVals(nums.length, -30);
  const opAnims = useAnimVals(nums.length, 0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    anims.forEach(a => a.setValue(-30));
    opAnims.forEach(a => a.setValue(0));
    shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.stagger(60, anims.map((a, i) =>
        Animated.parallel([
          Animated.spring(a, {toValue: 0, ...SPRINGS.playful}),
          Animated.timing(opAnims[i], {toValue: 1, duration: 150, useNativeDriver: true}),
        ])
      )).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      <Animated.View style={[styles.row, {marginBottom: 6, transform: [{translateX: shakeAnim}]}]}>
        {nums.map((n, i) => (
          <Animated.Text key={i} style={[styles.numText, {
            color: isWrong ? '#ccc' : '#FF9F43',
            transform: [{translateY: anims[i]}],
            opacity: opAnims[i],
          }]}>
            {n}
          </Animated.Text>
        ))}
      </Animated.View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#FF9F43'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// tracing: Golden trail draws with sparkles
function TracingRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Neat tracing!', streakCount, score);
  const isWrong = type === 'wrong';
  const trailWidth = useAnimVal(0);
  const sparkles = useAnimVals(4, 0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    trailWidth.setValue(0); sparkles.forEach(s => s.setValue(0)); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.sequence([
        Animated.timing(trailWidth, {toValue: 1, duration: 400, useNativeDriver: false}),
        Animated.stagger(80, sparkles.map(s =>
          Animated.sequence([
            Animated.timing(s, {toValue: 1.5, duration: 150, useNativeDriver: true}),
            Animated.timing(s, {toValue: 1, duration: 100, useNativeDriver: true}),
          ])
        )),
      ]).start();
    }
  }, [visible]);

  const width = trailWidth.interpolate({inputRange: [0, 1], outputRange: [0, 70]});

  return (
    <View style={styles.center}>
      {!isWrong && (
        <View style={styles.trailContainer}>
          <Animated.View style={[styles.goldTrail, {width}]} />
          {sparkles.map((s, i) => (
            <Animated.View key={i} style={[styles.sparkle, {
              left: (i / 3) * 64,
              transform: [{scale: s}],
            }]} />
          ))}
        </View>
      )}
      {isWrong && <Animated.Text style={[styles.emoji, {transform: [{translateX: shakeAnim}]}]}>✍️</Animated.Text>}
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#6C63FF'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// timed_rush: Lightning bolt strike
function TimedRushRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Speed demon!', streakCount, score);
  const isWrong = type === 'wrong';
  const strikeY = useAnimVal(-30);
  const strikeScale = useAnimVal(1.5);
  const flashOp = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    strikeY.setValue(-30); strikeScale.setValue(1.5); flashOp.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      Animated.spring(strikeY, {toValue: 0, ...SPRINGS.standard}).start();
      Animated.spring(strikeScale, {toValue: 1, ...SPRINGS.standard}).start();
      shakeSeq(shakeAnim).start();
    } else {
      Animated.parallel([
        Animated.spring(strikeY, {toValue: 0, ...SPRINGS.playful}),
        Animated.spring(strikeScale, {toValue: 1, ...SPRINGS.bouncy}),
        Animated.sequence([
          Animated.timing(flashOp, {toValue: 0.7, duration: 100, useNativeDriver: true}),
          Animated.timing(flashOp, {toValue: 0, duration: 300, useNativeDriver: true}),
        ]),
      ]).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      {!isWrong && <Animated.View style={[styles.lightningFlash, {opacity: flashOp}]} />}
      <Animated.Text style={[styles.emojiXL, {
        transform: [{translateY: strikeY}, {scale: strikeScale}, {translateX: shakeAnim}],
      }]}>
        {isWrong ? '🐢' : '⚡'}
      </Animated.Text>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#FFD700'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// puzzle_assemble: Piece snaps into place
function PuzzleAssembleRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Piece by piece!', streakCount, score);
  const isWrong = type === 'wrong';
  const pieceX = useAnimVal(20);
  const snapOp = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    pieceX.setValue(20); snapOp.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.sequence([
        Animated.spring(pieceX, {toValue: 0, ...SPRINGS.playful}),
        Animated.sequence([
          Animated.timing(snapOp, {toValue: 0.9, duration: 100, useNativeDriver: true}),
          Animated.timing(snapOp, {toValue: 0, duration: 200, useNativeDriver: true}),
        ]),
      ]).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      <View style={[styles.row, {marginBottom: 6}]}>
        <View style={[styles.puzzleBase, {backgroundColor: isWrong ? '#ddd' : '#A29BFE'}]} />
        <Animated.View style={[styles.puzzlePiece, {
          backgroundColor: isWrong ? '#ccc' : '#E040FB',
          transform: [{translateX: pieceX}, {translateX: shakeAnim}],
        }]} />
        <Animated.View style={[styles.snapFlash, {opacity: snapOp}]} />
      </View>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#A29BFE'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// story_builder: Pages fan out then close with clasp
function StoryBuilderRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Great story!', streakCount, score);
  const isWrong = type === 'wrong';
  const pages = useAnimVals(3, 0);
  const claspOp = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    const startAngles = [-30, 0, 30];
    pages.forEach((p, i) => p.setValue(startAngles[i]));
    claspOp.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel(pages.map(p =>
          Animated.spring(p, {toValue: 0, ...SPRINGS.standard})
        )),
        Animated.timing(claspOp, {toValue: 1, duration: 200, useNativeDriver: true}),
      ]).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      {!isWrong && (
        <View style={styles.bookContainer}>
          {pages.map((p, i) => {
            const rotate = p.interpolate({inputRange: [-30, 0, 30], outputRange: ['-30deg', '0deg', '30deg']});
            return (
              <Animated.View key={i} style={[styles.bookPage, {
                backgroundColor: '#FFF8DC',
                borderColor: '#DAA520',
                transform: [{rotate}],
              }]} />
            );
          })}
          <Animated.View style={[styles.clasp, {opacity: claspOp}]} />
        </View>
      )}
      {isWrong && <Animated.Text style={[styles.emoji, {transform: [{translateX: shakeAnim}]}]}>📚</Animated.Text>}
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#2ECC71'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// simulation: Gears turning
function SimulationRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Well played!', streakCount, score);
  const isWrong = type === 'wrong';
  const gear1 = useAnimVal(0);
  const gear2 = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    gear1.setValue(0); gear2.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      shakeSeq(shakeAnim).start();
    } else {
      Animated.parallel([
        Animated.timing(gear1, {toValue: 1, duration: 800, useNativeDriver: true}),
        Animated.timing(gear2, {toValue: 1, duration: 800, useNativeDriver: true}),
      ]).start();
    }
  }, [visible]);

  const rot1 = gear1.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});
  const rot2 = gear2.interpolate({inputRange: [0, 1], outputRange: ['0deg', '-360deg']});

  return (
    <View style={styles.center}>
      {!isWrong && (
        <View style={styles.gearsContainer}>
          <Animated.Text style={[{fontSize: 30, position: 'absolute', left: 0, top: 0}, {transform: [{rotate: rot1}]}]}>
            ⚙️
          </Animated.Text>
          <Animated.Text style={[{fontSize: 22, position: 'absolute', right: 0, bottom: 0}, {transform: [{rotate: rot2}]}]}>
            ⚙️
          </Animated.Text>
        </View>
      )}
      {isWrong && <Animated.Text style={[styles.emoji, {transform: [{translateX: shakeAnim}]}]}>🎮</Animated.Text>}
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#00D2D3'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// spot_difference: Magnifying glass circles the difference
function SpotDifferenceRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Sharp eyes!', streakCount, score);
  const isWrong = type === 'wrong';
  const magScale = useAnimVal(0.5);
  const magRotate = useAnimVal(-20);
  const circleScale = useAnimVal(0);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    magScale.setValue(0.5); magRotate.setValue(-20); circleScale.setValue(0); shakeAnim.setValue(0);
    if (isWrong) {
      Animated.spring(magScale, {toValue: 1, ...SPRINGS.standard}).start();
      shakeSeq(shakeAnim).start();
    } else {
      Animated.parallel([
        Animated.spring(magScale, {toValue: 1, ...SPRINGS.bouncy}),
        Animated.spring(magRotate, {toValue: 0, ...SPRINGS.standard}),
        Animated.spring(circleScale, {toValue: 1, ...SPRINGS.standard}),
      ]).start();
    }
  }, [visible]);

  const rotate = magRotate.interpolate({inputRange: [-20, 0], outputRange: ['-20deg', '0deg']});

  return (
    <View style={styles.center}>
      {!isWrong && (
        <Animated.View style={[styles.spotCircle, {
          transform: [{scale: circleScale}],
        }]} />
      )}
      <Animated.Text style={[styles.emojiLg, {
        transform: [{scale: magScale}, {rotate}, {translateX: shakeAnim}],
      }]}>
        🔍
      </Animated.Text>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#FF6B6B'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// Default fallback
function DefaultRenderer({type, streakCount, score, visible}) {
  const phrase = resolvePhrase(type, 'Correct!', streakCount, score);
  const isWrong = type === 'wrong';
  const scale = useAnimVal(0.3);
  const ringScale = useAnimVal(0.3);
  const ringOp = useAnimVal(0.6);
  const shakeAnim = useAnimVal(0);

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.3); ringScale.setValue(0.3); ringOp.setValue(0.6); shakeAnim.setValue(0);
    if (isWrong) {
      Animated.spring(scale, {toValue: 1, ...SPRINGS.standard}).start();
      shakeSeq(shakeAnim).start();
    } else {
      Animated.spring(scale, {toValue: 1, ...SPRINGS.bouncy}).start();
      Animated.parallel([
        Animated.timing(ringScale, {toValue: 2.5, duration: 500, useNativeDriver: true}),
        Animated.timing(ringOp, {toValue: 0, duration: 500, useNativeDriver: true}),
      ]).start();
    }
  }, [visible]);

  return (
    <View style={styles.center}>
      {!isWrong && (
        <Animated.View style={[styles.ring, {
          borderColor: '#6C63FF',
          transform: [{scale: ringScale}],
          opacity: ringOp,
        }]} />
      )}
      <Animated.Text style={[styles.emojiLg, {
        transform: [{scale}, {translateX: shakeAnim}],
      }]}>
        {isWrong ? '😅' : (type === 'perfect' ? '🌟' : '⭐')}
      </Animated.Text>
      <PhrasePill text={phrase} color={isWrong ? '#FF4444' : '#6C63FF'} />
      <StreakBadge type={type} streakCount={streakCount} />
      <ScoreDisplay type={type} score={score} />
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REGISTRY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GAME_REGISTRY = {
  // Voice
  voice_spell:       {Renderer: VoiceSpellRenderer, phrase: 'Perfect pronunciation!', duration: 1000},
  voice_balloon_pop: {Renderer: BalloonPopRenderer, phrase: 'Pop!', duration: 900},
  beat_match:        {Renderer: BeatMatchRenderer, phrase: 'On beat!', duration: 1000},
  whisper_shout:     {Renderer: WhisperShoutRenderer, phrase: 'Great control!', duration: 1000},
  sound_charades:    {Renderer: SoundCharadesRenderer, phrase: 'Nailed it!', duration: 900},
  story_weaver:      {Renderer: StoryWeaverRenderer, phrase: 'Great storytelling!', duration: 1100},
  voice_paint:       {Renderer: VoicePaintRenderer, phrase: 'Beautiful!', duration: 900},
  peekaboo:          {Renderer: PeekabooRenderer, phrase: 'You found me!', duration: 1000},
  speech_bubble:     {Renderer: SpeechBubbleRenderer, phrase: 'Bubble popped!', duration: 900},
  // Touch
  multiple_choice:   {Renderer: MultipleChoiceRenderer, phrase: 'Right answer!', duration: 900},
  drag_to_zone:      {Renderer: DragToZoneRenderer, phrase: 'Perfect placement!', duration: 900},
  match_pairs:       {Renderer: MatchPairsRenderer, phrase: 'Matched!', duration: 900},
  sequence_order:    {Renderer: SequenceOrderRenderer, phrase: 'In order!', duration: 900},
  word_build:        {Renderer: WordBuildRenderer, phrase: 'Word complete!', duration: 900},
  fill_blank:        {Renderer: FillBlankRenderer, phrase: 'Filled in!', duration: 900},
  memory_flip:       {Renderer: MemoryFlipRenderer, phrase: 'Great memory!', duration: 900},
  true_false:        {Renderer: TrueFalseRenderer, phrase: 'You know it!', duration: 900},
  counting:          {Renderer: CountingRenderer, phrase: 'Well counted!', duration: 900},
  tracing:           {Renderer: TracingRenderer, phrase: 'Neat tracing!', duration: 1000},
  timed_rush:        {Renderer: TimedRushRenderer, phrase: 'Speed demon!', duration: 800},
  puzzle_assemble:   {Renderer: PuzzleAssembleRenderer, phrase: 'Piece by piece!', duration: 900},
  story_builder:     {Renderer: StoryBuilderRenderer, phrase: 'Great story!', duration: 1100},
  simulation:        {Renderer: SimulationRenderer, phrase: 'Well played!', duration: 1000},
  spot_difference:   {Renderer: SpotDifferenceRenderer, phrase: 'Sharp eyes!', duration: 900},
};

// Aliases for templates that pass concatenated names
GAME_REGISTRY.voiceballoonpop = GAME_REGISTRY.voice_balloon_pop;
GAME_REGISTRY.voicespell      = GAME_REGISTRY.voice_spell;
GAME_REGISTRY.beatmatch       = GAME_REGISTRY.beat_match;
GAME_REGISTRY.whispershout    = GAME_REGISTRY.whisper_shout;
GAME_REGISTRY.soundcharades   = GAME_REGISTRY.sound_charades;
GAME_REGISTRY.storyweaver     = GAME_REGISTRY.story_weaver;
GAME_REGISTRY.voicepaint      = GAME_REGISTRY.voice_paint;
GAME_REGISTRY.speechbubble    = GAME_REGISTRY.speech_bubble;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const InlineCelebration = ({
  type = 'correct',
  gameTemplate = '',
  visible = false,
  onDone,
  streakCount = 0,
  score,
}) => {
  const entry = GAME_REGISTRY[gameTemplate];
  const Renderer = entry?.Renderer || DefaultRenderer;
  const defaultPhrase = entry?.phrase || 'Correct!';
  const duration = entry?.duration || 900;

  const opacity = useAnimVal(0);
  const shellScale = useAnimVal(0.5);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {mountedRef.current = false;}, []);

  // TTS for correct answers
  useEffect(() => {
    if (!visible || type === 'wrong') return;
    const phrase = resolvePhrase(type, defaultPhrase, streakCount, score);
    TTSManager.speak(phrase, {voice: 'kids_narrator'}).catch(() => {});
  }, [visible, type, defaultPhrase, streakCount, score]);

  // Shell animation
  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      shellScale.setValue(0.5);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {toValue: 1, duration: 200, useNativeDriver: true}),
      Animated.spring(shellScale, {toValue: 1, ...SPRINGS.bouncy}),
    ]).start();

    const d = type === 'wrong' ? 600 : duration;
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      Animated.timing(opacity, {toValue: 0, duration: 300, useNativeDriver: true}).start(() => {
        if (mountedRef.current && onDone) onDone();
      });
    }, d);

    return () => {if (timerRef.current) clearTimeout(timerRef.current);};
  }, [visible, type, duration, onDone]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.shell, {opacity, transform: [{scale: shellScale}]}]}
      pointerEvents="none"
    >
      <Renderer type={type} streakCount={streakCount} score={score} visible={visible} />
    </Animated.View>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STYLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
  },
  pillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  streakBadge: {
    fontSize: 11,
    color: '#FFD700',
    fontWeight: '700',
    marginTop: -2,
  },
  scoreText: {
    fontSize: 12,
    color: '#ffffffCC',
  },
  emoji: {fontSize: 32},
  emojiLg: {fontSize: 40},
  emojiXL: {fontSize: 44},
  letterText: {
    fontSize: 22,
    fontWeight: '800',
    marginHorizontal: 1,
  },
  numText: {
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: 2,
  },
  fragText: {
    position: 'absolute',
    fontSize: 14,
    fontWeight: '800',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ring: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
  },
  starburst: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#A29BFE44',
  },
  splat: {
    position: 'absolute',
    width: 14,
    height: 11,
    borderRadius: 7,
  },
  bubble: {
    position: 'absolute',
    width: 50,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D2D3',
  },
  peekContainer: {
    width: 70,
    height: 50,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  curtain: {
    position: 'absolute',
    top: 0,
    width: '50%',
    height: '100%',
    backgroundColor: '#FFD700',
  },
  curtainLeft: {left: 0, borderTopLeftRadius: 4, borderBottomLeftRadius: 4},
  curtainRight: {right: 0, borderTopRightRadius: 4, borderBottomRightRadius: 4},
  pageCard: {
    width: 70,
    height: 50,
    borderWidth: 2,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  goldenText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stampText: {
    fontSize: 28,
    fontWeight: '800',
  },
  choiceCard: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  lockBody: {
    width: 36,
    height: 28,
    backgroundColor: '#6C63FF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  keyhole: {
    width: 8,
    height: 12,
    borderRadius: 4,
  },
  shackle: {
    position: 'absolute',
    top: -8,
    width: 22,
    height: 14,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  miniCard: {
    width: 30,
    height: 38,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  flashOverlay: {
    position: 'absolute',
    width: 60,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  seqDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  seqLine: {
    width: 14,
    height: 3,
  },
  flipMiniCard: {
    width: 28,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  flipCardText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '800',
  },
  blankBox: {
    width: 60,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  fillInk: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  fillCheck: {
    fontSize: 12,
    fontWeight: '800',
    zIndex: 1,
  },
  inkSplat: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  trailContainer: {
    width: 70,
    height: 20,
    justifyContent: 'center',
    marginBottom: 6,
  },
  goldTrail: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD700',
  },
  sparkle: {
    position: 'absolute',
    top: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
  },
  lightningFlash: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFD70044',
  },
  puzzleBase: {
    width: 24,
    height: 24,
    borderRadius: 3,
  },
  puzzlePiece: {
    width: 24,
    height: 24,
    borderRadius: 3,
    marginLeft: -2,
  },
  snapFlash: {
    position: 'absolute',
    width: 8,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#fff',
    left: 20,
  },
  bookContainer: {
    width: 60,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  bookPage: {
    position: 'absolute',
    width: 36,
    height: 44,
    borderWidth: 1,
    borderRadius: 3,
  },
  clasp: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DAA520',
    zIndex: 3,
  },
  gearsContainer: {
    width: 60,
    height: 50,
    marginBottom: 6,
  },
  spotCircle: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
});

export default InlineCelebration;
