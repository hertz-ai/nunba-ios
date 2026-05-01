import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const TIER_CONFIG = {
  starter: {
    color: '#6B7280',
    label: 'Starter',
    icon: 'shield-outline',
  },
  established: {
    color: '#10B981',
    label: 'Established',
    icon: 'shield-half-full',
  },
  thriving: {
    color: '#3B82F6',
    label: 'Thriving',
    icon: 'shield-star',
  },
  legendary: {
    color: '#F59E0B',
    label: 'Legendary',
    icon: 'shield-crown',
  },
};

const RegionCard = ({
  name = 'Region',
  memberCount = 0,
  governanceTier = 'starter',
  flagIcon = 'earth',
  description,
  isJoined = false,
  onPress,
  onJoin,
  onLeave,
  loading = false,
}) => {
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingHeader}>
          <SkeletonLoader variant="avatar" />
          <View style={styles.loadingInfo}>
            <SkeletonLoader width={wp('40%')} height={hp('2.5%')} />
            <SkeletonLoader
              width={wp('25%')}
              height={hp('1.5%')}
              style={{ marginTop: hp('0.5%') }}
            />
          </View>
        </View>
        <SkeletonLoader
          width={wp('30%')}
          height={hp('4%')}
          style={{ marginTop: hp('1%') }}
        />
      </View>
    );
  }

  const tierConfig = TIER_CONFIG[governanceTier] || TIER_CONFIG.starter;

  const formatMemberCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };

  return (
    <Animatable.View animation="fadeInUp" duration={500}>
      <TouchableOpacity
        style={[
          styles.container,
          { borderColor: tierConfig.color + '40' },
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.flagContainer,
              { backgroundColor: tierConfig.color + '20' },
            ]}
          >
            <MaterialCommunityIcons
              name={flagIcon}
              size={wp('6%')}
              color={tierConfig.color}
            />
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.statsRow}>
              <MaterialCommunityIcons
                name="account-group"
                size={wp('3.5%')}
                color="#888"
              />
              <Text style={styles.memberCount}>
                {formatMemberCount(memberCount)} members
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.tierBadge,
              {
                backgroundColor: tierConfig.color + '20',
                borderColor: tierConfig.color,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={tierConfig.icon}
              size={wp('3.5%')}
              color={tierConfig.color}
            />
            <Text style={[styles.tierText, { color: tierConfig.color }]}>
              {tierConfig.label}
            </Text>
          </View>
        </View>

        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}

        <View style={styles.footer}>
          {isJoined ? (
            <>
              <View style={styles.joinedIndicator}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={wp('4%')}
                  color="#10B981"
                />
                <Text style={styles.joinedText}>Joined</Text>
              </View>
              {onLeave && (
                <TouchableOpacity
                  style={styles.leaveButton}
                  onPress={(e) => {
                    e.stopPropagation && e.stopPropagation();
                    onLeave();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.leaveButtonText}>Leave</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={[
                styles.joinButton,
                { backgroundColor: tierConfig.color },
              ]}
              onPress={(e) => {
                e.stopPropagation && e.stopPropagation();
                onJoin && onJoin();
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="plus"
                size={wp('4%')}
                color="#FFFFFF"
              />
              <Text style={styles.joinButtonText}>Join Region</Text>
            </TouchableOpacity>
          )}
        </View>
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
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagContainer: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('0.3%'),
  },
  memberCount: {
    color: '#888',
    fontSize: wp('3%'),
    marginLeft: wp('1%'),
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.5%'),
    borderRadius: 12,
    borderWidth: 1,
  },
  tierText: {
    fontSize: wp('2.5%'),
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
  description: {
    color: '#888',
    fontSize: wp('3%'),
    lineHeight: hp('2%'),
    marginTop: hp('1%'),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: hp('1.5%'),
    paddingTop: hp('1.5%'),
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    borderRadius: 12,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: wp('3.2%'),
    fontWeight: '700',
    marginLeft: wp('1%'),
  },
  joinedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinedText: {
    color: '#10B981',
    fontSize: wp('3.2%'),
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
  leaveButton: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: '#EF444420',
  },
  leaveButtonText: {
    color: '#EF4444',
    fontSize: wp('3%'),
    fontWeight: '600',
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingInfo: {
    flex: 1,
    marginLeft: wp('3%'),
  },
});

export default RegionCard;
