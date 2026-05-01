import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const TIER_CONFIG = {
  bronze: { color: '#CD7F32', icon: 'shield', label: 'Bronze' },
  silver: { color: '#C0C0C0', icon: 'shield-half-full', label: 'Silver' },
  gold: { color: '#FFD700', icon: 'shield-star', label: 'Gold' },
  platinum: { color: '#E5E4E2', icon: 'shield-crown', label: 'Platinum' },
};

const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

const SeasonBanner = ({
  seasonName = 'Season 1',
  daysRemaining = 30,
  currentTier = 'bronze',
  tierProgress = 0,
  rewards = [],
  onPress,
  onDismiss,
  loading = false,
}) => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader width={wp('90%')} height={hp('12%')} borderRadius={16} />
      </View>
    );
  }

  const currentTierIndex = TIERS.indexOf(currentTier);
  const tierConfig = TIER_CONFIG[currentTier] || TIER_CONFIG.bronze;

  const handleDismiss = () => {
    setVisible(false);
    onDismiss && onDismiss();
  };

  return (
    <Animatable.View animation="fadeInDown" duration={600} useNativeDriver>
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={styles.gradientBg}>
          <View style={[styles.gradientLayer1, { backgroundColor: tierConfig.color + '15' }]} />
          <View style={[styles.gradientLayer2, { backgroundColor: tierConfig.color + '08' }]} />
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="close" size={wp('5%')} color="#666" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.seasonInfo}>
            <Animatable.View
              animation="pulse"
              iterationCount="infinite"
              duration={2000}
            >
              <MaterialCommunityIcons
                name={tierConfig.icon}
                size={wp('8%')}
                color={tierConfig.color}
              />
            </Animatable.View>
            <View style={styles.seasonTextContainer}>
              <Text style={styles.seasonName}>{seasonName}</Text>
              <Text style={styles.tierLabel}>{tierConfig.label} Tier</Text>
            </View>
          </View>

          <View style={styles.daysContainer}>
            <Text style={styles.daysNumber}>{daysRemaining}</Text>
            <Text style={styles.daysLabel}>days left</Text>
          </View>
        </View>

        <View style={styles.tierProgressContainer}>
          <View style={styles.tierRow}>
            {TIERS.map((tier, index) => {
              const config = TIER_CONFIG[tier];
              const isActive = index <= currentTierIndex;
              const isCurrent = index === currentTierIndex;

              return (
                <React.Fragment key={tier}>
                  <View style={styles.tierItem}>
                    <View
                      style={[
                        styles.tierDot,
                        {
                          backgroundColor: isActive ? config.color : '#2A2A2A',
                          borderColor: isCurrent ? '#FFFFFF' : 'transparent',
                        },
                      ]}
                    >
                      {isCurrent && (
                        <Animatable.View
                          animation="pulse"
                          iterationCount="infinite"
                          duration={1500}
                          style={[
                            styles.tierGlow,
                            { backgroundColor: config.color + '40' },
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.tierName,
                        { color: isActive ? config.color : '#444' },
                      ]}
                    >
                      {config.label}
                    </Text>
                  </View>
                  {index < TIERS.length - 1 && (
                    <View
                      style={[
                        styles.tierConnector,
                        {
                          backgroundColor:
                            index < currentTierIndex ? TIER_CONFIG[TIERS[index + 1]].color : '#2A2A2A',
                        },
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {currentTierIndex < TIERS.length - 1 && (
            <View style={styles.progressToNext}>
              <Text style={styles.progressLabel}>
                Progress to {TIER_CONFIG[TIERS[currentTierIndex + 1]].label}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${tierProgress}%`,
                      backgroundColor: TIER_CONFIG[TIERS[currentTierIndex + 1]].color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>{tierProgress}%</Text>
            </View>
          )}
        </View>

        {rewards.length > 0 && (
          <View style={styles.rewardsSection}>
            <Text style={styles.rewardsLabel}>Season Rewards</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rewardsList}
            >
              {rewards.slice(0, 5).map((reward, index) => (
                <Animatable.View
                  key={index}
                  animation="fadeInRight"
                  delay={index * 100}
                  style={styles.rewardItem}
                >
                  <MaterialCommunityIcons
                    name={reward.icon || 'gift'}
                    size={wp('5%')}
                    color={reward.color || '#F59E0B'}
                  />
                </Animatable.View>
              ))}
              <View style={styles.moreRewards}>
                <Text style={styles.moreText}>+{rewards.length > 5 ? rewards.length - 5 : ''}</Text>
              </View>
            </ScrollView>
          </View>
        )}
      </TouchableOpacity>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: wp('3%'),
    marginVertical: hp('1%'),
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientLayer1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  gradientLayer2: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '50%',
    height: '100%',
  },
  dismissButton: {
    position: 'absolute',
    top: hp('1%'),
    right: wp('2%'),
    zIndex: 10,
    padding: wp('1%'),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp('4%'),
    paddingBottom: hp('1%'),
  },
  seasonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seasonTextContainer: {
    marginLeft: wp('3%'),
  },
  seasonName: {
    color: '#FFFFFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
  },
  tierLabel: {
    color: '#888',
    fontSize: wp('3%'),
    marginTop: hp('0.2%'),
  },
  daysContainer: {
    alignItems: 'center',
    backgroundColor: '#252525',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 12,
  },
  daysNumber: {
    color: '#FFFFFF',
    fontSize: wp('5%'),
    fontWeight: '800',
  },
  daysLabel: {
    color: '#666',
    fontSize: wp('2.5%'),
    fontWeight: '600',
  },
  tierProgressContainer: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('2%'),
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierItem: {
    alignItems: 'center',
  },
  tierDot: {
    width: wp('6%'),
    height: wp('6%'),
    borderRadius: wp('3%'),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierGlow: {
    position: 'absolute',
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
  },
  tierName: {
    fontSize: wp('2.5%'),
    fontWeight: '600',
    marginTop: hp('0.5%'),
  },
  tierConnector: {
    flex: 1,
    height: 3,
    marginHorizontal: wp('1%'),
    borderRadius: 2,
  },
  progressToNext: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1.5%'),
  },
  progressLabel: {
    color: '#666',
    fontSize: wp('2.5%'),
    marginRight: wp('2%'),
  },
  progressBar: {
    flex: 1,
    height: hp('0.6%'),
    backgroundColor: '#2A2A2A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercent: {
    color: '#888',
    fontSize: wp('2.5%'),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  rewardsSection: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('1.5%'),
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: hp('1.5%'),
  },
  rewardsLabel: {
    color: '#888',
    fontSize: wp('3%'),
    fontWeight: '600',
    marginBottom: hp('1%'),
  },
  rewardsList: {
    paddingRight: wp('4%'),
  },
  rewardItem: {
    width: wp('10%'),
    height: wp('10%'),
    backgroundColor: '#252525',
    borderRadius: wp('2%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('2%'),
  },
  moreRewards: {
    width: wp('10%'),
    height: wp('10%'),
    backgroundColor: '#1E1E1E',
    borderRadius: wp('2%'),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderStyle: 'dashed',
  },
  moreText: {
    color: '#666',
    fontSize: wp('2.5%'),
    fontWeight: '600',
  },
});

export default SeasonBanner;
