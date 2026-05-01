import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows, numPadColors} from '../../../../../theme/kidsColors';

/**
 * NumberPad - Large number input pad for counting/math games.
 *
 * Props:
 * - value: string (current input value)
 * - onValueChange: (value: string) => void
 * - onSubmit: (value: number) => void
 * - maxDigits: number (default 3)
 */
const NumberPad = ({value = '', onValueChange, onSubmit, maxDigits = 3, colorful = false}) => {
  const handlePress = (digit) => {
    if (value.length < maxDigits) {
      const newValue = value + digit;
      onValueChange(newValue);
    }
  };

  const handleDelete = () => {
    const newValue = value.slice(0, -1);
    onValueChange(newValue);
  };

  const handleSubmit = () => {
    if (value.length > 0) {
      const num = parseInt(value, 10);
      if (!isNaN(num)) onSubmit(num);
    }
  };

  const renderKey = (digit) => {
    const colorfulStyle = colorful
      ? {backgroundColor: numPadColors[digit], borderRadius: 9999, width: 64, height: 64}
      : {};
    const colorfulTextStyle = colorful ? {color: '#FFFFFF'} : {};

    return (
      <TouchableOpacity
        key={digit}
        style={[styles.key, colorfulStyle]}
        onPress={() => handlePress(String(digit))}
        activeOpacity={0.6}
        accessible={true}
        accessibilityLabel={`Number ${digit}`}
        accessibilityRole="button"
      >
        <Text style={[styles.keyText, colorfulTextStyle]}>{digit}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Display */}
      <View style={styles.display}>
        <Text style={styles.displayText}>{value || '?'}</Text>
      </View>

      {/* Number Grid */}
      <View style={styles.grid}>
        <View style={styles.row}>
          {[1, 2, 3].map(renderKey)}
        </View>
        <View style={styles.row}>
          {[4, 5, 6].map(renderKey)}
        </View>
        <View style={styles.row}>
          {[7, 8, 9].map(renderKey)}
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.key, styles.deleteKey]}
            onPress={handleDelete}
            accessible={true}
            accessibilityLabel="Delete"
            accessibilityRole="button"
          >
            <Icon name="backspace-outline" size={28} color={kidsColors.incorrect} />
          </TouchableOpacity>
          {renderKey(0)}
          <TouchableOpacity
            style={[styles.key, styles.submitKey, value.length === 0 && {opacity: 0.5}]}
            onPress={handleSubmit}
            disabled={value.length === 0}
            accessible={true}
            accessibilityLabel="Submit answer"
            accessibilityRole="button"
          >
            <Icon name="check" size={28} color={kidsColors.textOnDark} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: kidsSpacing.md,
  },
  display: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.lg,
    paddingVertical: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.xl,
    marginBottom: kidsSpacing.md,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: kidsColors.accent,
  },
  displayText: {
    fontSize: kidsFontSize.display,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textPrimary,
  },
  grid: {
    gap: kidsSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: kidsSpacing.sm,
  },
  key: {
    width: 72,
    height: 60,
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...kidsShadows.card,
  },
  keyText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
  deleteKey: {
    backgroundColor: kidsColors.incorrectLight,
  },
  submitKey: {
    backgroundColor: kidsColors.correct,
  },
});

export default NumberPad;
