import React, { useRef, useState, useCallback } from 'react';
import {
  TouchableOpacity,
  View,
  Animated,
  StyleSheet,
  Platform,
  findNodeHandle,
} from 'react-native';
import useDeviceCapabilityStore from '../../deviceCapabilityStore';

/**
 * TVFocusableItem - Unified touchable that works on both phone and TV.
 * On TV: Adds focus ring, scale animation, and D-pad navigation props.
 * On Phone/Tablet: Standard TouchableOpacity passthrough.
 */
const TVFocusableItem = ({
  children,
  onPress,
  style,
  focusStyle,
  scaleFactor = 1.05,
  focusBorderColor = '#FFD700',
  focusBorderWidth = 3,
  hasTVPreferredFocus = false,
  nextFocusDown,
  nextFocusUp,
  nextFocusLeft,
  nextFocusRight,
  activeOpacity = 0.7,
  disabled = false,
  testID,
  ...rest
}) => {
  const deviceType = useDeviceCapabilityStore((s) => s.deviceType);
  const isTV = deviceType === 'tv';
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.spring(scaleAnim, {
      toValue: scaleFactor,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim, scaleFactor]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  if (!isTV) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={style}
        activeOpacity={activeOpacity}
        disabled={disabled}
        testID={testID}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    );
  }

  // TV mode: animated focusable item
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          style,
          isFocused && [
            styles.focused,
            { borderColor: focusBorderColor, borderWidth: focusBorderWidth },
            focusStyle,
          ],
        ]}
        activeOpacity={1}
        hasTVPreferredFocus={hasTVPreferredFocus}
        nextFocusDown={nextFocusDown}
        nextFocusUp={nextFocusUp}
        nextFocusLeft={nextFocusLeft}
        nextFocusRight={nextFocusRight}
        disabled={disabled}
        testID={testID}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  focused: {
    borderRadius: 8,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
});

export default TVFocusableItem;
