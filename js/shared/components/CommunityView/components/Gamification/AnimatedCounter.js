import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
} from 'react-native-responsive-screen';

const AnimatedCounter = ({
  value = 0,
  duration = 1500,
  prefix = '',
  suffix = '',
  decimals = 0,
  formatLarge = true,
  style,
  textStyle,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const previousValue = useRef(0);

  useEffect(() => {
    // Animate from previous value to new value
    animatedValue.setValue(previousValue.current);

    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();

    const listener = animatedValue.addListener(({ value: v }) => {
      setDisplayValue(v);
    });

    previousValue.current = value;

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value, duration, animatedValue]);

  const formatNumber = (num) => {
    if (formatLarge) {
      if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
      }
      if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
      }
    }

    if (decimals > 0) {
      return num.toFixed(decimals);
    }

    return Math.floor(num).toLocaleString();
  };

  return (
    <Text style={[styles.text, textStyle]}>
      {prefix}
      {formatNumber(displayValue)}
      {suffix}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
  },
});

export default AnimatedCounter;
