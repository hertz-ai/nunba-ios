import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Clipboard,
  Share,
  Linking,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const ReferralCard = ({
  referralCode = 'HEVOLVE123',
  uses = 0,
  maxUses = 10,
  rewardsEarned = 0,
  rewardPerReferral = 50,
  onShare,
  loading = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    Clipboard.setString(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (platform) => {
    const message = `Join me on Hevolve! Use my referral code: ${referralCode} to get started with bonus rewards!`;
    const url = `https://hevolve.ai/invite/${referralCode}`;
    const fullMessage = `${message}\n${url}`;

    try {
      if (platform === 'whatsapp') {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
        await Linking.openURL(whatsappUrl);
      } else if (platform === 'twitter') {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullMessage)}`;
        await Linking.openURL(twitterUrl);
      } else {
        await Share.share({ message: fullMessage });
      }
    } catch (error) {
      // Fallback to native share if platform-specific share fails
      try {
        await Share.share({ message: fullMessage });
      } catch (_) {}
    }

    onShare && onShare(platform, referralCode);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader width={wp('50%')} height={hp('2.5%')} />
        <SkeletonLoader
          width={wp('80%')}
          height={hp('6%')}
          style={{ marginTop: hp('2%') }}
        />
        <View style={styles.loadingRow}>
          <SkeletonLoader width={wp('25%')} height={hp('4%')} />
          <SkeletonLoader width={wp('25%')} height={hp('4%')} />
          <SkeletonLoader width={wp('25%')} height={hp('4%')} />
        </View>
      </View>
    );
  }

  const usagePercentage = (uses / maxUses) * 100;

  return (
    <Animatable.View animation="fadeIn" duration={600} style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="gift-outline"
          size={wp('6%')}
          color="#8B5CF6"
        />
        <Text style={styles.title}>Invite Friends</Text>
      </View>

      <Text style={styles.subtitle}>
        Share your code and earn {rewardPerReferral} Spark per referral!
      </Text>

      <TouchableOpacity
        style={styles.codeContainer}
        onPress={handleCopyCode}
        activeOpacity={0.8}
      >
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{referralCode}</Text>
        </View>
        <View style={[styles.copyButton, copied && styles.copiedButton]}>
          <MaterialCommunityIcons
            name={copied ? 'check' : 'content-copy'}
            size={wp('5%')}
            color={copied ? '#10B981' : '#FFFFFF'}
          />
        </View>
        {copied && (
          <Animatable.Text
            animation="fadeIn"
            style={styles.copiedText}
          >
            Copied!
          </Animatable.Text>
        )}
      </TouchableOpacity>

      <View style={styles.qrPlaceholder}>
        <MaterialCommunityIcons
          name="qrcode"
          size={wp('20%')}
          color="#3A3A3A"
        />
        <Text style={styles.qrText}>QR Code</Text>
      </View>

      <View style={styles.shareSection}>
        <Text style={styles.shareLabel}>Share via</Text>
        <View style={styles.shareButtons}>
          <TouchableOpacity
            style={[styles.shareButton, styles.whatsappButton]}
            onPress={() => handleShare('whatsapp')}
          >
            <MaterialCommunityIcons
              name="whatsapp"
              size={wp('6%')}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareButton, styles.twitterButton]}
            onPress={() => handleShare('twitter')}
          >
            <MaterialCommunityIcons
              name="twitter"
              size={wp('6%')}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareButton, styles.linkButton]}
            onPress={() => handleShare('native')}
          >
            <MaterialCommunityIcons
              name="share-variant"
              size={wp('6%')}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{uses}</Text>
          <Text style={styles.statLabel}>Uses</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{maxUses - uses}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={styles.rewardValue}>
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={wp('4%')}
              color="#F59E0B"
            />
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>
              {rewardsEarned}
            </Text>
          </View>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Usage</Text>
          <Text style={styles.progressValue}>
            {uses}/{maxUses}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <Animatable.View
            animation="slideInLeft"
            style={[
              styles.progressFill,
              {
                width: `${usagePercentage}%`,
                backgroundColor:
                  usagePercentage >= 80
                    ? '#EF4444'
                    : usagePercentage >= 50
                    ? '#F59E0B'
                    : '#8B5CF6',
              },
            ]}
          />
        </View>
      </View>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginVertical: hp('1%'),
    marginHorizontal: wp('3%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  title: {
    color: '#FFFFFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
    marginLeft: wp('2%'),
  },
  subtitle: {
    color: '#888',
    fontSize: wp('3%'),
    marginBottom: hp('2%'),
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  codeBox: {
    flex: 1,
    backgroundColor: '#252525',
    borderRadius: 12,
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderStyle: 'dashed',
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: wp('5%'),
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  copyButton: {
    backgroundColor: '#8B5CF6',
    padding: wp('3%'),
    borderRadius: 12,
    marginLeft: wp('2%'),
  },
  copiedButton: {
    backgroundColor: '#10B98120',
  },
  copiedText: {
    position: 'absolute',
    right: wp('2%'),
    bottom: -hp('2%'),
    color: '#10B981',
    fontSize: wp('2.5%'),
    fontWeight: '600',
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    paddingVertical: hp('2%'),
    marginBottom: hp('2%'),
  },
  qrText: {
    color: '#666',
    fontSize: wp('2.5%'),
    marginTop: hp('0.5%'),
  },
  shareSection: {
    marginBottom: hp('2%'),
  },
  shareLabel: {
    color: '#888',
    fontSize: wp('3%'),
    marginBottom: hp('1%'),
  },
  shareButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  shareButton: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: wp('2%'),
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  twitterButton: {
    backgroundColor: '#1DA1F2',
  },
  linkButton: {
    backgroundColor: '#6B7280',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    paddingVertical: hp('1.5%'),
    marginBottom: hp('2%'),
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: wp('5%'),
    fontWeight: '800',
  },
  rewardValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    color: '#888',
    fontSize: wp('2.5%'),
    marginTop: hp('0.2%'),
  },
  statDivider: {
    width: 1,
    height: hp('4%'),
    backgroundColor: '#3A3A3A',
  },
  progressSection: {
    marginTop: hp('0.5%'),
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('0.5%'),
  },
  progressLabel: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  progressValue: {
    color: '#FFFFFF',
    fontSize: wp('2.8%'),
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
  loadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp('2%'),
  },
});

export default ReferralCard;
