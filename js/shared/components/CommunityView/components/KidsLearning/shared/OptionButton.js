import React, {useRef, useEffect} from 'react';
import {TouchableOpacity, Text, Animated, StyleSheet, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../../theme/kidsColors';
import usePressAnimation from '../../../../../hooks/usePressAnimation';
import {SPRINGS} from './gameThemes';

/**
 * OptionButton - Large, kid-friendly option button with feedback animations.
 *
 * Props:
 * - label: string
 * - icon?: string (MaterialCommunityIcons name)
 * - emoji?: string (emoji character to show as large visual before label)
 * - onPress: () => void
 * - state: 'default' | 'correct' | 'incorrect' | 'disabled'
 * - color?: string (accent color)
 * - size: 'normal' | 'large'
 */
const OptionButton = ({label, icon, emoji, onPress, state = 'default', color, size = 'normal'}) => {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;
  const { onPressIn, onPressOut, animatedStyle: pressStyle } = usePressAnimation(0.96);

  useEffect(() => {
    if (state === 'incorrect') {
      Animated.sequence([
        Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: true}),
        Animated.timing(shakeAnim, {toValue: -10, duration: 50, useNativeDriver: true}),
        Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: true}),
        Animated.timing(shakeAnim, {toValue: 0, duration: 50, useNativeDriver: true}),
      ]).start();
    } else if (state === 'correct') {
      Animated.sequence([
        Animated.spring(scaleAnim, {toValue: 1.08, ...SPRINGS.quick}),
        Animated.spring(scaleAnim, {toValue: 1, ...SPRINGS.playful}),
      ]).start();
    }
  }, [state]);

  const getBgColor = () => {
    if (state === 'correct') return kidsColors.correct;
    if (state === 'incorrect') return kidsColors.incorrect;
    return color || kidsColors.card;
  };

  const getTextColor = () => {
    if (state === 'correct' || state === 'incorrect') return kidsColors.textOnDark;
    return kidsColors.textPrimary;
  };

  const isLarge = size === 'large';

  return (
    <Animated.View
      style={[{
        transform: [{translateX: shakeAnim}, {scale: scaleAnim}],
      }, pressStyle]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={state === 'disabled' || state === 'correct' || state === 'incorrect'}
        activeOpacity={0.85}
        accessible={true}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{
          disabled: state === 'disabled' || state === 'correct' || state === 'incorrect',
          checked: state === 'correct',
        }}
        style={[
          styles.button,
          isLarge && styles.buttonLarge,
          {backgroundColor: getBgColor()},
          state === 'default' && styles.buttonDefault,
        ]}
      >
        {emoji && (
          <Text style={{fontSize: isLarge ? 32 : 24}}>{emoji}</Text>
        )}
        {icon && !emoji && (
          <Icon name={icon} size={isLarge ? 32 : 24} color={getTextColor()} />
        )}
        <Text
          style={[
            styles.label,
            isLarge && styles.labelLarge,
            {color: getTextColor()},
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {state === 'correct' && (
          <Icon name="check-circle" size={20} color={kidsColors.textOnDark} style={styles.stateIcon} />
        )}
        {state === 'incorrect' && (
          <Icon name="close-circle" size={20} color={kidsColors.textOnDark} style={styles.stateIcon} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    paddingVertical: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.lg,
    borderRadius: kidsBorderRadius.lg,
    minHeight: 56,
    ...kidsShadows.card,
  },
  buttonLarge: {
    paddingVertical: kidsSpacing.lg,
    minHeight: 72,
  },
  buttonDefault: {
    borderWidth: 2,
    borderColor: kidsColors.border,
  },
  label: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    textAlign: 'center',
    flex: 1,
  },
  labelLarge: {
    fontSize: kidsFontSize.lg,
  },
  stateIcon: {
    marginLeft: kidsSpacing.xs,
  },
});

export default OptionButton;
