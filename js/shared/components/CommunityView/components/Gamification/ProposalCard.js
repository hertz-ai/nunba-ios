import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const STATUS_CONFIG = {
  active: {
    color: '#10B981',
    label: 'Active',
    icon: 'vote',
  },
  pending: {
    color: '#F59E0B',
    label: 'Pending',
    icon: 'clock-outline',
  },
  passed: {
    color: '#3B82F6',
    label: 'Passed',
    icon: 'check-circle',
  },
  rejected: {
    color: '#EF4444',
    label: 'Rejected',
    icon: 'close-circle',
  },
};

const ProposalCard = ({
  title = 'Proposal',
  authorName = 'Anonymous',
  authorAvatar,
  status = 'active',
  votesFor = 0,
  votesAgainst = 0,
  endTime,
  userVote = null,
  onPress,
  onVoteFor,
  onVoteAgainst,
  loading = false,
}) => {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!endTime) return;

    const updateTime = () => {
      const now = new Date();
      const end = new Date(endTime);
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h remaining`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeRemaining(`${minutes}m remaining`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [endTime]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingHeader}>
          <SkeletonLoader variant="avatar" />
          <View style={styles.loadingInfo}>
            <SkeletonLoader width={wp('50%')} height={hp('2%')} />
            <SkeletonLoader
              width={wp('30%')}
              height={hp('1.5%')}
              style={{ marginTop: hp('0.5%') }}
            />
          </View>
        </View>
        <SkeletonLoader
          width={wp('80%')}
          height={hp('1%')}
          style={{ marginTop: hp('2%') }}
        />
        <View style={styles.loadingButtons}>
          <SkeletonLoader width={wp('35%')} height={hp('4%')} />
          <SkeletonLoader width={wp('35%')} height={hp('4%')} />
        </View>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const totalVotes = votesFor + votesAgainst;
  const forPercentage = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;
  const againstPercentage = 100 - forPercentage;
  const isVotingEnabled = status === 'active' && !userVote;

  return (
    <Animatable.View animation="fadeInUp" duration={500}>
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View style={styles.header}>
          <View style={styles.authorSection}>
            {authorAvatar ? (
              <Image source={{ uri: authorAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialCommunityIcons
                  name="account"
                  size={wp('5%')}
                  color="#888"
                />
              </View>
            )}
            <View style={styles.authorInfo}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.authorName}>by {authorName}</Text>
            </View>
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

        {timeRemaining && status === 'active' && (
          <View style={styles.timeContainer}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={wp('3.5%')}
              color="#888"
            />
            <Text style={styles.timeText}>{timeRemaining}</Text>
          </View>
        )}

        <View style={styles.voteTallyContainer}>
          <View style={styles.voteTallyHeader}>
            <View style={styles.voteLabel}>
              <View style={[styles.voteDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.voteLabelText}>For ({votesFor})</Text>
            </View>
            <View style={styles.voteLabel}>
              <Text style={styles.voteLabelText}>Against ({votesAgainst})</Text>
              <View style={[styles.voteDot, { backgroundColor: '#EF4444' }]} />
            </View>
          </View>

          <View style={styles.voteTallyBar}>
            <Animatable.View
              animation="slideInLeft"
              duration={800}
              style={[
                styles.voteForBar,
                { width: `${forPercentage}%` },
              ]}
            />
            <Animatable.View
              animation="slideInRight"
              duration={800}
              style={[
                styles.voteAgainstBar,
                { width: `${againstPercentage}%` },
              ]}
            />
          </View>

          <View style={styles.percentageRow}>
            <Text style={[styles.percentageText, { color: '#10B981' }]}>
              {forPercentage.toFixed(0)}%
            </Text>
            <Text style={[styles.percentageText, { color: '#EF4444' }]}>
              {againstPercentage.toFixed(0)}%
            </Text>
          </View>
        </View>

        {isVotingEnabled ? (
          <View style={styles.voteButtons}>
            <TouchableOpacity
              style={styles.voteForButton}
              onPress={(e) => {
                e.stopPropagation && e.stopPropagation();
                onVoteFor && onVoteFor();
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="thumb-up"
                size={wp('4%')}
                color="#10B981"
              />
              <Text style={styles.voteForButtonText}>Vote For</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.voteAgainstButton}
              onPress={(e) => {
                e.stopPropagation && e.stopPropagation();
                onVoteAgainst && onVoteAgainst();
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="thumb-down"
                size={wp('4%')}
                color="#EF4444"
              />
              <Text style={styles.voteAgainstButtonText}>Vote Against</Text>
            </TouchableOpacity>
          </View>
        ) : userVote ? (
          <View style={styles.votedIndicator}>
            <MaterialCommunityIcons
              name={userVote === 'for' ? 'thumb-up' : 'thumb-down'}
              size={wp('4%')}
              color={userVote === 'for' ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.votedText,
                { color: userVote === 'for' ? '#10B981' : '#EF4444' },
              ]}
            >
              You voted {userVote}
            </Text>
          </View>
        ) : null}
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
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
  },
  avatarPlaceholder: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorInfo: {
    flex: 1,
    marginLeft: wp('3%'),
    marginRight: wp('2%'),
  },
  title: {
    color: '#FFFFFF',
    fontSize: wp('3.8%'),
    fontWeight: '700',
  },
  authorName: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: hp('0.2%'),
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.4%'),
    borderRadius: 10,
  },
  statusText: {
    fontSize: wp('2.5%'),
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1%'),
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    backgroundColor: '#252525',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  timeText: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginLeft: wp('1%'),
  },
  voteTallyContainer: {
    marginTop: hp('1.5%'),
  },
  voteTallyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('0.5%'),
  },
  voteLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteDot: {
    width: wp('2%'),
    height: wp('2%'),
    borderRadius: wp('1%'),
    marginHorizontal: wp('1%'),
  },
  voteLabelText: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  voteTallyBar: {
    flexDirection: 'row',
    height: hp('1.2%'),
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
  },
  voteForBar: {
    backgroundColor: '#10B981',
    height: '100%',
  },
  voteAgainstBar: {
    backgroundColor: '#EF4444',
    height: '100%',
  },
  percentageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp('0.3%'),
  },
  percentageText: {
    fontSize: wp('3%'),
    fontWeight: '700',
  },
  voteButtons: {
    flexDirection: 'row',
    marginTop: hp('1.5%'),
    paddingTop: hp('1.5%'),
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  voteForButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B98120',
    paddingVertical: hp('1%'),
    borderRadius: 10,
    marginRight: wp('2%'),
    borderWidth: 1,
    borderColor: '#10B98140',
  },
  voteForButtonText: {
    color: '#10B981',
    fontSize: wp('3.2%'),
    fontWeight: '600',
    marginLeft: wp('1.5%'),
  },
  voteAgainstButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF444420',
    paddingVertical: hp('1%'),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  voteAgainstButtonText: {
    color: '#EF4444',
    fontSize: wp('3.2%'),
    fontWeight: '600',
    marginLeft: wp('1.5%'),
  },
  votedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('1.5%'),
    paddingTop: hp('1.5%'),
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  votedText: {
    fontSize: wp('3%'),
    fontWeight: '600',
    marginLeft: wp('1.5%'),
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingInfo: {
    flex: 1,
    marginLeft: wp('3%'),
  },
  loadingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp('2%'),
  },
});

export default ProposalCard;
