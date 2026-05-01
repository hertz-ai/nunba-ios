import React, {useEffect, useRef} from 'react';
import {View, Text, Animated, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight} from '../../../../../theme/kidsColors';

/**
 * MediaLoadingIndicator - Kid-friendly loading animation for media generation.
 *
 * Shows a bouncing icon with a friendly message while backend generates media.
 *
 * Props:
 * - type: 'music' | 'video' | 'tts' | 'general'
 * - message: string (optional custom message)
 * - progress: number 0-1 (optional progress indicator)
 */
const ICONS = {
  music: 'music-note',
  video: 'video',
  tts: 'microphone',
  general: 'loading',
};

const MESSAGES = {
  music: 'Creating music...',
  video: 'Making a video...',
  tts: 'Getting voice ready...',
  general: 'Loading...',
};

const MediaLoadingIndicator = ({type = 'general', message, progress}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {toValue: -15, duration: 400, useNativeDriver: true}),
        Animated.timing(bounceAnim, {toValue: 0, duration: 400, useNativeDriver: true}),
      ]),
    );

    const spin = Animated.loop(
      Animated.timing(spinAnim, {toValue: 1, duration: 2000, useNativeDriver: true}),
    );

    bounce.start();
    if (type === 'general') spin.start();

    return () => {
      bounce.stop();
      spin.stop();
    };
  }, [type]);

  const spinInterp = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const iconName = ICONS[type] || ICONS.general;
  const displayMessage = message || MESSAGES[type] || MESSAGES.general;

  return (
    <View style={styles.container}>
      <Animated.View style={{
        transform: [
          {translateY: bounceAnim},
          ...(type === 'general' ? [{rotate: spinInterp}] : []),
        ],
      }}>
        <Icon name={iconName} size={48} color={kidsColors.accent} />
      </Animated.View>

      <Text style={styles.message}>{displayMessage}</Text>

      {typeof progress === 'number' && progress > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {width: `${Math.round(progress * 100)}%`}]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: kidsSpacing.xl,
    gap: kidsSpacing.md,
  },
  message: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textSecondary,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    width: '80%',
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: kidsColors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: kidsColors.accent,
    borderRadius: 4,
  },
  progressText: {
    fontSize: kidsFontSize.xs,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textSecondary,
    minWidth: 36,
    textAlign: 'right',
  },
});

export default MediaLoadingIndicator;
