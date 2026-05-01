import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import SkeletonLoader from './SkeletonLoader';

const getTierColor = (level) => {
  if (level >= 41) return { primary: '#FFD700', secondary: '#FFA500', glow: '#FFD70080' };
  if (level >= 26) return { primary: '#9333EA', secondary: '#7C3AED', glow: '#9333EA80' };
  if (level >= 11) return { primary: '#3B82F6', secondary: '#2563EB', glow: '#3B82F680' };
  return { primary: '#10B981', secondary: '#059669', glow: '#10B98180' };
};

const LevelBadge = ({
  level = 1,
  currentXP = 0,
  xpToNextLevel = 1000,
  size = 'medium',
  showProgress = true,
  isLevelingUp = false,
  loading = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const sizeConfig = {
    small: { container: wp('12%'), fontSize: wp('4%'), strokeWidth: 3 },
    medium: { container: wp('20%'), fontSize: wp('6%'), strokeWidth: 4 },
    large: { container: wp('28%'), fontSize: wp('8%'), strokeWidth: 5 },
  };

  const config = sizeConfig[size] || sizeConfig.medium;
  const tierColors = getTierColor(level);
  const progress = Math.min(currentXP / xpToNextLevel, 1);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  useEffect(() => {
    if (isLevelingUp) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 }
      ).start();
    }
  }, [isLevelingUp, pulseAnim]);

  if (loading) {
    return <SkeletonLoader variant="badge" />;
  }

  const containerSize = config.container;
  const innerSize = containerSize * 0.85;
  const progressRingSize = containerSize;

  const circumference = Math.PI * (progressRingSize - config.strokeWidth);

  return (
    <Animatable.View
      animation={isLevelingUp ? 'pulse' : undefined}
      iterationCount={isLevelingUp ? 3 : 1}
      duration={600}
    >
      <Animated.View
        style={[
          styles.container,
          {
            width: containerSize,
            height: containerSize,
            transform: [{ scale: pulseAnim }],
            shadowColor: tierColors.glow,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 15,
            elevation: 10,
          },
        ]}
      >
        {showProgress && (
          <View
            style={[
              styles.progressRing,
              {
                width: progressRingSize,
                height: progressRingSize,
                borderRadius: progressRingSize / 2,
                borderWidth: config.strokeWidth,
                borderColor: '#2A2A2A',
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressRingSize,
                  height: progressRingSize,
                  borderRadius: progressRingSize / 2,
                  borderWidth: config.strokeWidth,
                  borderColor: tierColors.primary,
                  borderTopColor: 'transparent',
                  borderRightColor: 'transparent',
                  transform: [
                    {
                      rotate: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        )}

        <View
          style={[
            styles.innerCircle,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              backgroundColor: tierColors.primary,
            },
          ]}
        >
          <View
            style={[
              styles.gradientOverlay,
              {
                width: innerSize,
                height: innerSize / 2,
                borderTopLeftRadius: innerSize / 2,
                borderTopRightRadius: innerSize / 2,
                backgroundColor: tierColors.secondary,
                opacity: 0.5,
              },
            ]}
          />
          <Text style={[styles.levelText, { fontSize: config.fontSize }]}>
            {level}
          </Text>
        </View>
      </Animated.View>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRing: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressFill: {
    position: 'absolute',
  },
  innerCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
  },
  levelText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default LevelBadge;
