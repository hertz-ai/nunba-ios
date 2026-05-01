import React, { useState, useCallback, useEffect } from 'react';
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

import { resonanceApi } from '../../../services/socialApi';
import {
  ResonanceWallet,
  SkeletonLoader,
  TierProgressBar,
} from '../components/Gamification';
import ContextBridge from '../components/ContextBridge';

const TABS = ['Overview', 'History', 'Leaderboard'];

const TransactionItem = ({ item, index }) => {
  const isEarn = item.type === 'earn';
  const currencyIcons = {
    spark: { icon: 'lightning-bolt', color: '#FFD700' },
    pulse: { icon: 'heart-pulse', color: '#EF4444' },
    signal: { icon: 'broadcast', color: '#8B5CF6' },
    xp: { icon: 'star-four-points', color: '#10B981' },
  };
  const currencyConfig = currencyIcons[item.currency] || currencyIcons.spark;

  return (
    <Animatable.View
      animation="fadeInUp"
      delay={index * 50}
      style={styles.transactionItem}
    >
      <View style={[styles.transactionIcon, { backgroundColor: `${currencyConfig.color}22` }]}>
        <MaterialCommunityIcons
          name={currencyConfig.icon}
          size={20}
          color={currencyConfig.color}
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionDesc}>{item.description}</Text>
        <Text style={styles.transactionDate}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>
      <Text style={[styles.transactionAmount, { color: isEarn ? '#10B981' : '#EF4444' }]}>
        {isEarn ? '+' : '-'}{item.amount}
      </Text>
    </Animatable.View>
  );
};

const LeaderboardItem = ({ item, index, isCurrentUser }) => {
  const getRankStyle = (rank) => {
    switch (rank) {
      case 1: return { bg: '#FFD70022', color: '#FFD700', icon: 'crown' };
      case 2: return { bg: '#C0C0C022', color: '#C0C0C0', icon: 'medal' };
      case 3: return { bg: '#CD7F3222', color: '#CD7F32', icon: 'medal' };
      default: return { bg: '#2A2A3E', color: '#888', icon: null };
    }
  };
  const rankStyle = getRankStyle(item.rank);

  return (
    <Animatable.View
      animation="fadeInRight"
      delay={index * 30}
      style={[
        styles.leaderboardItem,
        isCurrentUser && styles.leaderboardItemCurrent,
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: rankStyle.bg }]}>
        {rankStyle.icon ? (
          <MaterialCommunityIcons name={rankStyle.icon} size={16} color={rankStyle.color} />
        ) : (
          <Text style={[styles.rankText, { color: rankStyle.color }]}>{item.rank}</Text>
        )}
      </View>
      <View style={styles.leaderboardAvatar}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={20} color="#888" />
        )}
      </View>
      <View style={styles.leaderboardInfo}>
        <Text style={styles.leaderboardName}>{item.name}</Text>
        <Text style={styles.leaderboardLevel}>Level {item.level}</Text>
      </View>
      <View style={styles.leaderboardCurrency}>
        <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFD700" />
        <Text style={styles.leaderboardAmount}>{item.currency.toLocaleString()}</Text>
      </View>
    </Animatable.View>
  );
};

const ResonanceDashboardScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const achCtx = null;
  const chalCtx = null;
  const [transactions, setTransactions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [streak, setStreak] = useState(null);

  const [userData, setUserData] = useState({
    level: 0,
    currentXP: 0,
    xpToNextLevel: 1,
    streakDays: 0,
    balances: { pulse: 0, spark: 0, signal: 0, xp: 0 },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [walletRes, txRes, lbRes, streakRes] = await Promise.all([
        resonanceApi.getWallet().catch(() => ({})),
        resonanceApi.getTransactions({ limit: 20 }).catch(() => ({ data: [] })),
        resonanceApi.getLeaderboard({ limit: 20 }).catch(() => ({ data: [] })),
        resonanceApi.getStreak().catch(() => ({})),
      ]);
      if (walletRes.data) setUserData(prev => ({ ...prev, ...walletRes.data }));
      setTransactions(txRes.data || []);
      setLeaderboard(lbRes.data || []);
      if (streakRes.data) setStreak(streakRes.data);
    } catch (e) { /* keep existing data */ }
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

  const handleDailyCheckin = async () => {
    if (!hasCheckedIn) {
      try {
        await resonanceApi.dailyCheckin();
        setHasCheckedIn(true);
        fetchData();
      } catch (e) { /* ignore */ }
    }
  };

  const renderOverviewTab = () => (
    <Animatable.View animation="fadeIn" style={styles.tabContent}>
      {/* Level Progress Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Your Progress</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>LVL {userData.level}</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <Animatable.View
            animation="slideInLeft"
            duration={800}
            style={[styles.progressFill, { width: `${(userData.currentXP / userData.xpToNextLevel) * 100}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          {userData.currentXP.toLocaleString()} / {userData.xpToNextLevel.toLocaleString()} XP to Level {userData.level + 1}
        </Text>
      </View>

      {/* Streak Info */}
      <View style={styles.card}>
        <View style={styles.streakRow}>
          <View style={styles.streakIcon}>
            <MaterialCommunityIcons name="fire" size={28} color="#FF6B35" />
          </View>
          <View style={styles.streakInfo}>
            <Text style={styles.streakDays}>{userData.streakDays} Day Streak</Text>
            <Text style={styles.streakSubtext}>Keep it going!</Text>
          </View>
          <View style={styles.streakBonus}>
            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFD700" />
            <Text style={styles.streakBonusText}>+{userData.streakDays * 10}</Text>
          </View>
        </View>
      </View>

      {/* Daily Check-in Button */}
      <TouchableOpacity
        style={[styles.checkinButton, hasCheckedIn && styles.checkinButtonDisabled]}
        onPress={handleDailyCheckin}
        disabled={hasCheckedIn}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name={hasCheckedIn ? 'check-circle' : 'calendar-check'}
          size={24}
          color={hasCheckedIn ? '#10B981' : '#121212'}
        />
        <Text style={[styles.checkinButtonText, hasCheckedIn && styles.checkinButtonTextDone]}>
          {hasCheckedIn ? 'Checked In Today!' : 'Daily Check-in (+50 Sparks)'}
        </Text>
      </TouchableOpacity>

      {/* Quick Stats — live context bridges */}
      <View style={styles.quickStats}>
        <ContextBridge
          variant="chip"
          targetScreen="Achievements"
          icon="trophy"
          iconType="ion"
          color="#FFD700"
          title={`${achCtx?.unlockedCount || 0} Achieved`}
        />
        <ContextBridge
          variant="chip"
          targetScreen="Challenges"
          icon="flag-checkered"
          iconType="community"
          color="#00D9FF"
          title={`${chalCtx?.activeCount || 0} Active`}
        />
        <ContextBridge
          variant="chip"
          targetScreen="Regions"
          icon="earth"
          iconType="community"
          color="#9D4EDD"
          title="Regions"
        />
      </View>
    </Animatable.View>
  );

  const renderHistoryTab = () => (
    <View style={styles.tabContent}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <TransactionItem item={item} index={index} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No transactions yet</Text>
        }
      />
    </View>
  );

  const renderLeaderboardTab = () => (
    <View style={styles.tabContent}>
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.userId}
        renderItem={({ item, index }) => (
          <LeaderboardItem item={item} index={index} isCurrentUser={item.rank === 4} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.leaderboardTitle}>Top 50 This Week</Text>
        }
      />
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 0: return renderOverviewTab();
      case 1: return renderHistoryTab();
      case 2: return renderLeaderboardTab();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resonance</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00e89d"
            colors={['#00e89d']}
          />
        }
      >
        {/* Resonance Wallet */}
        {loading ? (
          <View style={styles.walletSkeleton}>
            <SkeletonLoader variant="wallet" />
          </View>
        ) : (
          <Animatable.View animation="fadeInUp" duration={600}>
            <ResonanceWallet
              balances={userData.balances}
              level={userData.level}
              currentXP={userData.currentXP}
              xpToNextLevel={userData.xpToNextLevel}
              onCurrencyPress={(id) => console.log('Currency pressed:', id)}
              onLevelPress={() => navigation.navigate('Achievements')}
            />
          </Animatable.View>
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === index && styles.tabActive]}
              onPress={() => setActiveTab(index)}
            >
              <Text style={[styles.tabText, activeTab === index && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  );
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
  settingsButton: {
    padding: 4,
  },
  walletSkeleton: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: wp('4%'),
    marginTop: hp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: hp('1.5%'),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#00e89d',
  },
  tabText: {
    color: '#888',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00e89d',
  },
  tabContent: {
    paddingHorizontal: wp('4%'),
    paddingTop: hp('2%'),
    paddingBottom: hp('10%'),
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginBottom: hp('1.5%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  cardTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  levelBadge: {
    backgroundColor: '#00e89d',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: 12,
  },
  levelText: {
    color: '#121212',
    fontSize: wp('3%'),
    fontWeight: '800',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00e89d',
    borderRadius: 4,
  },
  progressText: {
    color: '#888',
    fontSize: wp('3%'),
    marginTop: hp('1%'),
    textAlign: 'right',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B3522',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakInfo: {
    flex: 1,
    marginLeft: wp('3%'),
  },
  streakDays: {
    color: '#FFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
  },
  streakSubtext: {
    color: '#888',
    fontSize: wp('3%'),
  },
  streakBonus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70022',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.6%'),
    borderRadius: 12,
  },
  streakBonusText: {
    color: '#FFD700',
    fontSize: wp('3.2%'),
    fontWeight: '700',
    marginLeft: 4,
  },
  checkinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00e89d',
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
    marginBottom: hp('2%'),
  },
  checkinButtonDisabled: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  checkinButtonText: {
    color: '#121212',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 8,
  },
  checkinButtonTextDone: {
    color: '#10B981',
  },
  quickStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statValue: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '800',
    marginTop: hp('0.5%'),
  },
  statLabel: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  listContent: {
    paddingBottom: hp('5%'),
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    marginBottom: hp('1%'),
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionDesc: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  transactionDate: {
    color: '#666',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  leaderboardTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
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
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: wp('3.5%'),
    fontWeight: '700',
  },
  leaderboardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A3E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  leaderboardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  leaderboardName: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  leaderboardLevel: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  leaderboardCurrency: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderboardAmount: {
    color: '#FFD700',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    marginLeft: 4,
  },
  emptyText: {
    color: '#888',
    fontSize: wp('3.5%'),
    textAlign: 'center',
    marginTop: hp('5%'),
  },
});

export default ResonanceDashboardScreen;
