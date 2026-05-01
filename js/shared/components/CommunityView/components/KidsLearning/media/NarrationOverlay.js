import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Animated} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight} from '../../../../../theme/kidsColors';
import TTSManager from '../shared/TTSManager';

/**
 * NarrationOverlay - Displays text with TTS narration and visual indicator.
 *
 * Shows a speaker icon that pulses while TTS is speaking.
 * Tap to replay narration.
 *
 * Props:
 * - text: string - The text to display and narrate
 * - autoSpeak: boolean (default true) - Auto-speak on mount/text change
 * - voice: string - TTS voice
 * - style: ViewStyle
 */
const NarrationOverlay = ({text, autoSpeak = true, voice, style}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pulseAnim = useState(() => new Animated.Value(1))[0];

  useEffect(() => {
    if (autoSpeak && text) {
      handleSpeak();
    }
    return () => {
      TTSManager.stop();
    };
  }, [text]);

  useEffect(() => {
    if (isSpeaking) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.2, duration: 500, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 500, useNativeDriver: true}),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSpeaking]);

  const handleSpeak = useCallback(async () => {
    if (!text) return;
    setIsSpeaking(true);
    await TTSManager.speak(text, {
      voice,
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
    setIsSpeaking(false);
  }, [text, voice]);

  if (!text) return null;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>{text}</Text>
      <TouchableOpacity
        style={styles.speakerButton}
        onPress={handleSpeak}
        activeOpacity={0.7}
        disabled={isSpeaking}
        accessibilityLabel={isSpeaking ? 'Speaking narration' : 'Speak narration'}
        accessibilityRole="button"
        accessibilityState={{disabled: isSpeaking}}
      >
        <Animated.View style={{transform: [{scale: pulseAnim}]}}>
          <Icon
            name={isSpeaking ? 'volume-high' : 'volume-medium'}
            size={24}
            color={isSpeaking ? kidsColors.accent : kidsColors.textSecondary}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.lg,
    padding: kidsSpacing.md,
    gap: kidsSpacing.sm,
  },
  text: {
    flex: 1,
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textPrimary,
    lineHeight: kidsFontSize.md * 1.5,
  },
  speakerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: kidsColors.hintBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NarrationOverlay;
