import React, { useState, useRef } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';

/**
 * Simple Slider replacement for @react-native-community/slider.
 * Same API: minimumValue, maximumValue, step, value, onSlidingComplete,
 * minimumTrackTintColor, maximumTrackTintColor, thumbTintColor, style.
 */
const Slider = ({
  minimumValue = 0,
  maximumValue = 1,
  step = 0,
  value: propValue = 0,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor = '#00e89d',
  maximumTrackTintColor = '#3a3a4e',
  thumbTintColor = '#00e89d',
  style,
}) => {
  const [sliderWidth, setSliderWidth] = useState(0);
  const currentValue = useRef(propValue);

  const valueToPosition = (val) => {
    const range = maximumValue - minimumValue;
    if (range === 0) return 0;
    return ((val - minimumValue) / range) * sliderWidth;
  };

  const positionToValue = (pos) => {
    const range = maximumValue - minimumValue;
    let val = (pos / sliderWidth) * range + minimumValue;
    if (step > 0) {
      val = Math.round(val / step) * step;
    }
    return Math.max(minimumValue, Math.min(maximumValue, val));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const newVal = positionToValue(x);
        currentValue.current = newVal;
        onValueChange && onValueChange(newVal);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const newVal = positionToValue(Math.max(0, Math.min(sliderWidth, x)));
        currentValue.current = newVal;
        onValueChange && onValueChange(newVal);
      },
      onPanResponderRelease: () => {
        onSlidingComplete && onSlidingComplete(currentValue.current);
      },
    })
  ).current;

  const thumbPosition = valueToPosition(propValue);
  const fillWidth = sliderWidth > 0 ? (thumbPosition / sliderWidth) * 100 : 0;

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: maximumTrackTintColor }]}>
        <View style={[styles.fill, { width: `${fillWidth}%`, backgroundColor: minimumTrackTintColor }]} />
      </View>
      <View style={[styles.thumb, { left: thumbPosition - 12, backgroundColor: thumbTintColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: 40, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2 },
  fill: { height: 4, borderRadius: 2 },
  thumb: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12,
    top: 8, elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2,
  },
});

export default Slider;
