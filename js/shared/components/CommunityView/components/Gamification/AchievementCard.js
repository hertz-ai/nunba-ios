import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const RARITY_COLORS = {
  common: { primary: '#6B7280', secondary: '#4B5563', badge: '#374151' },
  uncommon: { primary: '#10B981', secondary: '#059669', badge: '#065F46' },
  rare: { primary: '#3B82F6', secondary: '#2563EB', badge: '#1E40AF' },
  legendary: { primary: '#F59E0B', secondary: '#D97706', badge: '#B45309' },
};

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

const AchievementCard = ({
  icon = 'trophy',
  name = 'Achievement',
  description = 'Achievement description',
  rarity = 'common',
  isUnlocked = false,
  progress = 0,
  maxProgress = 100,
  unlockedAt,
  onPress,
  loading = false,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const rarityConfig = RARITY_COLORS[rarity] || RARITY_COLORS.common;

  useEffect(() => {
    if (isUnlocked && rarity === 'legendary') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isUnlocked, rarity, shimmerAnim]);

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader variant="avatar" />
        <View style={styles.content}>
          <SkeletonLoader width={wp('40%')} height={hp('2%')} />
          <SkeletonLoader
            width={wp('55%')}
            height={hp('1.5%')}
            style={{ marginTop: hp('0.5%') }}
          />
        </View>
      </View>
    );
  }

  const progressPercentage = Math.min((progress / maxProgress) * 100, 100);
  const showProgress = !isUnlocked && maxProgress > 0;

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.8, 0.3],
  });

  return (
    <Animatable.View
      animation="fadeInUp"
      duration={500}
      useNativeDriver
    >
      <TouchableOpacity
        style={[
          styles.container,
          !isUnlocked && styles.lockedContainer,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {isUnlocked && rarity === 'legendary' && (
          <Animated.View
            style={[
              styles.shimmerOverlay,
              {
                opacity: shimmerOpacity,
                backgroundColor: rarityConfig.primary,
              },
            ]}
          />
        )}

        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isUnlocked
                ? rarityConfig.primary + '20'
                : '#1E1E1E',
              borderColor: isUnlocked ? rarityConfig.primary : '#333',
            },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={wp('7%')}
            color={isUnlocked ? rarityConfig.primary : '#444'}
          />
          {isUnlocked && (
            <View style={styles.checkBadge}>
              <MaterialCommunityIcons
                name="check-circle"
                size={wp('4%')}
                color="#10B981"
              />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text
              style={[
                styles.name,
                !isUnlocked && styles.lockedText,
              ]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <View
              style={[
                styles.rarityBadge,
                { backgroundColor: rarityConfig.badge },
              ]}
            >
              <Text
                style={[styles.rarityText, { color: rarityConfig.primary }]}
              >
                {RARITY_LABELS[rarity]}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.description,
              !isUnlocked && styles.lockedText,
            ]}
            numberOfLines={2}
          >
            {description}
          </Text>

          {showProgress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercentage}%`,
                      backgroundColor: rarityConfig.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {progress}/{maxProgress}
              </Text>
            </View>
          )}

          {isUnlocked && unlockedAt && (
            <Text style={styles.unlockedAt}>
              Unlocked {unlockedAt}
            </Text>
          )}
        </View>

        {!isUnlocked && (
          <View style={styles.lockOverlay}>
            <MaterialCommunityIcons
              name="lock"
              size={wp('5%')}
              color="#444"
            />
          </View>
        )}
      </TouchableOpacity>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginVertical: hp('0.5%'),
    marginHorizontal: wp('3%'),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  lockedContainer: {
    opacity: 0.6,
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  iconContainer: {
    width: wp('14%'),
    height: wp('14%'),
    borderRadius: wp('7%'),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: wp('3%'),
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#121212',
    borderRadius: wp('2%'),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('0.5%'),
  },
  name: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    flex: 1,
    marginRight: wp('2%'),
  },
  lockedText: {
    color: '#666',
  },
  rarityBadge: {
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.3%'),
    borderRadius: 8,
  },
  rarityText: {
    fontSize: wp('2.5%'),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  description: {
    color: '#888',
    fontSize: wp('3%'),
    lineHeight: hp('2%'),
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1%'),
  },
  progressBar: {
    flex: 1,
    height: hp('0.8%'),
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    marginRight: wp('2%'),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    color: '#666',
    fontSize: wp('2.5%'),
    fontWeight: '600',
  },
  unlockedAt: {
    color: '#10B981',
    fontSize: wp('2.5%'),
    marginTop: hp('0.5%'),
  },
  lockOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: wp('2%'),
  },
});

export default AchievementCard;
