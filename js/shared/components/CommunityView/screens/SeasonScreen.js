import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StatusBar,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  // Optional "between-seasons" data — both endpoints are best-effort.  If the
  // server hasn't shipped them yet the catch keeps the state null and the
  // sections render nothing.  Verified safe with /seasons/upcoming returning
  // 404 against staging on 2026-06-20.
  const [upcoming, setUpcoming] = useState(null);
  const [pastSeason, setPastSeason] = useState(null);
  const [infoVisible, setInfoVisible] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await seasonsApi.current();
      if (res.data) setSeason(res.data);
    } catch (e) { /* keep null */ }
    // Best-effort: hide silently if either endpoint isn't live yet.
    try {
      const res = await seasonsApi.upcoming();
      if (res && res.data) setUpcoming(res.data);
    } catch (e) { /* hide section */ }
    try {
      const res = await seasonsApi.past();
      if (res && res.data) setPastSeason(res.data);
    } catch (e) { /* hide section */ }
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
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
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

  // No active season — empty-state UI rather than crashing on `season.currentTier`.
  // Fires when seasonsApi.current() returns 200 with no body, or 404, or any
  // network failure (catch keeps `season` at null).  Verified live 2026-06-02
  // on Galaxy S23 Ultra — without this guard the screen crashed with
  // "Cannot read property 'currentTier' of null".
  if (!season) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Season</Text>
          <TouchableOpacity style={styles.infoButton} onPress={() => setInfoVisible(true)}>
            <Ionicons name="information-circle-outline" size={22} color="#888" />
          </TouchableOpacity>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
          }
          contentContainerStyle={{ paddingHorizontal: wp('4%'), paddingTop: hp('1%'), paddingBottom: hp('5%') }}
        >
          {/* Hero — between seasons */}
          <View style={styles.betweenHero}>
            <MaterialCommunityIcons name="snowflake" size={48} color="#9D4EDD" />
            <Text style={styles.betweenTitle}>No active season</Text>
            <Text style={styles.betweenSubtitle}>
              Seasons unlock with community milestones. Here's what's coming.
            </Text>
            {upcoming && typeof upcoming.daysUntilStart === 'number' && (
              <View style={styles.countdownPill}>
                <MaterialCommunityIcons name="timer-sand" size={14} color="#9D4EDD" />
                <Text style={styles.countdownText}>
                  Next season starts in {upcoming.daysUntilStart} {upcoming.daysUntilStart === 1 ? 'day' : 'days'}
                </Text>
              </View>
            )}
          </View>

          {/* How seasons work */}
          <View style={styles.explainerCard}>
            <Text style={styles.explainerTitle}>How Seasons Work</Text>
            {[
              { icon: 'star-four-points', text: 'Earn Season Points by completing challenges and engaging with your community.' },
              { icon: 'chevron-triple-up', text: 'Climb through four tiers — Bronze, Silver, Gold, and Platinum.' },
              { icon: 'gift-outline', text: 'Each tier unlocks exclusive rewards, badges, and profile cosmetics.' },
            ].map((item, i) => (
              <View key={i} style={styles.explainerRow}>
                <MaterialCommunityIcons name={item.icon} size={18} color="#9D4EDD" style={{ marginTop: 2 }} />
                <Text style={styles.explainerText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Tier ladder preview */}
          <Text style={[styles.sectionTitle, { marginTop: hp('2%') }]}>Tier Rewards Preview</Text>
          <View style={styles.tierRewardsContainer}>
            {TIERS.map((tier) => {
              const config = TIER_CONFIG[tier];
              return (
                <View
                  key={tier}
                  style={[styles.tierRewardCard, { borderColor: config.color }]}
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
                </View>
              );
            })}
          </View>

          {/* Last season recap — only render if server returned data */}
          {pastSeason && pastSeason.name && (
            <View style={{ marginTop: hp('2%') }}>
              <Text style={styles.sectionTitle}>Last Season</Text>
              <View style={styles.recapCard}>
                <Text style={styles.recapName}>{pastSeason.name}</Text>
                {pastSeason.theme ? (
                  <Text style={styles.recapTheme}>{pastSeason.theme}</Text>
                ) : null}
                {typeof pastSeason.finalTier === 'string' && TIER_CONFIG[pastSeason.finalTier] ? (
                  <View style={styles.recapTierRow}>
                    <MaterialCommunityIcons
                      name={TIER_CONFIG[pastSeason.finalTier].icon}
                      size={20}
                      color={TIER_CONFIG[pastSeason.finalTier].color}
                    />
                    <Text style={[styles.recapTierText, { color: TIER_CONFIG[pastSeason.finalTier].color }]}>
                      Your finish: {pastSeason.finalTier.charAt(0).toUpperCase() + pastSeason.finalTier.slice(1)}
                    </Text>
                  </View>
                ) : null}
                {typeof pastSeason.finalPoints === 'number' ? (
                  <Text style={styles.recapPoints}>
                    {pastSeason.finalPoints.toLocaleString()} season points earned
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Info modal — same explainer copy, also reachable from the active-season header */}
        <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setInfoVisible(false)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
              <Text style={styles.modalTitle}>How Seasons Work</Text>
              <Text style={styles.modalBody}>
                • Earn Season Points by completing challenges and engaging with your community.{'\n\n'}
                • Climb through four tiers — Bronze, Silver, Gold, and Platinum.{'\n\n'}
                • Each tier unlocks exclusive rewards, badges, and profile cosmetics.
              </Text>
              <TouchableOpacity style={styles.modalButton} onPress={() => setInfoVisible(false)}>
                <Text style={styles.modalButtonText}>Got it</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
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
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Season</Text>
        <TouchableOpacity style={styles.infoButton} onPress={() => setInfoVisible(true)}>
          <Ionicons name="information-circle-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Same explainer modal also reachable from the empty state. */}
      <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
            <Text style={styles.modalTitle}>How Seasons Work</Text>
            <Text style={styles.modalBody}>
              • Earn Season Points by completing challenges and engaging with your community.{'\n\n'}
              • Climb through four tiers — Bronze, Silver, Gold, and Platinum.{'\n\n'}
              • Each tier unlocks exclusive rewards, badges, and profile cosmetics.
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setInfoVisible(false)}>
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
      >
        {/* Season Banner */}
        <View style={styles.bannerContainer}>
          <View style={[styles.banner, { backgroundColor: '#1E1E2E' }]}>
            <View style={styles.bannerOverlay}>
              <MaterialCommunityIcons name="snowflake" size={80} color="#9D4EDD33" style={styles.bannerIcon} />
            </View>
            <View style={styles.bannerContent}>
              <View style={styles.seasonBadge}>
                <MaterialCommunityIcons name="snowflake" size={14} color="#9D4EDD" />
                <Text style={styles.seasonBadgeText}>SEASON</Text>
              </View>
              <Text style={styles.seasonName} numberOfLines={1}>{season.name}</Text>
              <Text style={styles.seasonTheme} numberOfLines={1}>{season.theme}</Text>
              <View style={styles.daysRemaining}>
                <View style={styles.daysBox}>
                  <Text style={styles.daysNumber}>{season.daysRemaining}</Text>
                  <Text style={styles.daysLabel}>days remaining</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Tier Progress */}
        <View style={styles.tierSection}>
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
                <View
                  key={tier}
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
                </View>
              );
            })}
          </View>
        </View>

        {/* My Progress Card */}
        <View style={styles.section}>
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
                  <View
                    style={[
                      styles.myProgressFill,
                      { width: `${progressToNext}%`, backgroundColor: nextTierConfig.color },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Season Leaderboard */}
        <View style={styles.section}>
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
                    <Image
                      source={{ uri: user.avatar }}
                      style={styles.avatarImage}
                      onError={() => {
                        // #417 fix: swallow Image errors so a stale avatar
                        // URL doesn't surface a red-screen via the RCTImage
                        // bridge.  Fallback icon kicks in next render if the
                        // caller refetches user.avatar = null.
                      }}
                    />
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
        </View>

        {/* Season Achievements */}
        <View style={styles.section}>
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
        </View>

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
    backgroundColor: '#000000',
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
    color: '#6C63FF',
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  tierProgressCard: {
    backgroundColor: '#141225',
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
    backgroundColor: '#141225',
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
    backgroundColor: '#141225',
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
    backgroundColor: '#141225',
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
  // Between-seasons UI.  Renders only when seasonsApi.current() returns no
  // active season — replaces the previous two-line "Check back later" stub
  // with a real schedule preview, tier ladder, and recap.  Closes the
  // "seasons-schedule" gap (2026-06-20).
  betweenHero: {
    alignItems: 'center',
    paddingVertical: hp('3%'),
  },
  betweenTitle: {
    color: '#FFF',
    fontSize: wp('5.5%'),
    fontWeight: '700',
    marginTop: hp('1%'),
  },
  betweenSubtitle: {
    color: '#9CA3AF',
    fontSize: wp('3.4%'),
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: wp('6%'),
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9D4EDD22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: hp('1.5%'),
  },
  countdownText: {
    color: '#9D4EDD',
    fontSize: wp('3.2%'),
    fontWeight: '600',
    marginLeft: 6,
  },
  explainerCard: {
    backgroundColor: '#141225',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: wp('4%'),
  },
  explainerTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('1%'),
  },
  explainerRow: {
    flexDirection: 'row',
    marginTop: hp('1%'),
    paddingRight: wp('2%'),
  },
  explainerText: {
    color: '#9CA3AF',
    fontSize: wp('3.2%'),
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  recapCard: {
    backgroundColor: '#141225',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: wp('4%'),
  },
  recapName: {
    color: '#FFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
  },
  recapTheme: {
    color: '#9D4EDD',
    fontSize: wp('3.4%'),
    marginTop: 2,
  },
  recapTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1.2%'),
  },
  recapTierText: {
    fontSize: wp('3.4%'),
    fontWeight: '600',
    marginLeft: 6,
  },
  recapPoints: {
    color: '#FFD700',
    fontSize: wp('3.2%'),
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('6%'),
  },
  modalCard: {
    backgroundColor: '#141225',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: wp('5%'),
    width: '100%',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
  },
  modalBody: {
    color: '#9CA3AF',
    fontSize: wp('3.4%'),
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#9D4EDD',
    borderRadius: 12,
    paddingVertical: hp('1.5%'),
    alignItems: 'center',
    marginTop: hp('2%'),
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: wp('3.6%'),
    fontWeight: '700',
  },
});

export default SeasonScreen;
