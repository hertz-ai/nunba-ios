/**
 * DoubleTapToLike — wraps post body content so a double-tap triggers
 * a like + heart burst animation at the centre of the body.
 *
 *   - Native gesture: react-native-gesture-handler TapGestureHandler
 *     with numberOfTaps=2 and maxDelayMs=300 ms.
 *   - Heart burst: Animated.View with spring scale 0 → 1.2 and
 *     opacity decay over 600 ms.
 *   - Haptic: hapticLight() on tap recognition (always, even when
 *     already liked, so the gesture confirms regardless of state).
 *   - Idempotent: a second double-tap on an already-liked post does
 *     NOT re-fire onLike — only the visual burst replays.
 *
 * Caller supplies:
 *   - liked       : boolean — current like state (controlled)
 *   - onLike()    : invoked only on first double-tap when !liked
 *   - children    : the post body (Image / Text / etc.)
 *
 * Plan ref: Part X.3.2 (sunny-gliding-eich.md).
 */
import React, { useRef, useCallback } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { hapticLight } from '../../../../../../services/haptics';

const HEART_SIZE = 88;

const DoubleTapToLike = ({ liked, onLike, children }) => {
  const burstScale = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;

  const playBurst = useCallback(() => {
    burstScale.setValue(0);
    burstOpacity.setValue(0.95);
    Animated.parallel([
      Animated.spring(burstScale, {
        toValue: 1.2,
        useNativeDriver: true,
        damping: 12,
        stiffness: 200,
      }),
      Animated.timing(burstOpacity, {
        toValue: 0,
        duration: 600,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [burstScale, burstOpacity]);

  const handleTap = useCallback(
    ({ nativeEvent }) => {
      if (nativeEvent.state !== State.ACTIVE) return;
      hapticLight();
      playBurst();
      if (!liked && typeof onLike === 'function') {
        onLike();
      }
    },
    [liked, onLike, playBurst],
  );

  return (
    <TapGestureHandler
      numberOfTaps={2}
      maxDelayMs={300}
      onHandlerStateChange={handleTap}
      testID="DoubleTapToLike.handler"
    >
      <View style={styles.wrap}>
        {children}
        <Animated.View
          pointerEvents="none"
          testID="DoubleTapToLike.burst"
          style={[
            styles.burst,
            {
              transform: [{ scale: burstScale }],
              opacity: burstOpacity,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="heart"
            size={HEART_SIZE}
            color="#FF3B6B"
          />
        </Animated.View>
      </View>
    </TapGestureHandler>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  burst: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -HEART_SIZE / 2,
    marginTop: -HEART_SIZE / 2,
    width: HEART_SIZE,
    height: HEART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B6B',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
});

export default DoubleTapToLike;
