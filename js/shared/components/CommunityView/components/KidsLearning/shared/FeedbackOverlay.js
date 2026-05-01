import React, {useEffect, useRef, useContext} from 'react';
import {View, Text, Animated, Easing, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsFontSize, kidsFontWeight} from '../../../../../theme/kidsColors';
import TTSManager from './TTSManager';
import {GameSounds} from './SoundManager';
import {SPRINGS} from './gameThemes';
import useKidsLearningStore from '../../../../../kidsLearningStore';

// Safe context reader — auto-reads feedbackStyle when inside GameShell
// (no circular dep since GameShell doesn't import FeedbackOverlay)
let _useGameShell = null;
try { ({useGameShell: _useGameShell} = require('../GameShell')); } catch (_) {}

function useFeedbackStyleFromContext() {
  if (!_useGameShell) return null;
  try { return _useGameShell()?.feedbackStyle || null; } catch (_) { return null; }
}

/**
 * FeedbackOverlay - Full-screen flash for correct/incorrect feedback.
 *
 * Supports 6 distinct visual styles via the `feedbackStyle` prop
 * (driven by the game theme registry in gameThemes.js):
 *
 *   stamp   — check/X slams down from 2x scale (quiz/true-false)
 *   ripple  — expanding ring from center (matching games)
 *   flip    — card rotates to reveal result (memory games)
 *   pop     — bubble + 8 confetti particles radiate outward (counting/word)
 *   drop    — gravity drop for correct, bounce-back for wrong (drag/puzzle)
 *   glow    — screen edges pulse green/red (simulation/story)
 *
 * Props:
 * - visible: boolean
 * - isCorrect: boolean
 * - message?: string (custom message)
 * - onDismiss: () => void
 * - speakFeedback?: boolean
 * - feedbackStyle?: string (default: 'stamp')
 */
const FeedbackOverlay = ({visible, isCorrect, message, onDismiss, speakFeedback, feedbackStyle: feedbackStyleProp}) => {
  // Auto-read feedbackStyle from GameShell context if not passed as prop
  const contextStyle = useFeedbackStyleFromContext();
  const feedbackStyle = feedbackStyleProp || contextStyle || 'stamp';

  // Shared
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Ripple
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(1)).current;
  // Flip
  const flipAnim = useRef(new Animated.Value(0)).current;
  // Pop particles
  const popParticles = useRef(
    Array.from({length: 8}).map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      op: new Animated.Value(0),
    })),
  ).current;
  // Drop
  const dropY = useRef(new Animated.Value(-60)).current;
  // Glow
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const mountedRef = useRef(true);
  const ageGroup = useKidsLearningStore(s => s.ageGroup);
  const shouldSpeak = speakFeedback !== undefined ? speakFeedback : (ageGroup === 'early' || ageGroup === '3-6');

  useEffect(() => () => { mountedRef.current = false; }, []);

  // TTS for young learners
  useEffect(() => {
    if (visible && shouldSpeak) {
      const spokenText = message || (isCorrect ? 'Correct!' : 'Try Again!');
      TTSManager.speak(spokenText, {voice: 'kids_narrator'}).catch(() => {});
    }
  }, [visible, shouldSpeak]);

  // Main animation effect
  useEffect(() => {
    if (!visible) return;
    if (isCorrect) { GameSounds.correct(); } else { GameSounds.wrong(); }

    // Reset everything
    opacity.setValue(0);
    scale.setValue(feedbackStyle === 'stamp' ? (isCorrect ? 2 : 0.5) : 0.5);
    shakeAnim.setValue(0);
    rippleScale.setValue(0);
    rippleOpacity.setValue(1);
    flipAnim.setValue(0);
    dropY.setValue(-60);
    glowOpacity.setValue(0);
    popParticles.forEach(p => { p.x.setValue(0); p.y.setValue(0); p.op.setValue(0); });

    let timeout;
    const styleAnims = buildStyleAnimation(feedbackStyle, isCorrect, {
      scale, shakeAnim, rippleScale, rippleOpacity, flipAnim, popParticles, dropY, glowOpacity,
    });

    Animated.parallel([
      Animated.timing(opacity, {toValue: 1, duration: 200, useNativeDriver: true}),
      ...styleAnims,
    ]).start(() => {
      if (!mountedRef.current) return;
      timeout = setTimeout(() => {
        if (!mountedRef.current) return;
        Animated.timing(opacity, {toValue: 0, duration: 300, useNativeDriver: true}).start(() => {
          if (mountedRef.current && onDismiss) onDismiss();
        });
      }, 600);
    });
    return () => { if (timeout) clearTimeout(timeout); };
  }, [visible]);

  if (!visible) return null;

  const defaultMessage = isCorrect ? 'Correct!' : 'Try Again!';
  const iconColor = isCorrect ? kidsColors.correct : kidsColors.incorrect;

  return (
    <Animated.View
      style={[styles.overlay, {opacity}]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message || defaultMessage}
    >
      {renderForStyle(feedbackStyle, {isCorrect, scale, shakeAnim, rippleScale, rippleOpacity, flipAnim, popParticles, dropY, glowOpacity, iconColor, message, defaultMessage})}
    </Animated.View>
  );
};

// ── Build animation arrays per style ──

function buildStyleAnimation(style, isCorrect, a) {
  switch (style) {
    case 'stamp':
      return isCorrect
        ? [Animated.spring(a.scale, {toValue: 1, ...SPRINGS.playful})]
        : [Animated.sequence([
            Animated.spring(a.scale, {toValue: 1, ...SPRINGS.playful}),
            ...shake(a.shakeAnim, 10),
          ])];

    case 'ripple':
      return [
        Animated.timing(a.rippleScale, {toValue: 3, duration: 500, easing: Easing.out(Easing.circle), useNativeDriver: true}),
        Animated.timing(a.rippleOpacity, {toValue: 0, duration: 500, useNativeDriver: true}),
        Animated.spring(a.scale, {toValue: 1, ...SPRINGS.standard}),
      ];

    case 'flip':
      return [Animated.timing(a.flipAnim, {toValue: 1, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true})];

    case 'pop': {
      const pAnims = a.popParticles.map((p, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dist = 60 + Math.random() * 30;
        return Animated.parallel([
          Animated.timing(p.x, {toValue: Math.cos(angle) * dist, duration: 400, useNativeDriver: true}),
          Animated.timing(p.y, {toValue: Math.sin(angle) * dist, duration: 400, useNativeDriver: true}),
          Animated.sequence([
            Animated.timing(p.op, {toValue: 1, duration: 100, useNativeDriver: true}),
            Animated.timing(p.op, {toValue: 0, duration: 300, useNativeDriver: true}),
          ]),
        ]);
      });
      return [Animated.spring(a.scale, {toValue: 1, ...SPRINGS.bouncy}), ...pAnims];
    }

    case 'drop':
      return isCorrect
        ? [Animated.spring(a.dropY, {toValue: 0, ...SPRINGS.playful})]
        : [Animated.sequence([
            Animated.spring(a.dropY, {toValue: 0, ...SPRINGS.playful}),
            Animated.timing(a.dropY, {toValue: -30, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true}),
            ...shake(a.shakeAnim, 8),
          ])];

    case 'glow':
      return [
        Animated.sequence([
          Animated.timing(a.glowOpacity, {toValue: 0.6, duration: 150, useNativeDriver: true}),
          Animated.timing(a.glowOpacity, {toValue: 0.2, duration: 150, useNativeDriver: true}),
          Animated.timing(a.glowOpacity, {toValue: 0.5, duration: 150, useNativeDriver: true}),
        ]),
        Animated.spring(a.scale, {toValue: 1, ...SPRINGS.standard}),
      ];

    default:
      return [Animated.spring(a.scale, {toValue: 1, ...SPRINGS.bouncy})];
  }
}

function shake(anim, mag) {
  return [
    Animated.timing(anim, {toValue: mag, duration: 50, easing: Easing.linear, useNativeDriver: true}),
    Animated.timing(anim, {toValue: -mag, duration: 50, easing: Easing.linear, useNativeDriver: true}),
    Animated.timing(anim, {toValue: mag, duration: 50, easing: Easing.linear, useNativeDriver: true}),
    Animated.timing(anim, {toValue: 0, duration: 50, easing: Easing.linear, useNativeDriver: true}),
  ];
}

// ── Render helpers per style ──

function renderForStyle(style, p) {
  switch (style) {
    case 'stamp':  return renderStamp(p);
    case 'ripple': return renderRipple(p);
    case 'flip':   return renderFlip(p);
    case 'pop':    return renderPop(p);
    case 'drop':   return renderDrop(p);
    case 'glow':   return renderGlow(p);
    default:       return renderStamp(p);
  }
}

function renderStamp({isCorrect, scale, shakeAnim, iconColor, message, defaultMessage}) {
  const bgColor = isCorrect ? kidsColors.correctLight : kidsColors.incorrectLight;
  return (
    <View style={[styles.centerContent, {backgroundColor: bgColor}]}>
      <Animated.View style={{transform: [{scale}, {translateX: shakeAnim}], alignItems: 'center'}}>
        <Icon name={isCorrect ? 'check-circle' : 'close-circle'} size={80} color={iconColor} />
        <Text style={[styles.text, {color: iconColor}]}>{message || defaultMessage}</Text>
      </Animated.View>
    </View>
  );
}

function renderRipple({isCorrect, scale, rippleScale, rippleOpacity, iconColor, message, defaultMessage}) {
  const ringColor = isCorrect ? kidsColors.correct : kidsColors.incorrect;
  return (
    <View style={styles.centerContent}>
      <Animated.View style={[styles.rippleRing, {
        borderColor: ringColor,
        transform: [{scale: rippleScale}],
        opacity: rippleOpacity,
      }]} />
      <Animated.View style={{transform: [{scale}], alignItems: 'center'}}>
        <Icon name={isCorrect ? 'check-circle' : 'close-circle'} size={72} color={iconColor} />
        <Text style={[styles.text, {color: iconColor}]}>{message || defaultMessage}</Text>
      </Animated.View>
    </View>
  );
}

function renderFlip({isCorrect, flipAnim, iconColor, message, defaultMessage}) {
  const rotateY = flipAnim.interpolate({inputRange: [0, 0.5, 1], outputRange: ['90deg', '90deg', '0deg']});
  const cardOpacity = flipAnim.interpolate({inputRange: [0, 0.4, 0.5, 1], outputRange: [0, 0, 1, 1]});
  const bgColor = isCorrect ? kidsColors.correctLight : kidsColors.incorrectLight;
  return (
    <View style={styles.centerContent}>
      <Animated.View style={[styles.flipCard, {backgroundColor: bgColor, opacity: cardOpacity, transform: [{perspective: 800}, {rotateY}]}]}>
        <Icon name={isCorrect ? 'check-decagram' : 'close-octagon'} size={64} color={iconColor} />
        <Text style={[styles.text, {color: iconColor, marginTop: 8}]}>{message || defaultMessage}</Text>
      </Animated.View>
    </View>
  );
}

function renderPop({isCorrect, scale, popParticles, iconColor, message, defaultMessage}) {
  const pColors = isCorrect
    ? ['#00B894', '#55EFC4', '#FDCB6E', '#6C5CE7', '#4ECDC4', '#A29BFE', '#FFE66D', '#81ECEC']
    : ['#FF7675', '#FAB1A0', '#E17055', '#D63031', '#FF6B6B', '#E74C3C', '#FDCB6E', '#FD79A8'];
  return (
    <View style={styles.centerContent}>
      <Animated.View style={{transform: [{scale}], alignItems: 'center'}}>
        <Icon name={isCorrect ? 'check-circle' : 'close-circle'} size={72} color={iconColor} />
        <Text style={[styles.text, {color: iconColor}]}>{message || defaultMessage}</Text>
      </Animated.View>
      {popParticles.map((p, i) => (
        <Animated.View
          key={i}
          style={[styles.popParticle, {
            backgroundColor: pColors[i % pColors.length],
            transform: [{translateX: p.x}, {translateY: p.y}],
            opacity: p.op,
          }]}
        />
      ))}
    </View>
  );
}

function renderDrop({isCorrect, dropY, shakeAnim, iconColor, message, defaultMessage}) {
  const bgColor = isCorrect ? kidsColors.correctLight : kidsColors.incorrectLight;
  return (
    <View style={[styles.centerContent, {backgroundColor: bgColor}]}>
      <Animated.View style={{transform: [{translateY: dropY}, {translateX: shakeAnim}], alignItems: 'center'}}>
        <Icon name={isCorrect ? 'arrow-down-bold-circle' : 'arrow-up-bold-circle'} size={72} color={iconColor} />
        <Text style={[styles.text, {color: iconColor}]}>{message || defaultMessage}</Text>
      </Animated.View>
    </View>
  );
}

function renderGlow({isCorrect, glowOpacity, scale, iconColor, message, defaultMessage}) {
  const edgeColor = isCorrect ? kidsColors.correct : kidsColors.incorrect;
  return (
    <View style={styles.centerContent}>
      <Animated.View style={[styles.glowEdgeTop, {backgroundColor: edgeColor, opacity: glowOpacity}]} />
      <Animated.View style={[styles.glowEdgeBottom, {backgroundColor: edgeColor, opacity: glowOpacity}]} />
      <Animated.View style={[styles.glowEdgeLeft, {backgroundColor: edgeColor, opacity: glowOpacity}]} />
      <Animated.View style={[styles.glowEdgeRight, {backgroundColor: edgeColor, opacity: glowOpacity}]} />
      <Animated.View style={{transform: [{scale}], alignItems: 'center'}}>
        <Icon name={isCorrect ? 'check-circle-outline' : 'close-circle-outline'} size={64} color={iconColor} />
        <Text style={[styles.text, {color: iconColor}]}>{message || defaultMessage}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 60,
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: kidsFontSize.xxl,
    fontWeight: kidsFontWeight.extrabold,
    marginTop: 8,
  },
  rippleRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
  },
  flipCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  popParticle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  glowEdgeTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 6,
  },
  glowEdgeBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
  },
  glowEdgeLeft: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: 6,
  },
  glowEdgeRight: {
    position: 'absolute', top: 0, bottom: 0, right: 0, width: 6,
  },
});

export default FeedbackOverlay;
