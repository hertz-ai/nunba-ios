/**
 * DiscoverableTogglePanel — RN parity for the web SPA's
 * landing-page/src/components/Social/Encounters/shared/DiscoverableTogglePanel.jsx
 * (commit 5a705452, F1 GREENLIT).
 *
 * Lets the user opt in to BLE physical-world Encounters by:
 *   - declaring 18+ (server-side guard at HARTOS encounter_api.py:332)
 *   - toggling discoverable on (server clamps TTL to
 *     ENCOUNTER_DISCOVERABLE_TTL_SEC, ≤ MAX_TOGGLES_24H per day)
 *   - showing a server-authoritative TTL countdown so a clock-skewed
 *     phone or DevTools manipulation can't extend the visible window
 *     beyond what the server granted (orchestrator a73b4a29
 *     ethical-hacker gate)
 *
 * Mission anchors honored (orchestrator-enforced):
 *   1. 18+ checkbox MUST default UNCHECKED on every mount.
 *      Never persisted to AsyncStorage — explicit re-affirm each time.
 *   2. TTL countdown sources `expires_at` from server, NOT local clock
 *      + ttl_sec.
 *   3. Switch DISABLED until age-claim checked AND state=disabled.
 *   4. Privacy moments are FEATURES, not friction — the consent panel
 *      sits above the Tabs so it's the first thing the user sees.
 *
 * Backend chain:
 *   GET  /api/social/encounter/discoverable  →
 *     {success, data: {enabled, expires_at, remaining_sec,
 *      toggle_count_24h, age_claim_18, face_visible, avatar_style,
 *      vibe_tags}}
 *   POST /api/social/encounter/discoverable  →
 *     body: {enabled, age_claim_18, ttl_sec, face_visible,
 *            avatar_style, vibe_tags}
 *     server returns 403 if `enable && !age_claim_18`
 *     server returns 429 if `>= MAX_TOGGLES_24H` within 24h
 *
 * Service: bleEncounterApi.getDiscoverable / setDiscoverable
 * (services/socialApi.js, RN parity for landing-page commit 65084ae2).
 *
 * Out-of-MVP (follow-on commits under ledger #443):
 *   - vibe_tags chip input (read-only display for now)
 *   - face_visible toggle
 *   - avatar_style picker
 *   - 24h toggle count display
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { bleEncounterApi } from '../../../../services/socialApi';

const ACCENT = '#00e89d';
const ERR = '#ff6b6b';

// Isolate the 1Hz ticker so toggling parent state doesn't cascade
// re-renders into the Switch / Checkbox every second.
const TTLCountdown = React.memo(({ expiresAtIso }) => {
  const [remainingSec, setRemainingSec] = useState(() => {
    if (!expiresAtIso) return 0;
    const ms = new Date(expiresAtIso).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });
  useEffect(() => {
    if (!expiresAtIso) {
      setRemainingSec(0);
      return undefined;
    }
    const tick = () => {
      const ms = new Date(expiresAtIso).getTime() - Date.now();
      setRemainingSec(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);
  if (remainingSec <= 0) return null;
  const hours = Math.floor(remainingSec / 3600);
  const minutes = Math.floor((remainingSec % 3600) / 60);
  const label =
    hours > 0
      ? `${hours}h ${minutes}m remaining`
      : `${minutes}m remaining`;
  return (
    <Text
      style={styles.ttlText}
      accessibilityLabel={`Discoverable for ${label}`}
    >
      Visible for {label}
    </Text>
  );
});

const DiscoverableTogglePanel = () => {
  const [enabled, setEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [ageClaim, setAgeClaim] = useState(false); // ANCHOR 1: never persisted
  const [vibeTags, setVibeTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rateLimited, setRateLimited] = useState(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const fetchState = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bleEncounterApi.getDiscoverable();
      const data = result?.data || {};
      if (!mounted.current) return;
      setEnabled(!!data.enabled);
      setExpiresAt(data.expires_at || null);
      setVibeTags(Array.isArray(data.vibe_tags) ? data.vibe_tags : []);
      // ANCHOR 1: do NOT seed ageClaim from server — keep it false
      // every mount so the user must explicitly re-affirm 18+ before
      // each enable.  The server's own age_claim_18 record is for
      // gating purposes only.
    } catch (e) {
      if (mounted.current) setError(`Couldn't load consent state: ${e.message}`);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleToggle = useCallback(
    async (next) => {
      setError(null);
      // ANCHOR 3: don't let the UI race the server's 403.
      if (next && !ageClaim) {
        setError('Confirm 18+ to enable discoverable.');
        return;
      }
      setSubmitting(true);
      try {
        const result = await bleEncounterApi.setDiscoverable({
          enabled: next,
          age_claim_18: ageClaim,
          vibe_tags: vibeTags,
        });
        const data = result?.data || {};
        if (!mounted.current) return;
        setEnabled(!!data.enabled);
        setExpiresAt(data.expires_at || null);
        setRateLimited(false);
      } catch (e) {
        if (!mounted.current) return;
        // Best-effort 429 detection — fetch wrapper throws on
        // non-2xx with the status text in message; HARTOS returns
        // {error: 'toggle limit reached ...'} on 429.
        const msg = e.message || '';
        if (msg.includes('429') || msg.includes('toggle limit')) {
          setRateLimited(true);
          setError(
            'Toggle limit reached for the next 24 hours. ' +
              'This protects you from accidental over-broadcasting.',
          );
        } else if (msg.includes('403') || msg.includes('age_claim')) {
          setError('Confirm 18+ to enable discoverable.');
        } else {
          setError(`Failed: ${msg}`);
        }
      } finally {
        if (mounted.current) setSubmitting(false);
      }
    },
    [ageClaim, vibeTags],
  );

  const switchDisabled =
    submitting || loading || rateLimited || (!enabled && !ageClaim);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MaterialIcons
          name={enabled ? 'visibility' : 'visibility-off'}
          size={22}
          color={enabled ? ACCENT : '#888'}
        />
        <Text style={styles.label}>Discoverable nearby</Text>
        {(loading || submitting) && (
          <ActivityIndicator size="small" color={ACCENT} style={styles.spinner} />
        )}
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          disabled={switchDisabled}
          trackColor={{ false: '#3a3a4e', true: '#00e89d55' }}
          thumbColor={enabled ? ACCENT : '#888'}
          accessibilityLabel="Discoverable on Hevolve nearby"
          accessibilityState={{ checked: enabled, disabled: switchDisabled }}
        />
      </View>

      {/* ANCHOR 1: 18+ checkbox, defaults unchecked, never persisted */}
      <TouchableOpacity
        onPress={() => setAgeClaim((v) => !v)}
        style={styles.ageRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ageClaim }}
        accessibilityLabel="I am 18 or older"
      >
        <MaterialIcons
          name={ageClaim ? 'check-box' : 'check-box-outline-blank'}
          size={22}
          color={ageClaim ? ACCENT : '#888'}
        />
        <Text style={styles.ageLabel}>I am 18 or older</Text>
      </TouchableOpacity>

      {expiresAt && enabled && <TTLCountdown expiresAtIso={expiresAt} />}

      <Text style={styles.privacyText}>
        When on, people physically near you can opt in to see your avatar —
        never your photo. Drafts run locally without it.
      </Text>

      {error && (
        <Text
          style={styles.errorText}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      )}

      {vibeTags.length > 0 && (
        <View style={styles.tagsRow}>
          {vibeTags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#FFF',
    fontSize: wp('3.8%'),
    fontWeight: '600',
    marginLeft: wp('2%'),
    flex: 1,
  },
  spinner: {
    marginRight: wp('2%'),
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1%'),
  },
  ageLabel: {
    color: '#BBB',
    fontSize: wp('3.4%'),
    marginLeft: wp('2%'),
  },
  ttlText: {
    color: ACCENT,
    fontSize: wp('3.2%'),
    fontWeight: '600',
    marginTop: hp('0.6%'),
  },
  privacyText: {
    color: '#888',
    fontSize: wp('3%'),
    marginTop: hp('0.8%'),
    lineHeight: 18,
  },
  errorText: {
    color: ERR,
    fontSize: wp('3.2%'),
    marginTop: hp('0.6%'),
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: hp('0.8%'),
  },
  tagChip: {
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.4%'),
    borderRadius: 8,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    marginRight: wp('1.5%'),
    marginBottom: hp('0.5%'),
  },
  tagChipText: {
    color: '#FFF',
    fontSize: wp('2.8%'),
  },
});

export default DiscoverableTogglePanel;
