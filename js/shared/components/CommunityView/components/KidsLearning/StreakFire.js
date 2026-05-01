import React, {useEffect, useRef} from 'react';
import {View, Text, Animated, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsFontSize, kidsFontWeight} from '../../../../theme/kidsColors';
import {SPRINGS} from './shared/gameThemes';

const StreakFire = ({streak, visible}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && streak >= 3) {
      scaleAnim.setValue(0.5);
      Animated.sequence([
        Animated.spring(scaleAnim, {toValue: 1.2, ...SPRINGS.quick}),
        Animated.spring(scaleAnim, {toValue: 1, ...SPRINGS.playful}),
      ]).start();

      // Continuous bounce
      const bounceLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {toValue: -5, duration: 300, useNativeDriver: true}),
          Animated.timing(bounceAnim, {toValue: 0, duration: 300, useNativeDriver: true}),
        ]),
      );
      bounceLoop.start();
      return () => bounceLoop.stop();
    }
  }, [visible, streak]);

  if (!visible || streak < 3) return null;

  const getStreakLabel = () => {
    if (streak >= 10) return 'LEGENDARY!';
    if (streak >= 7) return 'ON FIRE!';
    if (streak >= 5) return 'AMAZING!';
    return 'NICE!';
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{scale: scaleAnim}, {translateY: bounceAnim}],
        },
      ]}
      pointerEvents="none"
    >
      <Icon
        name="fire"
        size={streak >= 7 ? 48 : streak >= 5 ? 40 : 32}
        color={streak >= 7 ? '#FF0000' : kidsColors.streakFire}
      />
      <Text style={styles.streakNum}>{streak}</Text>
      <Text style={styles.label}>{getStreakLabel()}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    top: '30%',
    alignItems: 'center',
    zIndex: 40,
  },
  streakNum: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.streakFire,
    marginTop: -8,
  },
  label: {
    fontSize: kidsFontSize.xs,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.streak,
  },
});

export default StreakFire;
