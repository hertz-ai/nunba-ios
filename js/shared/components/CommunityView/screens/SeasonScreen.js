import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

import { seasonsApi } from '../../../services/socialApi';
import { TierProgressBar, SkeletonLoader, AchievementCard } from '../components/Gamification';

const TIER_CONFIG = {
  bronze: { color: '#CD7F32', icon: 'medal', threshold: 0, rewards: ['50 Sparks', 'Bronze Badge'] },
  silver: { color: '#C0C0C0', icon: 'medal', threshold: 1000, rewards: ['200 Sparks', 'Silver Badge', 'Profile Frame'] },
  gold: { color: '#FFD700', icon: 'medal', threshold: 5000, rewards: ['500 Sparks', 'Gold Badge', 'Exclusive Emoji Pack'] },
  platinum: { color: '#E5E4E2', icon: 'crown', threshold: 15000, rewards: ['1500 Sparks', 'Platinum Badge', 'Legendary Title', 'Custom Theme'] },
};

const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

const SeasonScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [season, setSeason] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await seasonsApi.current();
      if (res.data) setSeason(res.data);
    } catch (e) { /* keep null */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Season</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <SkeletonLoader width={wp('92%')} height={hp('20%')} borderRadius={16} />
          <SkeletonLoader width={wp('92%')} height={hp('15%')} borderRadius={16} style={{ marginTop: hp('2%') }} />
        </View>
      </SafeAreaView>
    );
  }

  const currentTierIndex = TIERS.indexOf(season.currentTier);
  const currentTierConfig = TIER_CONFIG[season.currentTier];
  const nextTier = currentTierIndex < TIERS.length - 1 ? TIERS[currentTierIndex + 1] : null;
  const nextTierConfig = nextTier ? TIER_CONFIG[nextTier] : null;
  const progressToNext = nextTier
    ? ((season.currentPoints - currentTierConfig.threshold) / (nextTierConfig.threshold - currentTierConfig.threshold)) * 100
    : 100;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Season</Text>
        <TouchableOpacity style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
        }
      >
        {/* Season Banner */}
        <Animatable.View animation="fadeIn" style={styles.bannerContainer}>
          <View style={[styles.banner, { backgroundColor: '#1E1E2E' }]}>
            <View style={styles.bannerOverlay}>
              <MaterialCommunityIcons name="snowflake" size={80} color="#9D4EDD33" style={styles.bannerIcon} />
            </View>
            <View style={styles.bannerContent}>
              <View style={styles.seasonBadge}>
                <MaterialCommunityIcons name="snowflake" size={14} color="#9D4EDD" />
                <Text style={styles.seasonBadgeText}>SEASON</Text>
              </View>
              <Text style={styles.seasonName}>{season.name}</Text>
              <Text style={styles.seasonTheme}>{season.theme}</Text>
              <View style={styles.daysRemaining}>
                <View style={styles.daysBox}>
                  <Text style={styles.daysNumber}>{season.daysRemaining}</Text>
                  <Text style={styles.daysLabel}>days remaining</Text>
                </View>
              </View>
            </View>
          </View>
        </Animatable.View>

        {/* Tier Progress */}
        <Animatable.View animation="fadeInUp" delay={100} style={styles.tierSection}>
          <Text style={styles.sectionTitle}>Season Tiers</Text>
          <View style={styles.tierProgressCard}>
            <TierProgressBar
              currentPoints={season.currentPoints}
              currentTier={season.currentTier}
              showLabels={true}
              showRewards={true}
              tierRewards={TIER_CONFIG}
            />
          </View>

          {/* Tier Rewards Preview */}
          <View style={styles.tierRewardsContainer}>
            {TIERS.map((tier, index) => {
              const config = TIER_CONFIG[tier];
              const isUnlocked = index <= currentTierIndex;
              return (
                <Animatable.View
                  key={tier}
                  animation="fadeInRight"
                  delay={index * 100}
                  style={[
                    styles.tierRewardCard,
                    isUnlocked && styles.tierRewardCardUnlocked,
                    { borderColor: config.color },
                  ]}
                >
                  <View style={[styles.tierRewardIcon, { backgroundColor: `${config.color}22` }]}>
                    <MaterialCommunityIcons name={config.icon} size={24} color={config.color} />
                  </View>
                  <Text style={[styles.tierRewardName, { color: config.color }]}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </Text>
                  <Text style={styles.tierRewardThreshold}>
                    {config.threshold.toLocaleString()} pts
                  </Text>
                  <View style={styles.tierRewardsList}>
                    {config.rewards.map((reward, i) => (
                      <Text key={i} style={styles.tierRewardItem}>
                        {reward}
                      </Text>
                    ))}
                  </View>
                  {isUnlocked && (
                    <View style={styles.unlockedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    </View>
                  )}
                </Animatable.View>
              );
            })}
          </View>
        </Animatable.View>

        {/* My Progress Card */}
        <Animatable.View animation="fadeInUp" delay={200} style={styles.section}>
          <Text style={styles.sectionTitle}>My Progress</Text>
          <View style={styles.myProgressCard}>
            <View style={styles.myProgressHeader}>
              <View style={[styles.currentTierBadge, { backgroundColor: `${currentTierConfig.color}22` }]}>
                <MaterialCommunityIcons name={currentTierConfig.icon} size={28} color={currentTierConfig.color} />
              </View>
              <View style={styles.myProgressInfo}>
                <Text style={[styles.myTierName, { color: currentTierConfig.color }]}>
                  {season.currentTier.charAt(0).toUpperCase() + season.currentTier.slice(1)} Tier
                </Text>
                <Text style={styles.myPointsText}>
                  {season.currentPoints.toLocaleString()} Season Points
                </Text>
              </View>
            </View>
            {nextTier && (
              <View style={styles.myProgressToNext}>
                <Text style={styles.nextTierLabel}>
                  {(nextTierConfig.threshold - season.currentPoints).toLocaleString()} pts to{' '}
                  <Text style={{ color: nextTierConfig.color }}>
                    {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}
                  </Text>
                </Text>
                <View style={styles.myProgressBar}>
                  <Animatable.View
                    animation="slideInLeft"
                    duration={800}
                    style={[
                      styles.myProgressFill,
                      { width: `${progressToNext}%`, backgroundColor: nextTierConfig.color },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        </Animatable.View>

        {/* Season Leaderboard */}
        <Animatable.View animation="fadeInUp" delay={300} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Season Leaderboard</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.leaderboardContainer}>
            {season.leaderboard.map((user, index) => (
              <View key={index} style={styles.leaderboardItem}>
                <View style={[styles.rankBadge, getRankStyle(user.rank)]}>
                  {user.rank <= 3 ? (
                    <MaterialCommunityIcons
                      name={user.rank === 1 ? 'crown' : 'medal'}
                      size={16}
                      color={user.rank === 1 ? '#FFD700' : user.rank === 2 ? '#C0C0C0' : '#CD7F32'}
                    />
                  ) : (
                    <Text style={styles.rankText}>{user.rank}</Text>
                  )}
                </View>
                <View style={styles.userAvatar}>
                  {user.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={18} color="#888" />
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={[styles.userTier, { color: TIER_CONFIG[user.tier].color }]}>
                    {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
                  </Text>
                </View>
                <Text style={styles.userPoints}>{user.points.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        </Animatable.View>

        {/* Season Achievements */}
        <Animatable.View animation="fadeInUp" delay={400} style={styles.section}>
          <Text style={styles.sectionTitle}>Season Achievements</Text>
          {season.achievements.map((achievement, index) => (
            <AchievementCard
              key={achievement.id}
              icon={achievement.icon}
              name={achievement.name}
              description={achievement.description}
              rarity="rare"
              isUnlocked={achievement.isUnlocked}
              progress={achievement.progress}
              maxProgress={achievement.maxProgress}
              onPress={() => {}}
            />
          ))}
        </Animatable.View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const getRankStyle = (rank) => {
  switch (rank) {
    case 1: return { backgroundColor: '#FFD70033' };
    case 2: return { backgroundColor: '#C0C0C033' };
    case 3: return { backgroundColor: '#CD7F3233' };
    default: return { backgroundColor: '#2A2A3E' };
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
  infoButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: wp('4%'),
  },
  bannerContainer: {
    paddingHorizontal: wp('4%'),
    marginBottom: hp('2%'),
  },
  banner: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerOverlay: {
    position: 'absolute',
    right: -20,
    top: -20,
  },
  bannerIcon: {
    opacity: 0.5,
  },
  bannerContent: {
    padding: wp('5%'),
  },
  seasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9D4EDD33',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: hp('1%'),
  },
  seasonBadgeText: {
    color: '#9D4EDD',
    fontSize: wp('2.8%'),
    fontWeight: '700',
    marginLeft: 4,
  },
  seasonName: {
    color: '#FFF',
    fontSize: wp('6%'),
    fontWeight: '800',
  },
  seasonTheme: {
    color: '#9D4EDD',
    fontSize: wp('4%'),
    fontWeight: '600',
    marginTop: 4,
  },
  daysRemaining: {
    marginTop: hp('2%'),
  },
  daysBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  daysNumber: {
    color: '#FFF',
    fontSize: wp('8%'),
    fontWeight: '800',
  },
  daysLabel: {
    color: '#888',
    fontSize: wp('3.5%'),
    marginLeft: 8,
  },
  tierSection: {
    paddingHorizontal: wp('4%'),
    marginBottom: hp('2%'),
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  viewAllText: {
    color: '#00e89d',
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  tierProgressCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  tierRewardsContainer: {
    flexDirection: 'row',
    marginTop: hp('1.5%'),
    gap: 10,
  },
  tierRewardCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('2.5%'),
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  tierRewardCardUnlocked: {
    backgroundColor: '#1E2E22',
  },
  tierRewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  tierRewardName: {
    fontSize: wp('3%'),
    fontWeight: '700',
  },
  tierRewardThreshold: {
    color: '#666',
    fontSize: wp('2.2%'),
    marginTop: 2,
  },
  tierRewardsList: {
    marginTop: 6,
  },
  tierRewardItem: {
    color: '#888',
    fontSize: wp('2%'),
    textAlign: 'center',
  },
  unlockedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  section: {
    paddingHorizontal: wp('4%'),
    marginBottom: hp('2%'),
  },
  myProgressCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  myProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTierBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myProgressInfo: {
    marginLeft: wp('4%'),
  },
  myTierName: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
  },
  myPointsText: {
    color: '#888',
    fontSize: wp('3.2%'),
    marginTop: 2,
  },
  myProgressToNext: {
    marginTop: hp('2%'),
  },
  nextTierLabel: {
    color: '#888',
    fontSize: wp('3%'),
    marginBottom: 8,
  },
  myProgressBar: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  myProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  leaderboardContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('3%'),
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#888',
    fontSize: wp('3%'),
    fontWeight: '700',
  },
  userAvatar: {
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
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  userTier: {
    fontSize: wp('2.8%'),
    fontWeight: '500',
  },
  userPoints: {
    color: '#FFD700',
    fontSize: wp('3.5%'),
    fontWeight: '700',
  },
  bottomSpacer: {
    height: hp('5%'),
  },
});

export default SeasonScreen;
