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

// The id behind a match side: the server sends { id, ... } objects.
const sideId = (side) => (side && typeof side === 'object' ? side.id : side);
const sideName = (match, key) =>
  match[`display_name_${key}`]
  || match[`user_${key}`]?.display_name
  || match[`user_${key}`]?.username
  || 'User';
// The other person in a matched pair.  Unknown until we know which side the
// viewer is on -- never guess, or Break the ice writes to yourself.
const otherSideId = (match, currentUserId) => {
  if (match.other_user_id) return match.other_user_id;
  if (!currentUserId) return null;
  const a = sideId(match.user_a);
  const b = sideId(match.user_b);
  if (a === currentUserId) return b;
  if (b === currentUserId) return a;
  return null;
};
// Their name, for the chat header; null when we can't tell which side is theirs.
const otherSideName = (match, otherId) => {
  if (!otherId) return null;
  if (sideId(match.user_a) === otherId) return sideName(match, 'a');
  if (sideId(match.user_b) === otherId) return sideName(match, 'b');
  return null;
};

const ProximityMatchCard = ({ match, currentUserId, onReveal, onBreakTheIce }) => {
  const isMatched = match.status === 'matched';
  // 'revealed_a' / 'revealed_b' only say *someone* revealed.  The server
  // tells each viewer which side they are on via you_revealed /
  // other_revealed; reading the status alone showed "You revealed yourself"
  // (and hid the Reveal button) to the person who hadn't, so a match could
  // never become mutual.
  const youRevealed = match.you_revealed === true;
  const theyRevealed = match.other_revealed === true;
  const isWaiting = !isMatched && youRevealed;
  const canReveal = !isMatched && !youRevealed && match.status !== 'expired';

  // HARTOS sends a coarse distance_bucket ("~50m away"), never the exact
  // metres; keep the numeric form for any caller that has one.
  const distance = match.distance_bucket
    || (match.distance
      ? `~${match.distance >= 1000
        ? `${(match.distance / 1000).toFixed(1)}km`
        : `${Math.round(match.distance)}m`} away`
      : null);

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        {isMatched ? (
          <Ionicons name="people" size={36} color="#6C63FF" />
        ) : (
          <Ionicons name="person-outline" size={36} color="#888" />
        )}
      </View>
      <View style={styles.content}>
        {canReveal && (
          <>
            {distance && (
              <Text style={styles.distanceText}>{distance}</Text>
            )}
            <Text style={styles.statusText}>
              {theyRevealed ? 'Someone nearby revealed themselves' : 'Someone is nearby'}
            </Text>
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
              <ActivityIndicator size="small" color="#6C63FF" />
              <Text style={styles.waitingText}>Waiting for them...</Text>
            </View>
          </>
        )}
        {isMatched && (
          <>
            <Text style={styles.matchedName}>
              {sideName(match, 'a')} &{' '}
              {sideName(match, 'b')}
            </Text>
            <Text style={styles.matchedLabel}>Matched!</Text>
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => {
                const otherId = otherSideId(match, currentUserId);
                if (onBreakTheIce) onBreakTheIce(match, otherSideName(match, otherId));
              }}
              accessibilityRole="button"
              accessibilityLabel="Break the ice"
              testID={`proximity-match-${match.id}-break-the-ice`}
            >
              <Ionicons name="snow-outline" size={16} color="#000000" />
              <Text style={styles.chatButtonText}>Break the ice</Text>
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  distanceText: {
    color: '#6C63FF',
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
    backgroundColor: '#6C63FF',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 16,
  },
  revealButtonText: {
    color: '#000000',
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
    color: '#6C63FF',
    fontSize: wp('3%'),
    fontWeight: '600',
    marginBottom: 8,
  },
  chatButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 16,
  },
  chatButtonText: {
    color: '#000000',
    fontSize: wp('3.2%'),
    fontWeight: '700',
    marginLeft: 6,
  },
});

export default ProximityMatchCard;
