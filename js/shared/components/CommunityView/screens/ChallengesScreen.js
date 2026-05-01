import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

import { challengesApi } from '../../../services/socialApi';
import { ChallengeCard, SeasonBanner, SkeletonLoader } from '../components/Gamification';
import ContextBridge from '../components/ContextBridge';

const TABS = ['Active', 'Upcoming', 'Completed'];

const ChallengesScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSeasonBanner, setShowSeasonBanner] = useState(true);
  const [challenges, setChallenges] = useState({ active: [], upcoming: [], completed: [] });

  const encounterCtx = null;
  const expCtx = null;

  const completedThisWeek = challenges.completed?.length || 0;
  const totalThisWeek = (challenges.active?.length || 0) + completedThisWeek;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [activeRes, upcomingRes, completedRes] = await Promise.all([
        challengesApi.list({ status: 'active' }).catch(() => ({ data: [] })),
        challengesApi.list({ status: 'upcoming' }).catch(() => ({ data: [] })),
        challengesApi.list({ status: 'completed' }).catch(() => ({ data: [] })),
      ]);
      setChallenges({
        active: activeRes.data || [],
        upcoming: upcomingRes.data || [],
        completed: completedRes.data || [],
      });
    } catch (e) { /* keep empty */ }
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

  const getChallengesForTab = () => {
    switch (activeTab) {
      case 0: return challenges.active;
      case 1: return challenges.upcoming;
      case 2: return challenges.completed;
      default: return [];
    }
  };

  const handleChallengePress = (challenge) => {
    navigation.navigate('ChallengeDetail', { challengeId: challenge.id });
  };

  const renderHeader = () => (
    <>
      {/* Season Banner */}
      {showSeasonBanner && (
        <SeasonBanner
          seasonName="Winter Season 2024"
          daysRemaining={45}
          currentTier="silver"
          tierProgress={65}
          rewards={[
            { icon: 'crown', color: '#FFD700' },
            { icon: 'trophy', color: '#C0C0C0' },
            { icon: 'star', color: '#CD7F32' },
          ]}
          onPress={() => navigation.navigate('Season')}
          onDismiss={() => setShowSeasonBanner(false)}
          loading={loading}
        />
      )}

      {/* Progress Summary */}
      <Animatable.View animation="fadeInUp" delay={100} style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <MaterialCommunityIcons name="flag-checkered" size={24} color="#00e89d" />
          <Text style={styles.progressTitle}>This Week's Progress</Text>
        </View>
        <View style={styles.progressStats}>
          <View style={styles.progressStatItem}>
            <Text style={styles.progressStatValue}>{completedThisWeek}</Text>
            <Text style={styles.progressStatLabel}>Completed</Text>
          </View>
          <View style={styles.progressDivider} />
          <View style={styles.progressStatItem}>
            <Text style={styles.progressStatValue}>{totalThisWeek - completedThisWeek}</Text>
            <Text style={styles.progressStatLabel}>In Progress</Text>
          </View>
          <View style={styles.progressDivider} />
          <View style={styles.progressStatItem}>
            <Text style={styles.progressStatValue}>{Math.round((completedThisWeek / totalThisWeek) * 100)}%</Text>
            <Text style={styles.progressStatLabel}>Rate</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <Animatable.View
            animation="slideInLeft"
            duration={800}
            style={[styles.progressFill, { width: `${(completedThisWeek / totalThisWeek) * 100}%` }]}
          />
        </View>
      </Animatable.View>

      {/* Context bridges */}
      <View style={styles.bridgeRow}>
        {encounterCtx?.nearbyCount > 0 && (
          <ContextBridge
            variant="chip"
            targetScreen="Encounters"
            icon="people"
            iconType="material"
            color="#00e89d"
            title={`${encounterCtx.nearbyCount} nearby`}
          />
        )}
        {expCtx?.userTopIntent && (
          <ContextBridge
            variant="chip"
            targetScreen="ExperimentDiscovery"
            icon="flask"
            iconType="community"
            color="#7C4DFF"
            title={`${expCtx.userTopIntent}`}
          />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === index && styles.tabActive]}
            onPress={() => setActiveTab(index)}
          >
            <Text style={[styles.tabText, activeTab === index && styles.tabTextActive]}>
              {tab}
            </Text>
            {index === 0 && challenges.active.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{challenges.active.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const renderChallengeItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 100}>
      <ChallengeCard
        title={item.title}
        description={item.description}
        difficulty={item.difficulty}
        endTime={item.endTime}
        progress={item.progress}
        maxProgress={item.maxProgress}
        participantCount={item.participantCount}
        rewards={item.rewards}
        onPress={() => handleChallengePress(item)}
        loading={loading}
      />
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenges</Text>
        <TouchableOpacity
          style={styles.seasonButton}
          onPress={() => navigation.navigate('Season')}
        >
          <MaterialCommunityIcons name="trophy-variant" size={22} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={getChallengesForTab()}
        keyExtractor={(item) => item.id}
        renderItem={renderChallengeItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="flag-outline" size={48} color="#555" />
            <Text style={styles.emptyText}>
              {activeTab === 1 ? 'No upcoming challenges' : 'No challenges found'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00e89d"
            colors={['#00e89d']}
          />
        }
      />
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
  seasonButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: hp('10%'),
  },
  progressCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginHorizontal: wp('3%'),
    marginTop: hp('1%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  progressTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 10,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: hp('1.5%'),
  },
  progressStatItem: {
    alignItems: 'center',
  },
  progressStatValue: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '800',
  },
  progressStatLabel: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  progressDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#3A3A4E',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00e89d',
    borderRadius: 3,
  },
  bridgeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: wp('4%'),
    marginBottom: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: wp('3%'),
    marginBottom: hp('1%'),
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.2%'),
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  tabActive: {
    backgroundColor: '#00e89d22',
    borderColor: '#00e89d',
  },
  tabText: {
    color: '#888',
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00e89d',
  },
  tabBadge: {
    backgroundColor: '#00e89d',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeText: {
    color: '#121212',
    fontSize: wp('2.5%'),
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: hp('10%'),
  },
  emptyText: {
    color: '#888',
    fontSize: wp('3.5%'),
    marginTop: hp('2%'),
  },
});

export default ChallengesScreen;
