import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

const MissedConnectionCard = ({ item, onPress }) => {
  const responseCount = item.response_count || 0;
  const distance = item.distance
    ? item.distance >= 1000
      ? `${(item.distance / 1000).toFixed(1)}km away`
      : `${Math.round(item.distance)}m away`
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <MaterialIcons name="location-on" size={24} color="#00e89d" />
      </View>
      <View style={styles.content}>
        <Text style={styles.locationName} numberOfLines={1}>
          {item.location_name || 'Unknown Location'}
        </Text>
        <Text style={styles.timeText}>
          {formatRelativeTime(item.was_at || item.created_at)}
          {distance ? `  •  ${distance}` : ''}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <View
        style={[
          styles.badge,
          responseCount > 0 ? styles.badgeActive : styles.badgeInactive,
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            responseCount > 0 ? styles.badgeTextActive : styles.badgeTextInactive,
          ]}
        >
          {responseCount}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('3.5%'),
    marginVertical: hp('0.5%'),
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  content: {
    flex: 1,
  },
  locationName: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    marginBottom: 2,
  },
  timeText: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginBottom: 4,
  },
  description: {
    color: '#BBB',
    fontSize: wp('3%'),
    lineHeight: 18,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: wp('2%'),
  },
  badgeActive: {
    backgroundColor: '#00e89d',
  },
  badgeInactive: {
    backgroundColor: '#3a3a4e',
  },
  badgeText: {
    fontSize: wp('3%'),
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#1a1a2e',
  },
  badgeTextInactive: {
    color: '#888',
  },
});

export default MissedConnectionCard;
