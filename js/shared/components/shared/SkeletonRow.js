/**
 * SkeletonRow — LinkedIn-style placeholder rows for FlatList loading
 * state.  Pure opacity loop; no LinearGradient dependency so this works
 * across the existing dep matrix without new pods.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { colors, TIMINGS, spacing, borderRadius } from '../../theme/colors';

const shimmerAnim = {
  0:   { opacity: 0.4 },
  0.5: { opacity: 0.85 },
  1:   { opacity: 0.4 },
};

const SkeletonRow = ({ count = 6 }) => {
  const rows = [];
  for (let i = 0; i < count; i += 1) rows.push(i);
  return (
    <View>
      {rows.map((i) => (
        <View key={i} style={styles.row}>
          <Animatable.View
            animation={shimmerAnim}
            iterationCount="infinite"
            duration={TIMINGS.shimmerMs}
            easing="ease-in-out"
            useNativeDriver
            style={styles.avatar}
          />
          <View style={styles.body}>
            <Animatable.View
              animation={shimmerAnim}
              iterationCount="infinite"
              duration={TIMINGS.shimmerMs}
              easing="ease-in-out"
              useNativeDriver
              style={[styles.line, { width: '55%' }]}
            />
            <Animatable.View
              animation={shimmerAnim}
              iterationCount="infinite"
              duration={TIMINGS.shimmerMs}
              easing="ease-in-out"
              useNativeDriver
              style={[styles.line, { width: '85%', marginTop: 6 }]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
  },
  body: {
    flex: 1,
    marginLeft: spacing.md,
  },
  line: {
    height: 12,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
  },
});

export default SkeletonRow;
