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
  Dimensions,
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

import { campaignsApi, shareApi } from '../../../services/socialApi';
import { AnimatedCounter, SkeletonLoader } from '../components/Gamification';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_CONFIG = {
  active: { color: '#10B981', label: 'Active', icon: 'play-circle' },
  paused: { color: '#F59E0B', label: 'Paused', icon: 'pause-circle' },
  completed: { color: '#00D9FF', label: 'Completed', icon: 'check-circle' },
  ended: { color: '#888', label: 'Ended', icon: 'stop-circle' },
};

const CampaignDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { campaignId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [status, setStatus] = useState('active');

  useEffect(() => {
    if (campaignId) fetchData();
  }, [campaignId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await campaignsApi.get(campaignId);
      if (res.data) {
        setCampaign(res.data);
        setStatus(res.data.status || 'active');
      }
    } catch (e) {}
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [campaignId]);

  const handlePauseResume = () => {
    setStatus(status === 'active' ? 'paused' : 'active');
  };

  const handleEndCampaign = () => {
    setStatus('ended');
  };

  const handleExtendCampaign = () => {
    console.log('Extend campaign');
  };

  const handleShare = async () => {
    try {
      const res = await shareApi.createLink('campaign', campaignId);
      const url = res?.data?.url ? `https://hevolve.ai${res.data.url}` : `https://hevolve.ai/social/campaigns/${campaignId}`;
      await Share.share({ message: `Check out this campaign on Hevolve: ${url}`, url });
    } catch (e) {
      await Share.share({ message: `https://hevolve.ai/social/campaigns/${campaignId}` });
    }
  };

  if (loading || !campaign) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Campaign</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" style={{ marginTop: hp('2%') }} />
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[status];
  const budgetPercent = (campaign.budget.spent / campaign.budget.total) * 100;
  const maxImpressions = Math.max(...campaign.performance.map(p => p.impressions));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campaign</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
        }
      >
        {/* Campaign Header */}
        <Animatable.View animation="fadeIn" style={styles.campaignHeader}>
          <View style={styles.campaignTitleRow}>
            <Text style={styles.campaignName}>{campaign.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}22` }]}>
              <MaterialCommunityIcons name={statusConfig.icon} size={14} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <Text style={styles.campaignDates}>
            {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
          </Text>
        </Animatable.View>

        {/* Metrics Row */}
        <Animatable.View animation="fadeInUp" delay={100} style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="eye" size={24} color="#00e89d" />
            <AnimatedCounter value={campaign.metrics.impressions} duration={1500} textStyle={styles.metricValue} />
            <Text style={styles.metricLabel}>Impressions</Text>
          </View>
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="account-group" size={24} color="#00D9FF" />
            <AnimatedCounter value={campaign.metrics.reach} duration={1500} textStyle={styles.metricValue} />
            <Text style={styles.metricLabel}>Reach</Text>
          </View>
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="percent" size={24} color="#9D4EDD" />
            <Text style={styles.metricValue}>{campaign.metrics.engagementRate}%</Text>
            <Text style={styles.metricLabel}>Engagement</Text>
          </View>
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color="#FFD700" />
            <Text style={styles.metricValue}>{campaign.budget.spent}</Text>
            <Text style={styles.metricLabel}>Spent</Text>
          </View>
        </Animatable.View>

        {/* Performance Chart */}
        <Animatable.View animation="fadeInUp" delay={200} style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.chartContainer}>
            <View style={styles.chartBars}>
              {campaign.performance.map((day, index) => (
                <View key={day.day} style={styles.chartBar}>
                  <Animatable.View
                    animation="slideInUp"
                    delay={index * 50}
                    style={[
                      styles.barFill,
                      { height: `${(day.impressions / maxImpressions) * 100}%` },
                    ]}
                  />
                  <Text style={styles.barLabel}>{day.day}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animatable.View>

        {/* Budget Progress */}
        <Animatable.View animation="fadeInUp" delay={300} style={styles.section}>
          <Text style={styles.sectionTitle}>Budget</Text>
          <View style={styles.budgetCard}>
            <View style={styles.budgetHeader}>
              <View style={styles.budgetInfo}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFD700" />
                <Text style={styles.budgetText}>
                  {campaign.budget.spent} / {campaign.budget.total} Sparks
                </Text>
              </View>
              <Text style={styles.budgetPercent}>{budgetPercent.toFixed(0)}% used</Text>
            </View>
            <View style={styles.budgetBar}>
              <Animatable.View
                animation="slideInLeft"
                duration={800}
                style={[
                  styles.budgetFill,
                  {
                    width: `${budgetPercent}%`,
                    backgroundColor: budgetPercent > 90 ? '#EF4444' : '#FFD700',
                  },
                ]}
              />
            </View>
          </View>
        </Animatable.View>

        {/* Boosted Posts */}
        <Animatable.View animation="fadeInUp" delay={400} style={styles.section}>
          <Text style={styles.sectionTitle}>Boosted Posts</Text>
          {campaign.boostedPosts.map((post, index) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postIcon}>
                <MaterialCommunityIcons name="file-document" size={20} color="#00D9FF" />
              </View>
              <View style={styles.postInfo}>
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postStats}>
                  {post.impressions.toLocaleString()} impressions - {post.engagement}% engage
                </Text>
              </View>
            </View>
          ))}
        </Animatable.View>

        {/* Action Log */}
        <Animatable.View animation="fadeInUp" delay={500} style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          {campaign.actionLog.map((log, index) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logDot} />
              <View style={styles.logInfo}>
                <Text style={styles.logAction}>{log.action}</Text>
                <Text style={styles.logTime}>
                  {new Date(log.timestamp).toLocaleDateString()} at {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            </View>
          ))}
        </Animatable.View>

        {/* Controls */}
        <Animatable.View animation="fadeInUp" delay={600} style={styles.controlsSection}>
          <View style={styles.controlsRow}>
            {(status === 'active' || status === 'paused') && (
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  status === 'active' ? styles.pauseButton : styles.resumeButton,
                ]}
                onPress={handlePauseResume}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={status === 'active' ? 'pause' : 'play'}
                  size={20}
                  color={status === 'active' ? '#F59E0B' : '#10B981'}
                />
                <Text style={[
                  styles.controlButtonText,
                  { color: status === 'active' ? '#F59E0B' : '#10B981' },
                ]}>
                  {status === 'active' ? 'Pause' : 'Resume'}
                </Text>
              </TouchableOpacity>
            )}

            {status !== 'ended' && status !== 'completed' && (
              <TouchableOpacity
                style={[styles.controlButton, styles.endButton]}
                onPress={handleEndCampaign}
                activeOpacity={0.8}
              >
                <Ionicons name="stop" size={20} color="#EF4444" />
                <Text style={[styles.controlButtonText, { color: '#EF4444' }]}>End</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.extendButton}
            onPress={handleExtendCampaign}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-expand-right" size={20} color="#00e89d" />
            <Text style={styles.extendButtonText}>Extend Campaign</Text>
          </TouchableOpacity>
        </Animatable.View>

        <View style={styles.bottomSpacer} />
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
  headerSpacer: {
    width: 32,
  },
  shareButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: wp('4%'),
  },
  campaignHeader: {
    paddingHorizontal: wp('4%'),
    marginBottom: hp('2%'),
  },
  campaignTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  campaignName: {
    color: '#FFF',
    fontSize: wp('5.5%'),
    fontWeight: '800',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  statusText: {
    fontSize: wp('2.8%'),
    fontWeight: '600',
    marginLeft: 4,
  },
  campaignDates: {
    color: '#888',
    fontSize: wp('3%'),
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: wp('4%'),
    marginBottom: hp('2%'),
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  metricValue: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '800',
    marginTop: 6,
  },
  metricLabel: {
    color: '#888',
    fontSize: wp('2.5%'),
    marginTop: 2,
  },
  chartSection: {
    paddingHorizontal: wp('4%'),
    marginBottom: hp('2%'),
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
  },
  chartContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: hp('15%'),
    gap: 8,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#00e89d',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    color: '#888',
    fontSize: wp('2.5%'),
    marginTop: 6,
  },
  section: {
    paddingHorizontal: wp('4%'),
    marginBottom: hp('2%'),
  },
  budgetCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  budgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetText: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    marginLeft: 6,
  },
  budgetPercent: {
    color: '#888',
    fontSize: wp('3%'),
  },
  budgetBar: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: 4,
  },
  postCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    marginBottom: hp('1%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  postIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D9FF22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postInfo: {
    flex: 1,
    marginLeft: 12,
  },
  postTitle: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  postStats: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp('1.5%'),
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00e89d',
    marginTop: 6,
    marginRight: 12,
  },
  logInfo: {
    flex: 1,
  },
  logAction: {
    color: '#FFF',
    fontSize: wp('3.5%'),
  },
  logTime: {
    color: '#666',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  controlsSection: {
    paddingHorizontal: wp('4%'),
    marginTop: hp('1%'),
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: hp('1.5%'),
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.2%'),
    borderRadius: 12,
    borderWidth: 1,
  },
  pauseButton: {
    backgroundColor: '#F59E0B11',
    borderColor: '#F59E0B44',
  },
  resumeButton: {
    backgroundColor: '#10B98111',
    borderColor: '#10B98144',
  },
  endButton: {
    backgroundColor: '#EF444411',
    borderColor: '#EF444444',
  },
  controlButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginLeft: 6,
  },
  extendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00e89d22',
    paddingVertical: hp('1.5%'),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00e89d44',
  },
  extendButtonText: {
    color: '#00e89d',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 8,
  },
  bottomSpacer: {
    height: hp('5%'),
  },
});

export default CampaignDetailScreen;
