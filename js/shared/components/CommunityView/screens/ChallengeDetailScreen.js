import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  SafeAreaView,
  StatusBar,
  Share,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { challengesApi, shareApi } from '../../../services/socialApi';
import { SkeletonLoader, AnimatedCounter } from '../components/Gamification';

const DIFFICULTY_CONFIG = {
  easy: { color: '#10B981', label: 'Easy', icon: 'star-outline' },
  medium: { color: '#F59E0B', label: 'Medium', icon: 'star-half-full' },
  hard: { color: '#EF4444', label: 'Hard', icon: 'star' },
};

const ChallengeDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { challengeId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const fetchChallenge = async () => {
      setLoading(true);
      try {
        const res = await challengesApi.get(challengeId);
        if (res.data) {
          setChallenge(res.data);
          setIsJoined(res.data.isJoined || false);
        }
      } catch (e) { /* show error or go back */ }
      setLoading(false);
    };
    if (challengeId) fetchChallenge();
  }, [challengeId]);

  useEffect(() => {
    if (!challenge?.endDate) return;

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(challenge.endDate);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, expired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft({ days, hours, minutes, expired: false });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [challenge]);

  const handleJoinLeave = () => {
    setIsJoined(!isJoined);
  };

  const handleShare = async () => {
    try {
      const res = await shareApi.createLink('challenge', challengeId);
      const url = res?.data?.url ? `https://hevolve.ai${res.data.url}` : `https://hevolve.ai/social/challenges/${challengeId}`;
      await Share.share({ message: `Check out this challenge on Hevolve: ${url}`, url });
    } catch (e) {
      await Share.share({ message: `https://hevolve.ai/social/challenges/${challengeId}` });
    }
  };

  const difficultyConfig = challenge ? DIFFICULTY_CONFIG[challenge.difficulty] : DIFFICULTY_CONFIG.easy;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Challenge</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" style={{ marginTop: hp('2%') }} />
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent = (challenge.progress / challenge.goal) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenge</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animatable.View animation="fadeIn" style={styles.heroSection}>
          {challenge.imageUrl ? (
            <Image source={{ uri: challenge.imageUrl }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: `${difficultyConfig.color}22` }]}>
              <MaterialCommunityIcons name="flag-checkered" size={64} color={difficultyConfig.color} />
            </View>
          )}
          <View style={[styles.difficultyBadge, { backgroundColor: `${difficultyConfig.color}33` }]}>
            <MaterialCommunityIcons name={difficultyConfig.icon} size={14} color={difficultyConfig.color} />
            <Text style={[styles.difficultyText, { color: difficultyConfig.color }]}>
              {difficultyConfig.label}
            </Text>
          </View>
        </Animatable.View>

        <View style={styles.content}>
          {/* Title */}
          <Animatable.View animation="fadeInUp" delay={100}>
            <Text style={styles.title}>{challenge.title}</Text>
          </Animatable.View>

          {/* Countdown Timer */}
          <Animatable.View animation="fadeInUp" delay={200} style={styles.timerCard}>
            <Text style={styles.timerLabel}>Time Remaining</Text>
            <View style={styles.timerRow}>
              <View style={styles.timerBlock}>
                <Text style={styles.timerValue}>{timeLeft.days}</Text>
                <Text style={styles.timerUnit}>Days</Text>
              </View>
              <Text style={styles.timerSeparator}>:</Text>
              <View style={styles.timerBlock}>
                <Text style={styles.timerValue}>{timeLeft.hours}</Text>
                <Text style={styles.timerUnit}>Hours</Text>
              </View>
              <Text style={styles.timerSeparator}>:</Text>
              <View style={styles.timerBlock}>
                <Text style={styles.timerValue}>{timeLeft.minutes}</Text>
                <Text style={styles.timerUnit}>Mins</Text>
              </View>
            </View>
          </Animatable.View>

          {/* Description */}
          <Animatable.View animation="fadeInUp" delay={300} style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{challenge.description}</Text>
          </Animatable.View>

          {/* Rules */}
          <Animatable.View animation="fadeInUp" delay={400} style={styles.section}>
            <Text style={styles.sectionTitle}>Rules</Text>
            {challenge.rules.map((rule, index) => (
              <View key={index} style={styles.ruleItem}>
                <View style={styles.ruleBullet}>
                  <Text style={styles.ruleBulletText}>{index + 1}</Text>
                </View>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </Animatable.View>

          {/* Progress (if joined) */}
          {isJoined && (
            <Animatable.View animation="fadeInUp" delay={500} style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Your Progress</Text>
                <Text style={styles.progressValue}>
                  {challenge.progress} / {challenge.goal}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <Animatable.View
                  animation="slideInLeft"
                  duration={800}
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%`, backgroundColor: difficultyConfig.color },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>{progressPercent.toFixed(0)}% Complete</Text>
            </Animatable.View>
          )}

          {/* Rewards */}
          <Animatable.View animation="fadeInUp" delay={600} style={styles.section}>
            <Text style={styles.sectionTitle}>Rewards</Text>
            <View style={styles.rewardsRow}>
              {challenge.rewards.sparks > 0 && (
                <View style={styles.rewardCard}>
                  <MaterialCommunityIcons name="lightning-bolt" size={28} color="#FFD700" />
                  <Text style={styles.rewardValue}>{challenge.rewards.sparks}</Text>
                  <Text style={styles.rewardLabel}>Sparks</Text>
                </View>
              )}
              {challenge.rewards.echoes > 0 && (
                <View style={styles.rewardCard}>
                  <Ionicons name="radio-outline" size={26} color="#00D9FF" />
                  <Text style={styles.rewardValue}>{challenge.rewards.echoes}</Text>
                  <Text style={styles.rewardLabel}>Echoes</Text>
                </View>
              )}
              {challenge.rewards.xp > 0 && (
                <View style={styles.rewardCard}>
                  <MaterialCommunityIcons name="star-four-points" size={28} color="#10B981" />
                  <Text style={styles.rewardValue}>{challenge.rewards.xp}</Text>
                  <Text style={styles.rewardLabel}>XP</Text>
                </View>
              )}
            </View>
          </Animatable.View>

          {/* Leaderboard */}
          <Animatable.View animation="fadeInUp" delay={700} style={styles.section}>
            <Text style={styles.sectionTitle}>Top Participants</Text>
            {challenge.leaderboard.map((participant, index) => (
              <View
                key={index}
                style={[
                  styles.leaderboardItem,
                  participant.isCurrentUser && styles.leaderboardItemCurrent,
                ]}
              >
                <View style={[styles.rankBadge, getRankStyle(participant.rank)]}>
                  <Text style={styles.rankText}>{participant.rank}</Text>
                </View>
                <View style={styles.participantAvatar}>
                  {participant.avatar ? (
                    <Image source={{ uri: participant.avatar }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={18} color="#888" />
                  )}
                </View>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {participant.name}
                    {participant.isCurrentUser && ' (You)'}
                  </Text>
                  <Text style={styles.participantProgress}>
                    {participant.progress}/{challenge.goal} completed
                  </Text>
                </View>
                <Text style={styles.participantScore}>{participant.score} pts</Text>
              </View>
            ))}
          </Animatable.View>

          {/* Participants count */}
          <View style={styles.participantsInfo}>
            <Ionicons name="people" size={18} color="#888" />
            <Text style={styles.participantsText}>
              {challenge.participantCount.toLocaleString()} participants
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Join/Leave CTA */}
      <Animatable.View animation="fadeInUp" delay={800} style={styles.ctaContainer}>
        <TouchableOpacity
          style={[
            styles.ctaButton,
            isJoined ? styles.ctaButtonLeave : { backgroundColor: difficultyConfig.color },
          ]}
          onPress={handleJoinLeave}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={isJoined ? 'exit-to-app' : 'flag-plus'}
            size={22}
            color={isJoined ? '#EF4444' : '#FFF'}
          />
          <Text style={[styles.ctaButtonText, isJoined && styles.ctaButtonTextLeave]}>
            {isJoined ? 'Leave Challenge' : 'Join Challenge'}
          </Text>
        </TouchableOpacity>
      </Animatable.View>
    </SafeAreaView>
  );
};

const getRankStyle = (rank) => {
  switch (rank) {
    case 1: return { backgroundColor: '#FFD70033', borderColor: '#FFD700' };
    case 2: return { backgroundColor: '#C0C0C033', borderColor: '#C0C0C0' };
    case 3: return { backgroundColor: '#CD7F3233', borderColor: '#CD7F32' };
    default: return { backgroundColor: '#2A2A3E', borderColor: '#3A3A4E' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  shareButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: wp('4%'),
  },
  heroSection: {
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: hp('25%'),
    resizeMode: 'cover',
  },
  heroPlaceholder: {
    width: '100%',
    height: hp('20%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  difficultyBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: wp('3%'),
    fontWeight: '700',
    marginLeft: 4,
  },
  content: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('12%'),
  },
  title: {
    color: '#FFF',
    fontSize: wp('6%'),
    fontWeight: '800',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
  timerCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginVertical: hp('1.5%'),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  timerLabel: {
    color: '#888',
    fontSize: wp('3%'),
    marginBottom: hp('1%'),
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerBlock: {
    alignItems: 'center',
    minWidth: wp('15%'),
  },
  timerValue: {
    color: '#FFF',
    fontSize: wp('8%'),
    fontWeight: '800',
  },
  timerUnit: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  timerSeparator: {
    color: '#888',
    fontSize: wp('6%'),
    fontWeight: '700',
    marginHorizontal: wp('2%'),
  },
  section: {
    marginTop: hp('2.5%'),
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('1%'),
  },
  description: {
    color: '#888',
    fontSize: wp('3.5%'),
    lineHeight: 22,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp('1%'),
  },
  ruleBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2A2A3E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  ruleBulletText: {
    color: '#888',
    fontSize: wp('3%'),
    fontWeight: '700',
  },
  ruleText: {
    flex: 1,
    color: '#888',
    fontSize: wp('3.2%'),
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginTop: hp('2.5%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('1%'),
  },
  progressTitle: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  progressValue: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    color: '#888',
    fontSize: wp('3%'),
    textAlign: 'right',
    marginTop: 6,
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rewardCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  rewardValue: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '800',
    marginTop: 6,
  },
  rewardLabel: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    marginBottom: hp('1%'),
  },
  leaderboardItemCurrent: {
    borderWidth: 1,
    borderColor: '#00e89d44',
    backgroundColor: '#00e89d11',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  rankText: {
    color: '#FFF',
    fontSize: wp('3%'),
    fontWeight: '700',
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A3E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  participantInfo: {
    flex: 1,
    marginLeft: 10,
  },
  participantName: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  participantProgress: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  participantScore: {
    color: '#FFD700',
    fontSize: wp('3.5%'),
    fontWeight: '700',
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('2%'),
  },
  participantsText: {
    color: '#888',
    fontSize: wp('3%'),
    marginLeft: 6,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: wp('4%'),
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
  },
  ctaButtonLeave: {
    backgroundColor: '#EF444422',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  ctaButtonText: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 8,
  },
  ctaButtonTextLeave: {
    color: '#EF4444',
  },
});

export default ChallengeDetailScreen;
