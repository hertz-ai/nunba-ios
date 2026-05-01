/**
 * EncounterCard — RN parity for the web SPA's
 * landing-page/src/components/Social/shared/EncounterCard.js.
 *
 * Renders a Discovery suggestion: avatar + display name + match %
 * compatibility bar + interest chips + Skip / Accept buttons.
 *
 * Props (match the web contract):
 *   encounter: {
 *     id, display_name, username, avatar_url,
 *     compatibility_pct | compatibility,
 *     crossed_paths | encounter_count,
 *     interests: string[],
 *   }
 *   onAccept: (encounter) => void   — caller invokes
 *                                     encountersApi.acknowledge(id)
 *   onSkip:   (encounter) => void   — local state removal only
 *
 * Style baseline taken from MissedConnectionCard.js (dark theme,
 * #2a2a3e card on #1a1a2e bg, #00e89d accent, wp/hp units).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const ACCENT = '#00e89d';
const PRIMARY = '#6C63FF';

const EncounterCard = ({ encounter, onAccept, onSkip }) => {
  if (!encounter) return null;
  const compatibility =
    encounter.compatibility_pct ?? encounter.compatibility ?? 0;
  const crossedPaths =
    encounter.crossed_paths ?? encounter.encounter_count ?? 0;
  const displayName =
    encounter.display_name || encounter.username || '?';
  const initial = displayName[0].toUpperCase();
  const interests = Array.isArray(encounter.interests)
    ? encounter.interests
    : [];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {encounter.avatar_url ? (
          <Image
            source={{ uri: encounter.avatar_url }}
            style={styles.avatar}
            accessibilityLabel={`Avatar for ${displayName}`}
          />
        ) : (
          <View
            style={[styles.avatar, styles.avatarFallback]}
            accessibilityLabel={`Avatar for ${displayName}`}
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}

        <View style={styles.identity}>
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.subtle}>
            Crossed paths {crossedPaths} time{crossedPaths !== 1 ? 's' : ''}
          </Text>
        </View>

        <View
          style={styles.matchBlock}
          accessibilityLabel={`${compatibility} percent match`}
        >
          <Text style={styles.matchPct}>{compatibility}%</Text>
          <Text style={styles.subtle}>Match</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.max(0, Math.min(100, compatibility))}%` },
          ]}
        />
      </View>

      {interests.length > 0 && (
        <View style={styles.chipRow}>
          {interests.map((interest) => (
            <View key={interest} style={styles.chip}>
              <Text style={styles.chipText}>{interest}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {onSkip && (
          <TouchableOpacity
            style={[styles.button, styles.skipButton]}
            onPress={() => onSkip(encounter)}
            activeOpacity={0.7}
            accessibilityLabel="Skip"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={18} color="#BBB" />
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
        {onAccept && (
          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={() => onAccept(encounter)}
            activeOpacity={0.7}
            accessibilityLabel={`Accept ${displayName}`}
            accessibilityRole="button"
          >
            <MaterialIcons name="check" size={18} color="#1a1a2e" />
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('3.5%'),
    marginVertical: hp('0.5%'),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: wp('3%'),
  },
  avatarFallback: {
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    color: '#FFF',
    fontSize: wp('3.8%'),
    fontWeight: '600',
    marginBottom: 2,
  },
  subtle: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  matchBlock: {
    minWidth: 56,
    alignItems: 'center',
    marginLeft: wp('2%'),
  },
  matchPct: {
    color: ACCENT,
    fontSize: wp('5%'),
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1a1a2e',
    marginTop: hp('1.5%'),
    marginBottom: hp('1%'),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: hp('1.2%'),
  },
  chip: {
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.4%'),
    borderRadius: 8,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    marginRight: wp('1.5%'),
    marginBottom: hp('0.5%'),
  },
  chipText: {
    color: '#FFF',
    fontSize: wp('2.8%'),
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 8,
    marginLeft: wp('2%'),
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  skipText: {
    color: '#BBB',
    marginLeft: 4,
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: ACCENT,
  },
  acceptText: {
    color: '#1a1a2e',
    marginLeft: 4,
    fontSize: wp('3.2%'),
    fontWeight: '700',
  },
});

export default EncounterCard;
