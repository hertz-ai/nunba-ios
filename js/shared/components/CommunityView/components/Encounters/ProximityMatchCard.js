import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';

const ProximityMatchCard = ({ match, currentUserId, onReveal, onChat }) => {
  const isPending = match.status === 'pending';
  const isWaiting =
    match.status === 'revealed_a' || match.status === 'revealed_b';
  const isMatched = match.status === 'matched';

  const distance = match.distance
    ? match.distance >= 1000
      ? `${(match.distance / 1000).toFixed(1)}km`
      : `${Math.round(match.distance)}m`
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        {isMatched ? (
          <Ionicons name="people" size={36} color="#00e89d" />
        ) : (
          <Ionicons name="person-outline" size={36} color="#888" />
        )}
      </View>
      <View style={styles.content}>
        {isPending && (
          <>
            {distance && (
              <Text style={styles.distanceText}>~{distance} away</Text>
            )}
            <Text style={styles.statusText}>Someone is nearby</Text>
            <TouchableOpacity
              style={styles.revealButton}
              onPress={() => onReveal && onReveal(match.id)}
            >
              <Text style={styles.revealButtonText}>Reveal Yourself</Text>
            </TouchableOpacity>
          </>
        )}
        {isWaiting && (
          <>
            <Text style={styles.statusText}>You revealed yourself</Text>
            <View style={styles.waitingRow}>
              <ActivityIndicator size="small" color="#00e89d" />
              <Text style={styles.waitingText}>Waiting for them...</Text>
            </View>
          </>
        )}
        {isMatched && (
          <>
            <Text style={styles.matchedName}>
              {match.display_name_a || 'User'} &{' '}
              {match.display_name_b || 'User'}
            </Text>
            <Text style={styles.matchedLabel}>Matched!</Text>
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => {
                const otherUserId =
                  match.user_a === currentUserId
                    ? match.user_b
                    : match.user_a;
                onChat && onChat(otherUserId);
              }}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#1a1a2e" />
              <Text style={styles.chatButtonText}>Start Chat</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#2a2a3e',
    borderRadius: 14,
    padding: wp('4%'),
    marginVertical: hp('0.6%'),
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  distanceText: {
    color: '#00e89d',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    marginBottom: 4,
  },
  statusText: {
    color: '#CCC',
    fontSize: wp('3.2%'),
    marginBottom: 8,
  },
  revealButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#00e89d',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 16,
  },
  revealButtonText: {
    color: '#1a1a2e',
    fontSize: wp('3.2%'),
    fontWeight: '700',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitingText: {
    color: '#888',
    fontSize: wp('3%'),
    marginLeft: 8,
  },
  matchedName: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    marginBottom: 4,
  },
  matchedLabel: {
    color: '#00e89d',
    fontSize: wp('3%'),
    fontWeight: '600',
    marginBottom: 8,
  },
  chatButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#00e89d',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 16,
  },
  chatButtonText: {
    color: '#1a1a2e',
    fontSize: wp('3.2%'),
    fontWeight: '700',
    marginLeft: 6,
  },
});

export default ProximityMatchCard;
