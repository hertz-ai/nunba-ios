import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../Gamification/SkeletonLoader';
import { spacing } from '../../../../theme/colors';

const InsightCardSkeleton = () => (
  <View style={styles.container}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={styles.cardWrapper}>
        <SkeletonLoader width={140} height={76} borderRadius={12} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
  },
  cardWrapper: {
    marginRight: spacing.sm,
  },
});

export default InsightCardSkeleton;
