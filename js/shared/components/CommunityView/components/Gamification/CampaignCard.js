import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const STATUS_CONFIG = {
  draft: {
    color: '#6B7280',
    label: 'Draft',
    icon: 'file-edit-outline',
    accentColor: '#4B5563',
  },
  active: {
    color: '#10B981',
    label: 'Active',
    icon: 'play-circle',
    accentColor: '#059669',
  },
  paused: {
    color: '#F59E0B',
    label: 'Paused',
    icon: 'pause-circle',
    accentColor: '#D97706',
  },
  completed: {
    color: '#3B82F6',
    label: 'Completed',
    icon: 'check-circle',
    accentColor: '#2563EB',
  },
};

const CampaignCard = ({
  title = 'Campaign',
  status = 'draft',
  impressions = 0,
  clicks = 0,
  conversions = 0,
  budgetSpent = 0,
  totalBudget = 100,
  onPress,
  loading = false,
}) => {
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingHeader}>
          <SkeletonLoader width={wp('50%')} height={hp('2.5%')} />
          <SkeletonLoader width={wp('15%')} height={hp('2%')} />
        </View>
        <View style={styles.loadingMetrics}>
          <SkeletonLoader width={wp('25%')} height={hp('5%')} />
          <SkeletonLoader width={wp('25%')} height={hp('5%')} />
          <SkeletonLoader width={wp('25%')} height={hp('5%')} />
        </View>
        <SkeletonLoader width={wp('80%')} height={hp('1%')} />
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const budgetPercentage = Math.min((budgetSpent / totalBudget) * 100, 100);
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0;

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <Animatable.View animation="fadeInUp" duration={500}>
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.accentBar,
            { backgroundColor: statusConfig.accentColor },
          ]}
        />

        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusConfig.color + '20' },
            ]}
          >
            <MaterialCommunityIcons
              name={statusConfig.icon}
              size={wp('3.5%')}
              color={statusConfig.color}
            />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.metricsContainer}>
          <View style={styles.metricItem}>
            <MaterialCommunityIcons
              name="eye-outline"
              size={wp('4%')}
              color="#888"
            />
            <Text style={styles.metricValue}>{formatNumber(impressions)}</Text>
            <Text style={styles.metricLabel}>Impressions</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <MaterialCommunityIcons
              name="cursor-default-click"
              size={wp('4%')}
              color="#888"
            />
            <Text style={styles.metricValue}>{formatNumber(clicks)}</Text>
            <Text style={styles.metricLabel}>Clicks ({ctr}%)</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <MaterialCommunityIcons
              name="check-decagram"
              size={wp('4%')}
              color="#888"
            />
            <Text style={styles.metricValue}>{formatNumber(conversions)}</Text>
            <Text style={styles.metricLabel}>Conversions</Text>
          </View>
        </View>

        <View style={styles.budgetSection}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetLabel}>Budget Spent</Text>
            <Text style={styles.budgetValue}>
              ${budgetSpent.toFixed(2)} / ${totalBudget.toFixed(2)}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <Animatable.View
              animation="slideInLeft"
              duration={800}
              style={[
                styles.progressFill,
                {
                  width: `${budgetPercentage}%`,
                  backgroundColor:
                    budgetPercentage >= 90
                      ? '#EF4444'
                      : budgetPercentage >= 70
                      ? '#F59E0B'
                      : statusConfig.color,
                },
              ]}
            />
          </View>
          <Text style={styles.budgetPercent}>
            {budgetPercentage.toFixed(0)}% used
          </Text>
        </View>

        {status === 'active' && (
          <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            duration={2000}
            style={styles.liveDot}
          />
        )}
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
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  titleContainer: {
    flex: 1,
    marginRight: wp('2%'),
  },
  title: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.4%'),
    borderRadius: 10,
  },
  statusText: {
    fontSize: wp('2.8%'),
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    paddingVertical: hp('1.5%'),
    marginBottom: hp('2%'),
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginTop: hp('0.3%'),
  },
  metricLabel: {
    color: '#666',
    fontSize: wp('2.5%'),
    marginTop: hp('0.2%'),
  },
  metricDivider: {
    width: 1,
    height: hp('5%'),
    backgroundColor: '#3A3A3A',
  },
  budgetSection: {
    marginTop: hp('0.5%'),
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('0.5%'),
  },
  budgetLabel: {
    color: '#888',
    fontSize: wp('3%'),
  },
  budgetValue: {
    color: '#FFFFFF',
    fontSize: wp('3%'),
    fontWeight: '600',
  },
  progressBar: {
    height: hp('0.8%'),
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetPercent: {
    color: '#666',
    fontSize: wp('2.5%'),
    marginTop: hp('0.3%'),
    textAlign: 'right',
  },
  liveDot: {
    position: 'absolute',
    top: wp('3%'),
    right: wp('3%'),
    width: wp('2.5%'),
    height: wp('2.5%'),
    borderRadius: wp('1.25%'),
    backgroundColor: '#10B981',
  },
  loadingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('2%'),
  },
  loadingMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('2%'),
  },
});

export default CampaignCard;
