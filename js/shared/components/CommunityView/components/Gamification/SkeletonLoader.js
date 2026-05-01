import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const PRESETS = {
  card: { width: wp('90%'), height: hp('15%'), borderRadius: 12 },
  text: { width: wp('60%'), height: hp('2%'), borderRadius: 4 },
  avatar: { width: wp('12%'), height: wp('12%'), borderRadius: wp('6%') },
  wallet: { width: wp('40%'), height: hp('10%'), borderRadius: 16 },
  badge: { width: wp('15%'), height: wp('15%'), borderRadius: wp('7.5%') },
  button: { width: wp('30%'), height: hp('5%'), borderRadius: 20 },
};

const SkeletonLoader = ({
  width,
  height,
  borderRadius = 8,
  variant,
  style,
}) => {
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [shimmerValue]);

  const preset = variant ? PRESETS[variant] : null;
  const finalWidth = width || (preset ? preset.width : wp('100%'));
  const finalHeight = height || (preset ? preset.height : hp('5%'));
  const finalBorderRadius = borderRadius || (preset ? preset.borderRadius : 8);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View
      style={[
        styles.container,
        {
          width: finalWidth,
          height: finalHeight,
          borderRadius: finalBorderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            opacity,
            borderRadius: finalBorderRadius,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E1E',
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2A2A2A',
  },
});

export default SkeletonLoader;
