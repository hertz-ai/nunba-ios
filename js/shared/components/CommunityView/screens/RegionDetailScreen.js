import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
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
import { useNavigation, useRoute } from '@react-navigation/native';

import { regionsApi } from '../../../services/socialApi';
import { ProposalCard, SkeletonLoader } from '../components/Gamification';

const TABS = ['Overview', 'Feed', 'Proposals', 'Council', 'Members'];

const TIER_CONFIG = {
  starter: { color: '#6B7280', icon: 'shield-outline' },
  established: { color: '#10B981', icon: 'shield-half-full' },
  thriving: { color: '#3B82F6', icon: 'shield-star' },
  legendary: { color: '#F59E0B', icon: 'shield-crown' },
};

const RegionDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { regionId } = route.params || {};

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [region, setRegion] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    if (regionId) fetchData();
  }, [regionId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [regionRes, govRes, membersRes] = await Promise.all([
        regionsApi.get(regionId).catch(() => ({})),
        regionsApi.governance(regionId).catch(() => ({ data: {} })),
        regionsApi.members(regionId, { limit: 50 }).catch(() => ({ data: [] })),
      ]);
      const data = regionRes.data || {};
      if (govRes.data) { data.proposals = govRes.data.proposals || []; data.council = govRes.data.council || []; }
      if (membersRes.data) { data.members = membersRes.data; }
      setRegion(data);
      setIsJoined(data.isJoined || false);
    } catch (e) {}
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [regionId]);

  const handleJoinLeave = async () => {
    try {
      if (isJoined) {
        await regionsApi.leave(regionId);
      } else {
        await regionsApi.join(regionId);
      }
      setIsJoined(!isJoined);
      fetchData();
    } catch (e) {}
  };

  if (loading || !region) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Region</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <SkeletonLoader width={wp('92%')} height={hp('15%')} borderRadius={16} />
          <SkeletonLoader width={wp('92%')} height={hp('10%')} borderRadius={16} style={{ marginTop: hp('2%') }} />
        </View>
      </SafeAreaView>
    );
  }

  const tierConfig = TIER_CONFIG[region.tier];

  const renderOverviewTab = () => (
    <Animatable.View animation="fadeIn" style={styles.tabContent}>
      {/* Description */}
      <View style={styles.descriptionCard}>
        <Text style={styles.descriptionTitle}>About</Text>
        <Text style={styles.descriptionText}>{region.description}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="account-group" size={24} color="#00e89d" />
          <Text style={styles.statValue}>{formatCount(region.memberCount)}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="file-document-multiple" size={24} color="#00D9FF" />
          <Text style={styles.statValue}>{formatCount(region.postCount)}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="vote" size={24} color="#9D4EDD" />
          <Text style={styles.statValue}>{region.proposalCount}</Text>
          <Text style={styles.statLabel}>Proposals</Text>
        </View>
      </View>

      {/* This Week Stats */}
      <View style={styles.weeklyCard}>
        <Text style={styles.weeklyTitle}>This Week</Text>
        <View style={styles.weeklyStats}>
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyValue}>{region.stats.postsThisWeek}</Text>
            <Text style={styles.weeklyLabel}>New Posts</Text>
          </View>
          <View style={styles.weeklyDivider} />
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyValue}>{formatCount(region.stats.activeMembers)}</Text>
            <Text style={styles.weeklyLabel}>Active</Text>
          </View>
          <View style={styles.weeklyDivider} />
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyValue}>{region.stats.proposals}</Text>
            <Text style={styles.weeklyLabel}>Proposals</Text>
          </View>
        </View>
      </View>
    </Animatable.View>
  );

  const renderFeedTab = () => (
    <Animatable.View animation="fadeIn" style={styles.tabContent}>
      <View style={styles.feedPlaceholder}>
        <MaterialCommunityIcons name="file-document-multiple-outline" size={48} color="#555" />
        <Text style={styles.feedPlaceholderText}>Region feed coming soon</Text>
        <Text style={styles.feedPlaceholderSubtext}>Posts from this region will appear here</Text>
      </View>
    </Animatable.View>
  );

  const renderProposalsTab = () => (
    <Animatable.View animation="fadeIn" style={styles.tabContent}>
      {region.proposals.map((proposal, index) => (
        <ProposalCard
          key={proposal.id}
          title={proposal.title}
          authorName={proposal.authorName}
          status={proposal.status}
          votesFor={proposal.votesFor}
          votesAgainst={proposal.votesAgainst}
          endTime={proposal.endTime}
          onPress={() => {}}
          onVoteFor={() => {}}
          onVoteAgainst={() => {}}
        />
      ))}
    </Animatable.View>
  );

  const renderCouncilTab = () => (
    <Animatable.View animation="fadeIn" style={styles.tabContent}>
      {region.council.map((member, index) => (
        <Animatable.View key={member.id} animation="fadeInUp" delay={index * 100}>
          <View style={styles.councilMember}>
            <View style={styles.councilAvatar}>
              {member.avatar ? (
                <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={20} color="#888" />
              )}
            </View>
            <View style={styles.councilInfo}>
              <Text style={styles.councilName}>{member.name}</Text>
              <Text style={[styles.councilRole, { color: getRoleColor(member.role) }]}>
                {member.role}
              </Text>
            </View>
            <TouchableOpacity style={styles.councilAction}>
              <Ionicons name="chatbubble-outline" size={20} color="#888" />
            </TouchableOpacity>
          </View>
        </Animatable.View>
      ))}
    </Animatable.View>
  );

  const renderMembersTab = () => (
    <Animatable.View animation="fadeIn" style={styles.tabContent}>
      <View style={styles.memberSearchContainer}>
        <Ionicons name="search" size={18} color="#888" />
        <TextInput
          style={styles.memberSearchInput}
          placeholder="Search members..."
          placeholderTextColor="#666"
          value={memberSearch}
          onChangeText={setMemberSearch}
        />
      </View>
      {region.members.map((member, index) => (
        <View key={member.id} style={styles.memberItem}>
          <View style={styles.memberAvatar}>
            {member.avatar ? (
              <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={18} color="#888" />
            )}
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberJoined}>Joined {new Date(member.joinedAt).toLocaleDateString()}</Text>
          </View>
          <TouchableOpacity style={styles.memberAction}>
            <Ionicons name="person-add-outline" size={18} color="#00e89d" />
          </TouchableOpacity>
        </View>
      ))}
    </Animatable.View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 0: return renderOverviewTab();
      case 1: return renderFeedTab();
      case 2: return renderProposalsTab();
      case 3: return renderCouncilTab();
      case 4: return renderMembersTab();
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
        <Text style={styles.headerTitle}>Region</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
        }
      >
        {/* Region Header */}
        <Animatable.View animation="fadeIn" style={styles.regionHeader}>
          <View style={[styles.regionBanner, { backgroundColor: `${tierConfig.color}22` }]}>
            <MaterialCommunityIcons name={region.flagIcon} size={64} color={tierConfig.color} />
          </View>
          <View style={styles.regionInfo}>
            <Text style={styles.regionName}>{region.name}</Text>
            <View style={styles.regionMeta}>
              <View style={[styles.tierBadge, { backgroundColor: `${tierConfig.color}33`, borderColor: tierConfig.color }]}>
                <MaterialCommunityIcons name={tierConfig.icon} size={14} color={tierConfig.color} />
                <Text style={[styles.tierText, { color: tierConfig.color }]}>
                  {region.tier.charAt(0).toUpperCase() + region.tier.slice(1)}
                </Text>
              </View>
              <View style={styles.memberCount}>
                <Ionicons name="people" size={14} color="#888" />
                <Text style={styles.memberCountText}>{formatCount(region.memberCount)} members</Text>
              </View>
            </View>
          </View>

          {/* Join/Leave Button */}
          <TouchableOpacity
            style={[styles.joinButton, isJoined && styles.joinedButton]}
            onPress={handleJoinLeave}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={isJoined ? 'check' : 'plus'}
              size={20}
              color={isJoined ? '#10B981' : '#FFF'}
            />
            <Text style={[styles.joinButtonText, isJoined && styles.joinedButtonText]}>
              {isJoined ? 'Joined' : 'Join'}
            </Text>
          </TouchableOpacity>
        </Animatable.View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}
        >
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
        </ScrollView>

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const formatCount = (count) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const getRoleColor = (role) => {
  switch (role) {
    case 'Founder': return '#FFD700';
    case 'Moderator': return '#00D9FF';
    default: return '#888';
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
  menuButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: wp('4%'),
  },
  regionHeader: {
    paddingHorizontal: wp('4%'),
    marginBottom: hp('2%'),
  },
  regionBanner: {
    height: hp('15%'),
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  regionInfo: {
    marginBottom: hp('1.5%'),
  },
  regionName: {
    color: '#FFF',
    fontSize: wp('6%'),
    fontWeight: '800',
    marginBottom: 8,
  },
  regionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
  },
  tierText: {
    fontSize: wp('2.8%'),
    fontWeight: '600',
    marginLeft: 4,
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCountText: {
    color: '#888',
    fontSize: wp('3%'),
    marginLeft: 4,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00e89d',
    paddingVertical: hp('1.2%'),
    borderRadius: 12,
  },
  joinedButton: {
    backgroundColor: '#10B98122',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  joinButtonText: {
    color: '#121212',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 6,
  },
  joinedButtonText: {
    color: '#10B981',
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  tabsContent: {
    paddingHorizontal: wp('4%'),
  },
  tab: {
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    marginRight: wp('2%'),
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
    padding: wp('4%'),
    paddingBottom: hp('10%'),
  },
  descriptionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  descriptionTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: 8,
  },
  descriptionText: {
    color: '#888',
    fontSize: wp('3.5%'),
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: hp('2%'),
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
    marginTop: 6,
  },
  statLabel: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  weeklyCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  weeklyTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
  },
  weeklyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weeklyStat: {
    alignItems: 'center',
  },
  weeklyValue: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '800',
  },
  weeklyLabel: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  weeklyDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#3A3A4E',
  },
  feedPlaceholder: {
    alignItems: 'center',
    paddingVertical: hp('10%'),
  },
  feedPlaceholderText: {
    color: '#888',
    fontSize: wp('4%'),
    fontWeight: '600',
    marginTop: hp('2%'),
  },
  feedPlaceholderSubtext: {
    color: '#666',
    fontSize: wp('3%'),
    marginTop: 4,
  },
  councilMember: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    marginBottom: hp('1%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  councilAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A2A3E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  councilInfo: {
    flex: 1,
    marginLeft: 12,
  },
  councilName: {
    color: '#FFF',
    fontSize: wp('3.8%'),
    fontWeight: '600',
  },
  councilRole: {
    fontSize: wp('3%'),
    marginTop: 2,
  },
  councilAction: {
    padding: 8,
  },
  memberSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1%'),
    marginBottom: hp('1.5%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  memberSearchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('3.5%'),
    marginLeft: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1%'),
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A3E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  memberJoined: {
    color: '#666',
    fontSize: wp('2.8%'),
  },
  memberAction: {
    padding: 8,
  },
});

export default RegionDetailScreen;
