import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const TIER_CONFIG = {
  bronze: { color: '#CD7F32', threshold: 0, icon: 'medal' },
  silver: { color: '#C0C0C0', threshold: 1000, icon: 'medal' },
  gold: { color: '#FFD700', threshold: 5000, icon: 'medal' },
  platinum: { color: '#E5E4E2', threshold: 15000, icon: 'crown' },
};

const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

const TierProgressBar = ({
  currentPoints = 0,
  currentTier = 'bronze',
  showLabels = true,
  showRewards = false,
  tierRewards = {},
  compact = false,
  style,
}) => {
  const currentTierIndex = TIERS.indexOf(currentTier);
  const nextTier = currentTierIndex < TIERS.length - 1 ? TIERS[currentTierIndex + 1] : null;

  const currentThreshold = TIER_CONFIG[currentTier].threshold;
  const nextThreshold = nextTier ? TIER_CONFIG[nextTier].threshold : currentThreshold;

  const progressInTier = nextTier
    ? ((currentPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100;

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <View style={styles.compactHeader}>
          <View style={[styles.compactTierIcon, { backgroundColor: `${TIER_CONFIG[currentTier].color}22` }]}>
            <MaterialCommunityIcons
              name={TIER_CONFIG[currentTier].icon}
              size={16}
              color={TIER_CONFIG[currentTier].color}
            />
          </View>
          <Text style={[styles.compactTierText, { color: TIER_CONFIG[currentTier].color }]}>
            {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
          </Text>
          {nextTier && (
            <Text style={styles.compactNextText}>
              {currentPoints.toLocaleString()} / {nextThreshold.toLocaleString()}
            </Text>
          )}
        </View>
        <View style={styles.compactProgressBar}>
          <View
            style={[
              styles.compactProgressFill,
              {
                width: `${Math.min(progressInTier, 100)}%`,
                backgroundColor: nextTier ? TIER_CONFIG[nextTier].color : TIER_CONFIG[currentTier].color,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <Animatable.View animation="fadeIn" duration={600} style={[styles.container, style]}>
      {/* Full Tier Progress */}
      <View style={styles.tierRow}>
        {TIERS.map((tier, index) => {
          const config = TIER_CONFIG[tier];
          const isReached = index <= currentTierIndex;
          const isCurrent = index === currentTierIndex;

          return (
            <React.Fragment key={tier}>
              {/* Tier Node */}
              <View style={styles.tierNode}>
                <View
                  style={[
                    styles.tierCircle,
                    {
                      backgroundColor: isReached ? config.color : '#2A2A3E',
                      borderColor: isCurrent ? '#FFF' : 'transparent',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={config.icon}
                    size={18}
                    color={isReached ? '#FFF' : '#555'}
                  />
                  {isCurrent && (
                    <Animatable.View
                      animation="pulse"
                      iterationCount="infinite"
                      duration={1500}
                      style={[styles.tierGlow, { backgroundColor: `${config.color}40` }]}
                    />
                  )}
                </View>
                {showLabels && (
                  <>
                    <Text style={[styles.tierLabel, { color: isReached ? config.color : '#555' }]}>
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </Text>
                    <Text style={styles.tierThreshold}>
                      {config.threshold.toLocaleString()}
                    </Text>
                  </>
                )}
                {showRewards && tierRewards[tier] && (
                  <View style={styles.tierReward}>
                    <MaterialCommunityIcons name="gift" size={12} color="#FFD700" />
                  </View>
                )}
              </View>

              {/* Connector */}
              {index < TIERS.length - 1 && (
                <View style={styles.connectorContainer}>
                  <View
                    style={[
                      styles.connector,
                      {
                        backgroundColor:
                          index < currentTierIndex
                            ? TIER_CONFIG[TIERS[index + 1]].color
                            : '#2A2A3E',
                      },
                    ]}
                  />
                  {isCurrent && nextTier && (
                    <Animatable.View
                      animation="slideInLeft"
                      duration={800}
                      style={[
                        styles.connectorProgress,
                        {
                          width: `${Math.min(progressInTier, 100)}%`,
                          backgroundColor: TIER_CONFIG[nextTier].color,
                        },
                      ]}
                    />
                  )}
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Current Progress Info */}
      {nextTier && (
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            <Text style={styles.progressValue}>{currentPoints.toLocaleString()}</Text>
            {' / '}
            {nextThreshold.toLocaleString()} to{' '}
            <Text style={{ color: TIER_CONFIG[nextTier].color }}>
              {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}
            </Text>
          </Text>
          <Text style={styles.progressPercent}>{progressInTier.toFixed(0)}%</Text>
        </View>
      )}
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: wp('4%'),
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tierNode: {
    alignItems: 'center',
    zIndex: 1,
  },
  tierCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  tierGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    zIndex: -1,
  },
  tierLabel: {
    fontSize: wp('2.8%'),
    fontWeight: '700',
    marginTop: 6,
  },
  tierThreshold: {
    color: '#666',
    fontSize: wp('2.2%'),
    marginTop: 2,
  },
  tierReward: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FFD70033',
    borderRadius: 8,
    padding: 2,
  },
  connectorContainer: {
    flex: 1,
    height: 4,
    marginTop: 18,
    marginHorizontal: -4,
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
  },
  connectorProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: hp('2%'),
    paddingHorizontal: wp('2%'),
  },
  progressText: {
    color: '#888',
    fontSize: wp('3%'),
  },
  progressValue: {
    color: '#FFF',
    fontWeight: '700',
  },
  progressPercent: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '700',
  },
  // Compact styles
  compactContainer: {
    padding: wp('3%'),
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactTierIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTierText: {
    fontSize: wp('3.2%'),
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  compactNextText: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  compactProgressBar: {
    height: 6,
    backgroundColor: '#2A2A3E',
    borderRadius: 3,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
});

export default TierProgressBar;
