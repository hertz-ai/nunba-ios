import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const DIFFICULTY_CONFIG = {
  easy: { color: '#10B981', label: 'Easy', icon: 'star-outline' },
  medium: { color: '#F59E0B', label: 'Medium', icon: 'star-half-full' },
  hard: { color: '#EF4444', label: 'Hard', icon: 'star' },
};

const formatTimeRemaining = (endTime) => {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, expired: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, expired: false };
};

const CountdownTimer = ({ endTime }) => {
  const [time, setTime] = useState(formatTimeRemaining(endTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTimeRemaining(endTime));
    }, 60000);

    return () => clearInterval(interval);
  }, [endTime]);

  if (time.expired) {
    return <Text style={styles.expiredText}>Expired</Text>;
  }

  return (
    <View style={styles.timerContainer}>
      {time.days > 0 && (
        <View style={styles.timeBlock}>
          <Text style={styles.timeValue}>{time.days}</Text>
          <Text style={styles.timeLabel}>D</Text>
        </View>
      )}
      <View style={styles.timeBlock}>
        <Text style={styles.timeValue}>{time.hours}</Text>
        <Text style={styles.timeLabel}>H</Text>
      </View>
      <View style={styles.timeBlock}>
        <Text style={styles.timeValue}>{time.minutes}</Text>
        <Text style={styles.timeLabel}>M</Text>
      </View>
    </View>
  );
};

const ChallengeCard = ({
  title = 'Challenge',
  description = 'Challenge description',
  difficulty = 'medium',
  endTime,
  progress = 0,
  maxProgress = 100,
  participantCount = 0,
  rewards = [],
  onPress,
  loading = false,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const difficultyConfig = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const progressPercentage = Math.min((progress / maxProgress) * 100, 100);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercentage,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progressPercentage, progressAnim]);

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader width={wp('60%')} height={hp('2.5%')} />
        <SkeletonLoader
          width={wp('80%')}
          height={hp('4%')}
          style={{ marginTop: hp('1%') }}
        />
        <SkeletonLoader
          width={wp('100%')}
          height={hp('1%')}
          style={{ marginTop: hp('2%') }}
        />
      </View>
    );
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animatable.View animation="fadeInUp" duration={500} useNativeDriver>
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View style={styles.gradientTop} />

        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <View
              style={[
                styles.difficultyChip,
                { backgroundColor: difficultyConfig.color + '20' },
              ]}
            >
              <MaterialCommunityIcons
                name={difficultyConfig.icon}
                size={wp('3%')}
                color={difficultyConfig.color}
              />
              <Text
                style={[styles.difficultyText, { color: difficultyConfig.color }]}
              >
                {difficultyConfig.label}
              </Text>
            </View>
          </View>

          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </View>

        {endTime && (
          <View style={styles.timerSection}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={wp('4%')}
              color="#888"
            />
            <CountdownTimer endTime={endTime} />
          </View>
        )}

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressValue}>
              {Math.round(progressPercentage)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressWidth,
                  backgroundColor:
                    progressPercentage >= 100
                      ? '#10B981'
                      : difficultyConfig.color,
                },
              ]}
            />
          </View>
          <Text style={styles.progressDetail}>
            {progress} / {maxProgress} completed
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.participantsSection}>
            <MaterialCommunityIcons
              name="account-group"
              size={wp('4%')}
              color="#888"
            />
            <Text style={styles.participantCount}>
              {participantCount.toLocaleString()} participants
            </Text>
          </View>

          {rewards.length > 0 && (
            <View style={styles.rewardsSection}>
              {rewards.slice(0, 3).map((reward, index) => (
                <View key={index} style={styles.rewardItem}>
                  <MaterialCommunityIcons
                    name={
                      reward.type === 'spark'
                        ? 'lightning-bolt'
                        : reward.type === 'pulse'
                        ? 'heart-pulse'
                        : 'star-four-points'
                    }
                    size={wp('3.5%')}
                    color={
                      reward.type === 'spark'
                        ? '#F59E0B'
                        : reward.type === 'pulse'
                        ? '#EF4444'
                        : '#10B981'
                    }
                  />
                  <Text style={styles.rewardAmount}>+{reward.amount}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginVertical: hp('0.8%'),
    marginHorizontal: wp('3%'),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: hp('8%'),
    backgroundColor: '#252525',
    opacity: 0.5,
  },
  header: {
    marginBottom: hp('1.5%'),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('0.5%'),
  },
  title: {
    color: '#FFFFFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
    flex: 1,
    marginRight: wp('2%'),
  },
  difficultyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.4%'),
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: wp('2.8%'),
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
  description: {
    color: '#888',
    fontSize: wp('3.2%'),
    lineHeight: hp('2.2%'),
  },
  timerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
    paddingVertical: hp('0.8%'),
    paddingHorizontal: wp('3%'),
    backgroundColor: '#252525',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  timerContainer: {
    flexDirection: 'row',
    marginLeft: wp('2%'),
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: wp('2%'),
  },
  timeValue: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  timeLabel: {
    color: '#666',
    fontSize: wp('2.5%'),
    fontWeight: '600',
    marginLeft: 2,
  },
  expiredText: {
    color: '#EF4444',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  progressSection: {
    marginBottom: hp('1.5%'),
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  progressLabel: {
    color: '#888',
    fontSize: wp('3%'),
    fontWeight: '600',
  },
  progressValue: {
    color: '#FFFFFF',
    fontSize: wp('3.5%'),
    fontWeight: '700',
  },
  progressBar: {
    height: hp('1%'),
    backgroundColor: '#2A2A2A',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressDetail: {
    color: '#666',
    fontSize: wp('2.5%'),
    marginTop: hp('0.3%'),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: hp('1%'),
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  participantsSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantCount: {
    color: '#888',
    fontSize: wp('3%'),
    marginLeft: wp('1.5%'),
  },
  rewardsSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: wp('3%'),
    backgroundColor: '#252525',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.3%'),
    borderRadius: 8,
  },
  rewardAmount: {
    color: '#FFFFFF',
    fontSize: wp('3%'),
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
});

export default ChallengeCard;
