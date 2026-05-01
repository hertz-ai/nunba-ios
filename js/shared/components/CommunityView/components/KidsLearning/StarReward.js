import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors} from '../../../../theme/kidsColors';
import {SPRINGS} from './shared/gameThemes';

const StarReward = ({visible, count = 1, onComplete}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      translateY.setValue(0);
      opacityAnim.setValue(1);

      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleAnim, {toValue: 1.3, ...SPRINGS.quick}),
          Animated.spring(scaleAnim, {toValue: 1, ...SPRINGS.playful}),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.parallel([
            Animated.timing(translateY, {toValue: -100, duration: 500, useNativeDriver: true}),
            Animated.timing(opacityAnim, {toValue: 0, duration: 500, useNativeDriver: true}),
          ]),
        ]),
      ]).start(() => {
        if (onComplete) onComplete();
      });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{scale: scaleAnim}, {translateY}],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <Icon name="star" size={64} color={kidsColors.star} />
      {count > 1 && (
        <Animated.Text style={styles.countText}>x{count}</Animated.Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    zIndex: 50,
    alignItems: 'center',
  },
  countText: {
    fontSize: 24,
    fontWeight: '800',
    color: kidsColors.starGlow,
    marginTop: -8,
  },
});

export default StarReward;
