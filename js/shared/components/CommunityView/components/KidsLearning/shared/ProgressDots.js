import React from 'react';
import {View, StyleSheet} from 'react-native';
import {kidsColors, kidsSpacing} from '../../../../../theme/kidsColors';

/**
 * ProgressDots - Shows question progress as dots.
 *
 * Props:
 * - total: number of questions
 * - current: current question index (0-based)
 * - results: [true, false, true, ...] - answers so far
 */
const ProgressDots = ({total, current, results = []}) => {
  const correctCount = results.filter(r => r === true).length;
  const incorrectCount = results.filter(r => r === false).length;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={`Question ${current + 1} of ${total}, ${correctCount} correct, ${incorrectCount} incorrect`}
    >
      {Array.from({length: total}, (_, i) => {
        let color = kidsColors.border;
        if (i < results.length) {
          color = results[i] ? kidsColors.correct : kidsColors.incorrect;
        } else if (i === current) {
          color = kidsColors.accent;
        }
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {backgroundColor: color},
              i === current && styles.dotCurrent,
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: kidsSpacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotCurrent: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});

export default ProgressDots;
