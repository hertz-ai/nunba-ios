/**
 * BleMatchCard — RN parity for the web SPA's
 * landing-page/src/components/Social/Encounters/shared/BleMatchCard.jsx
 * (commit d4405b55, hardened for a11y in 7dadd6bc).
 *
 * Renders a single BLE mutual-encounter match.  Consumes the row shape
 * returned by HARTOS encounter_api._match_to_dict (encounter_api.py:540-557):
 *   { id, user_a, user_b, lat, lng, matched_at,
 *     icebreaker_a_status, icebreaker_b_status, map_pin_visible }
 *
 * PRODUCT_MAP refs: J204 (mutual-like creates BLE match), J209 (approve →
 * status flips to sent), J210 (decline records reason), J211 (map pin
 * visible only when both matched).
 *
 * Mission anchors:
 *   - NO photo capture, NO user-uploaded image — initial-only avatar
 *     placeholder (encounter design constraint per
 *     project_encounter_icebreaker.md).
 *   - "Send icebreaker" is a USER ACTION button.  This component only
 *     triggers the parent callback — it never auto-fires the
 *     icebreaker flow.  IcebreakerDraftSheet mounts on the parent in
 *     response to the callback.
 *   - Copy avoids surveillance framing.  Surface label is "Mutual
 *     encounter" / "Both said yes" — not "tracked" / "matched".
 *   - Hardcoded palette matches every other Encounters component
 *     (LocationSettingsToggle, EncounterCard, MissedConnectionCard,
 *     ProximityMatchCard) per the orchestrator's "hardcoded by design"
 *     verdict (#433 Liquid UI audit) — refactoring this file alone
 *     would create the parallel path Gate 4 forbids.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const ACCENT = '#00e89d';
const PRIMARY = '#6C63FF';

function formatMatchedAt(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString();
}

const StatusChip = ({ label, tone }) => (
  <View
    style={[
      styles.chip,
      tone === 'success' && styles.chipSuccess,
      tone === 'muted' && styles.chipMuted,
      tone === 'info' && styles.chipInfo,
    ]}
    accessibilityRole="text"
    accessibilityLiveRegion="polite"
    accessibilityLabel={label}
  >
    <Text style={styles.chipText}>{label}</Text>
  </View>
);

const BleMatchCard = ({ match, currentUserId, onIcebreaker, onHide }) => {
  if (!match) return null;

  // "Other party" — never show the viewer's own avatar.
  const otherUserId =
    match.user_a === currentUserId ? match.user_b : match.user_a;
  const initial = (otherUserId || '?').slice(0, 1).toUpperCase();

  // Per-side icebreaker status — show a soft chip if either side has
  // already acted, so the user isn't confused about why Send is disabled.
  const viewerSide = match.user_a === currentUserId ? 'a' : 'b';
  const viewerStatus =
    viewerSide === 'a'
      ? match.icebreaker_a_status
      : match.icebreaker_b_status;
  const otherStatus =
    viewerSide === 'a'
      ? match.icebreaker_b_status
      : match.icebreaker_a_status;

  const viewerHasSent = viewerStatus === 'sent';
  const viewerHasDeclined = viewerStatus === 'declined';
  const sendDisabled = viewerHasSent || viewerHasDeclined;

  return (
    <View style={styles.card} testID={`ble-match-${match.id}`}>
      <View style={styles.row}>
        <View
          style={styles.avatar}
          accessibilityLabel={`Avatar for user ${otherUserId}`}
          accessibilityRole="image"
        >
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>

        <View style={styles.identity}>
          <Text style={styles.title} numberOfLines={1}>
            Mutual encounter
          </Text>
          <Text style={styles.subtle}>
            Both said yes
            {match.matched_at ? ` · ${formatMatchedAt(match.matched_at)}` : ''}
          </Text>
        </View>

        {viewerHasSent && <StatusChip label="Icebreaker sent" tone="success" />}
        {viewerHasDeclined && <StatusChip label="Declined" tone="muted" />}
        {otherStatus === 'sent' && !viewerHasSent && (
          <StatusChip label="They said hi" tone="info" />
        )}
      </View>

      <View style={styles.actions}>
        {onHide && (
          <TouchableOpacity
            style={[styles.button, styles.hideButton]}
            onPress={() => onHide(match)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Hide from map"
            testID={`ble-match-${match.id}-hide`}
          >
            <MaterialIcons name="visibility-off" size={16} color="#BBB" />
            <Text style={styles.hideText}>Hide</Text>
          </TouchableOpacity>
        )}
        {onIcebreaker && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.sendButton,
              sendDisabled && styles.sendButtonDisabled,
            ]}
            onPress={() => !sendDisabled && onIcebreaker(match)}
            activeOpacity={sendDisabled ? 1 : 0.7}
            disabled={sendDisabled}
            accessibilityRole="button"
            accessibilityLabel="Send icebreaker"
            accessibilityState={{ disabled: sendDisabled }}
            testID={`ble-match-${match.id}-icebreaker`}
          >
            <MaterialIcons
              name="chat-bubble-outline"
              size={16}
              color={sendDisabled ? '#666' : '#1a1a2e'}
            />
            <Text
              style={[
                styles.sendText,
                sendDisabled && styles.sendTextDisabled,
              ]}
            >
              Send icebreaker
            </Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: wp('3%'),
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
  title: {
    color: '#FFF',
    fontSize: wp('3.8%'),
    fontWeight: '600',
    marginBottom: 2,
  },
  subtle: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  chip: {
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.4%'),
    borderRadius: 8,
    marginLeft: wp('1.5%'),
  },
  chipSuccess: { backgroundColor: 'rgba(0, 232, 157, 0.18)' },
  chipMuted: { backgroundColor: 'rgba(136, 136, 136, 0.18)' },
  chipInfo: { backgroundColor: 'rgba(108, 99, 255, 0.18)' },
  chipText: {
    color: '#FFF',
    fontSize: wp('2.6%'),
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: hp('1%'),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 8,
    marginLeft: wp('2%'),
  },
  hideButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  hideText: {
    color: '#BBB',
    marginLeft: 4,
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  sendButton: { backgroundColor: ACCENT },
  sendButtonDisabled: { backgroundColor: '#3a3a4e' },
  sendText: {
    color: '#1a1a2e',
    marginLeft: 4,
    fontSize: wp('3.2%'),
    fontWeight: '700',
  },
  sendTextDisabled: { color: '#666' },
});

export default BleMatchCard;
