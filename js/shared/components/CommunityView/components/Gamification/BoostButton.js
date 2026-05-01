import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const BoostButton = ({
  sparkCost = 10,
  currentSpark = 0,
  label = 'Boost',
  onPress,
  size = 'medium',
  loading = false,
  disabled = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isDisabled = disabled || currentSpark < sparkCost;

  const sizeConfig = {
    small: {
      paddingH: wp('4%'),
      paddingV: hp('1%'),
      iconSize: wp('4%'),
      fontSize: wp('3%'),
      borderRadius: 16,
    },
    medium: {
      paddingH: wp('6%'),
      paddingV: hp('1.5%'),
      iconSize: wp('5%'),
      fontSize: wp('3.5%'),
      borderRadius: 20,
    },
    large: {
      paddingH: wp('8%'),
      paddingV: hp('2%'),
      iconSize: wp('6%'),
      fontSize: wp('4%'),
      borderRadius: 24,
    },
  };

  const config = sizeConfig[size] || sizeConfig.medium;

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (isDisabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (isDisabled) return;

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    onPress && onPress();
  };

  if (loading) {
    return (
      <SkeletonLoader
        width={wp('30%')}
        height={hp('5%')}
        borderRadius={config.borderRadius}
      />
    );
  }

  return (
    <Animatable.View animation="fadeIn" duration={400}>
      <Animated.View
        style={[
          styles.buttonWrapper,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              paddingHorizontal: config.paddingH,
              paddingVertical: config.paddingV,
              borderRadius: config.borderRadius,
              opacity: isDisabled ? 0.5 : 1,
            },
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          disabled={isDisabled}
        >
          <View style={styles.gradientBg}>
            <View style={styles.gradientLayer1} />
            <View style={styles.gradientLayer2} />
          </View>

          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <MaterialCommunityIcons
              name="rocket-launch"
              size={config.iconSize}
              color="#FFFFFF"
            />
          </Animated.View>

          <Text style={[styles.label, { fontSize: config.fontSize }]}>
            {label}
          </Text>

          <View style={styles.costContainer}>
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={config.iconSize * 0.8}
              color="#F59E0B"
            />
            <Text style={[styles.costText, { fontSize: config.fontSize * 0.9 }]}>
              {sparkCost}
            </Text>
          </View>

          {!isDisabled && (
            <Animatable.View
              animation="pulse"
              iterationCount="infinite"
              duration={2000}
              style={styles.glowEffect}
            />
          )}
        </TouchableOpacity>
      </Animated.View>

      {isDisabled && currentSpark < sparkCost && (
        <Text style={styles.insufficientText}>
          Need {sparkCost - currentSpark} more Spark
        </Text>
      )}
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  buttonWrapper: {
    alignSelf: 'flex-start',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F59E0B',
  },
  gradientLayer1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#FBBF24',
    opacity: 0.8,
  },
  gradientLayer2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#D97706',
    opacity: 0.8,
  },
  iconContainer: {
    marginRight: wp('2%'),
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginRight: wp('3%'),
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.3%'),
    borderRadius: 12,
  },
  costText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: wp('0.5%'),
  },
  glowEffect: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  insufficientText: {
    color: '#EF4444',
    fontSize: wp('2.5%'),
    marginTop: hp('0.5%'),
    textAlign: 'center',
  },
});

export default BoostButton;
