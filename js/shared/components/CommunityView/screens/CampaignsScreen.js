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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

import { campaignsApi } from '../../../services/socialApi';
import { CampaignCard, SkeletonLoader } from '../components/Gamification';

const TABS = ['My Campaigns', 'Browse', 'Templates'];

const TEMPLATES = [
  { id: 't1', name: 'Follower Growth', icon: 'account-plus', color: '#6C63FF', description: 'Optimized for gaining new followers' },
  { id: 't2', name: 'Content Boost', icon: 'trending-up', color: '#00D9FF', description: 'Maximize reach on your best content' },
  { id: 't3', name: 'Agent Promotion', icon: 'robot', color: '#9D4EDD', description: 'Showcase your AI agent\'s capabilities' },
  { id: 't4', name: 'Community Builder', icon: 'account-group', color: '#FF6B35', description: 'Grow your region or community' },
];

const CampaignsScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [browseCampaigns, setBrowseCampaigns] = useState([]);

  const totalImpressions = myCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalConversions = myCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [myRes, browseRes] = await Promise.all([
        campaignsApi.list({ created_by: 'me' }).catch(() => ({ data: [] })),
        campaignsApi.list({ trending: true, limit: 10 }).catch(() => ({ data: [] })),
      ]);
      setMyCampaigns(myRes.data || []);
      setBrowseCampaigns(browseRes.data || []);
    } catch (e) {}
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const handleCampaignPress = (campaign) => {
    navigation.navigate('CampaignDetail', { campaignId: campaign.id });
  };

  const handleCreateCampaign = () => {
    navigation.navigate('CampaignStudio');
  };

  const handleTemplatePress = (template) => {
    navigation.navigate('CampaignStudio', { templateId: template.id });
  };

  const renderHeader = () => (
    <>
      {/* Stats Summary */}
      {/* UX-AUDIT 2026-05-19 (BROKEN-B4): Animatable.View animations
          were stuck at opacity 0 on-device, hiding the entire stats
          card. Replaced with plain View so visibility is unconditional. */}
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <MaterialCommunityIcons name="chart-line" size={24} color="#6C63FF" />
          <Text style={styles.statsTitle}>Campaign Performance</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatCount(totalImpressions)}</Text>
            <Text style={styles.statLabel}>Total Impressions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalConversions}</Text>
            <Text style={styles.statLabel}>Conversions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{myCampaigns.filter(c => c.status === 'active').length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>
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
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const renderMyCampaigns = () => (
    <>
      {loading ? (
        [...Array(3)].map((_, i) => (
          <SkeletonLoader
            key={i}
            variant="card"
            style={{ marginHorizontal: wp('3%'), marginBottom: hp('1%') }}
          />
        ))
      ) : (
        myCampaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            title={campaign.title}
            status={campaign.status}
            impressions={campaign.impressions}
            clicks={campaign.clicks}
            conversions={campaign.conversions}
            budgetSpent={campaign.budgetSpent}
            totalBudget={campaign.totalBudget}
            onPress={() => handleCampaignPress(campaign)}
          />
        ))
      )}
    </>
  );

  const renderBrowse = () => (
    <>
      <Text style={styles.browseSectionTitle}>Successful Campaigns</Text>
      {browseCampaigns.length === 0 && !loading ? (
        <View style={styles.emptyStateInline}>
          <MaterialCommunityIcons name="rocket-outline" size={48} color="#555" />
          <Text style={styles.emptyStateTitle}>No trending campaigns yet</Text>
          <Text style={styles.emptyStateSubtitle}>Check back later or create your own.</Text>
        </View>
      ) : null}
      {browseCampaigns.map((campaign) => (
        <TouchableOpacity key={campaign.id} style={styles.browseCard} activeOpacity={0.8}>
          <View style={styles.browseIcon}>
            <MaterialCommunityIcons name="rocket-launch" size={24} color="#FFD700" />
          </View>
          <View style={styles.browseInfo}>
            <Text style={styles.browseTitle}>{campaign.title}</Text>
            <Text style={styles.browseCreator}>by {campaign.creator}</Text>
          </View>
          <View style={styles.browseStats}>
            <Text style={styles.browseImpressions}>{formatCount(campaign.impressions)}</Text>
            <Text style={styles.browseEngagement}>{campaign.engagement}% engage</Text>
          </View>
        </TouchableOpacity>
      ))}
    </>
  );

  const renderTemplates = () => (
    <>
      <Text style={styles.templatesSectionTitle}>Campaign Templates</Text>
      <View style={styles.templatesGrid}>
        {TEMPLATES.map((template) => (
          <TouchableOpacity
            key={template.id}
            style={[styles.templateCard, { borderColor: `${template.color}44` }]}
            onPress={() => handleTemplatePress(template)}
            activeOpacity={0.8}
          >
            <View style={[styles.templateIcon, { backgroundColor: `${template.color}22` }]}>
              <MaterialCommunityIcons name={template.icon} size={32} color={template.color} />
            </View>
            <Text style={styles.templateName}>{template.name}</Text>
            <Text style={styles.templateDesc}>{template.description}</Text>
            <TouchableOpacity style={[styles.templateUseButton, { backgroundColor: template.color }]}>
              <Text style={styles.templateUseText}>Use Template</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 0: return renderMyCampaigns();
      case 1: return renderBrowse();
      case 2: return renderTemplates();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campaigns</Text>
        <TouchableOpacity style={styles.analyticsButton}>
          <Ionicons name="analytics-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={[{ key: 'content' }]}
        keyExtractor={(item) => item.key}
        renderItem={() => (
          <View style={styles.contentContainer}>
            {renderTabContent()}
          </View>
        )}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
      />

      {/* Create Campaign FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateCampaign}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#000000" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const formatCount = (count) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
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
  analyticsButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: hp('12%'),
  },
  contentContainer: {
    paddingBottom: hp('2%'),
  },
  statsCard: {
    backgroundColor: '#141225',
    borderRadius: 16,
    padding: wp('4%'),
    marginHorizontal: wp('4%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  statsTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '800',
  },
  statLabel: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#3A3A4E',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: wp('4%'),
    marginBottom: hp('1.5%'),
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: hp('1%'),
    alignItems: 'center',
    backgroundColor: '#141225',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  tabActive: {
    backgroundColor: '#6C63FF22',
    borderColor: '#6C63FF',
  },
  tabText: {
    color: '#888',
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#6C63FF',
  },
  browseSectionTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginHorizontal: wp('4%'),
    marginBottom: hp('1%'),
  },
  emptyStateInline: {
    alignItems: 'center',
    paddingVertical: hp('6%'),
    paddingHorizontal: wp('8%'),
  },
  emptyStateTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginTop: hp('1.5%'),
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: '#888',
    fontSize: wp('3.3%'),
    marginTop: hp('0.5%'),
    textAlign: 'center',
  },
  browseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141225',
    borderRadius: 12,
    padding: wp('3%'),
    marginHorizontal: wp('3%'),
    marginBottom: hp('1%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  browseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFD70022',
    justifyContent: 'center',
    alignItems: 'center',
  },
  browseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  browseTitle: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  browseCreator: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  browseStats: {
    alignItems: 'flex-end',
  },
  browseImpressions: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '700',
  },
  browseEngagement: {
    color: '#6C63FF',
    fontSize: wp('2.5%'),
  },
  templatesSectionTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginHorizontal: wp('4%'),
    marginBottom: hp('1.5%'),
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: wp('3%'),
    gap: 10,
  },
  templateCard: {
    width: wp('44%'),
    backgroundColor: '#141225',
    borderRadius: 16,
    padding: wp('4%'),
    alignItems: 'center',
    borderWidth: 2,
  },
  templateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  templateName: {
    color: '#FFF',
    fontSize: wp('3.8%'),
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  templateDesc: {
    color: '#888',
    fontSize: wp('2.8%'),
    textAlign: 'center',
    marginBottom: 12,
  },
  templateUseButton: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 16,
  },
  templateUseText: {
    color: '#000000',
    fontSize: wp('3%'),
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: hp('3%'),
    right: wp('5%'),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default CampaignsScreen;
