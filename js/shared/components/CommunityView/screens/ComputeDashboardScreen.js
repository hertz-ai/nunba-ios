/**
 * ComputeDashboardScreen — RN parity for the web SPA's
 * landing-page/src/components/Social/Compute/ComputeDashboardPage.js.
 *
 * Surfaces the user's compute-sharing state with the Nunba hive:
 *   - Off → "Enable compute sharing" CTA + transparency copy.
 *   - On  → live status, contribution score, visibility tier chip,
 *           personal Impact stats (GPU hrs, inferences, Spark, agents),
 *           and Hive Impact aggregate (active nodes, totals).
 *
 * Toggle updates state via computeApi.optIn / optOut.  The screen
 * does NOT optimistically flip the switch — we wait for the server
 * round-trip and re-fetch status, so a network failure surfaces as a
 * banner instead of a desynced UI.
 *
 * Backend (HARTOS — integrations/social/compute_api.py):
 *   POST /api/social/compute/opt-in
 *   POST /api/social/compute/opt-out
 *   GET  /api/social/compute/status
 *   GET  /api/social/compute/impact
 *   GET  /api/social/compute/community-impact
 *
 * Service: services/socialApi.js → computeApi.{optIn, optOut,
 *   status, impact, communityImpact}.
 *
 * Privacy invariants (preserved verbatim from web SPA):
 *   - Compute runs only when device is idle (server-side scheduler).
 *   - All tasks are logged and inspectable; user can opt out anytime.
 *   - No personal-data access; opt-in is per-account, not per-device.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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
import { computeApi } from '../../../services/socialApi';

const ACCENT = '#00e89d';
const ACCENT_BLUE = '#6C63FF';
const ACCENT_AMBER = '#FFB740';
const HEART = '#FF6B6B';
const ERR = '#ff6b6b';
const MUTED = '#888';

// HARTOS responses are payload-wrapped: {success, data: {...}}.
// Defensive read so flat responses (just the payload) still work.
const unwrap = (res) => {
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

const StatCell = ({ label, value, icon, color }) => (
  <View style={styles.statCell}>
    <MaterialIcons name={icon} size={22} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const HiveStat = ({ label, value }) => (
  <View style={styles.hiveStat}>
    <Text style={styles.hiveValue}>{value}</Text>
    <Text style={styles.hiveLabel}>{label}</Text>
  </View>
);

const ComputeDashboardScreen = () => {
  const [status, setStatus] = useState(null);
  const [impact, setImpact] = useState(null);
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, impactRes, communityRes] = await Promise.allSettled([
        computeApi.status(),
        computeApi.impact(),
        computeApi.communityImpact(),
      ]);
      if (statusRes.status === 'fulfilled') {
        setStatus(unwrap(statusRes.value) || {});
      }
      if (impactRes.status === 'fulfilled') {
        setImpact(unwrap(impactRes.value) || {});
      }
      if (communityRes.status === 'fulfilled') {
        setCommunity(unwrap(communityRes.value) || {});
      }
    } catch (_) {
      // Silent — surfaced only on user-initiated toggle failure.
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    })();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    setMessage(null);
    const wasOn = !!status?.opted_in;
    try {
      if (wasOn) {
        await computeApi.optOut();
        setMessage({ type: 'success', text: 'Compute sharing disabled.' });
      } else {
        await computeApi.optIn();
        setMessage({ type: 'success', text: 'Compute sharing enabled.' });
      }
      await fetchData();
    } catch (e) {
      setMessage({
        type: 'error',
        text: e?.message || 'Could not update compute sharing.',
      });
    } finally {
      setToggling(false);
    }
  }, [status, toggling, fetchData]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const optedIn = !!status?.opted_in;
  const tier = status?.visibility_tier || 'standard';
  const score = status?.contribution_score || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={ACCENT}
        />
      }
      testID="compute-dashboard-screen"
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Compute Dashboard</Text>
          <Text style={styles.subtle}>
            Your contribution to the Nunba hive
          </Text>
        </View>
        <View style={styles.toggleWrap}>
          <Text
            style={[
              styles.toggleLabel,
              { color: optedIn ? ACCENT : MUTED },
            ]}
          >
            {optedIn ? 'Active' : 'Off'}
          </Text>
          <Switch
            value={optedIn}
            onValueChange={handleToggle}
            disabled={toggling}
            trackColor={{ false: '#3a3a4e', true: 'rgba(0,232,157,0.4)' }}
            thumbColor={optedIn ? ACCENT : '#bbb'}
            testID="compute-toggle"
          />
        </View>
      </View>

      {message && (
        <View
          style={[
            styles.banner,
            message.type === 'error' ? styles.bannerError : styles.bannerOk,
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.bannerText}>{message.text}</Text>
          <TouchableOpacity
            onPress={() => setMessage(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            testID="compute-banner-dismiss"
          >
            <MaterialIcons name="close" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Status Banner ── */}
      {!optedIn ? (
        <View style={[styles.card, styles.cardInfoBorder]} testID="compute-cta">
          <View style={styles.row}>
            <MaterialIcons name="info-outline" size={22} color={ACCENT_BLUE} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.cardTitle}>
                Share your idle compute with the hive
              </Text>
              <Text style={styles.cardBody}>
                When your device is idle, Nunba runs small AI tasks in
                the background. You earn Spark tokens. The community
                gets smarter. You can stop anytime.
              </Text>
              <TouchableOpacity
                onPress={handleToggle}
                disabled={toggling}
                style={[
                  styles.button,
                  styles.primaryButton,
                  toggling && styles.primaryButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Enable compute sharing"
                testID="compute-enable-button"
              >
                <MaterialIcons name="memory" size={16} color="#FFF" />
                <Text style={styles.primaryButtonText}>
                  Enable compute sharing
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.card, styles.cardActive]} testID="compute-active">
          <View style={styles.activeHeaderRow}>
            <View style={styles.dot} />
            <Text style={styles.activeTitle}>Compute sharing active</Text>
            <View style={styles.tierChip}>
              <Text style={styles.tierChipText}>{tier}</Text>
            </View>
          </View>
          <Text style={styles.cardBody}>
            Your device is contributing to the hive. Contribution
            score: {score}
          </Text>
        </View>
      )}

      {/* ── Personal Stats ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Impact</Text>
        <View style={styles.statsRow}>
          <StatCell
            label="GPU Hours"
            value={(impact?.gpu_hours || 0).toFixed(1)}
            icon="bolt"
            color={ACCENT_AMBER}
          />
          <StatCell
            label="Inferences"
            value={impact?.inferences || 0}
            icon="memory"
            color={ACCENT_BLUE}
          />
          <StatCell
            label="Spark"
            value={impact?.spark_earned || 0}
            icon="favorite"
            color={HEART}
          />
          <StatCell
            label="Agents"
            value={impact?.agent_count || 0}
            icon="groups"
            color={ACCENT}
          />
        </View>
      </View>

      {/* ── Hive Impact ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hive Impact</Text>
        <Text style={styles.cardBody}>
          The Nunba hive is powered by {community?.active_nodes || 0}{' '}
          contributors worldwide.
        </Text>
        <View style={styles.hiveGrid}>
          <HiveStat
            label="Active Nodes"
            value={community?.active_nodes || 0}
          />
          <HiveStat
            label="Total GPU Hours"
            value={(community?.total_gpu_hours || 0).toFixed(0)}
          />
          <HiveStat
            label="Total Inferences"
            value={(community?.total_inferences || 0).toLocaleString()}
          />
          <HiveStat
            label="Agents Hosted"
            value={community?.total_agents_hosted || 0}
          />
        </View>
      </View>

      {/* ── Transparency ── */}
      <View style={styles.card}>
        <View style={styles.row}>
          <MaterialIcons name="info-outline" size={16} color={MUTED} />
          <Text style={[styles.subtle, { marginLeft: 6, flex: 1 }]}>
            Transparency
          </Text>
        </View>
        <Text style={styles.cardBody}>
          All compute tasks are logged. You can see exactly what ran,
          when, and how much energy was used. Your device only
          processes tasks when idle. Nunba never accesses personal
          data. You can disable sharing anytime with the toggle above.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: wp('4%') },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('1.5%'),
  },
  heading: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    marginBottom: hp('0.4%'),
  },
  subtle: { color: MUTED, fontSize: wp('3.2%') },
  toggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: wp('3.2%'), fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.2%'),
    borderRadius: 8,
    marginBottom: hp('1.5%'),
  },
  bannerOk: { backgroundColor: 'rgba(0,232,157,0.15)' },
  bannerError: { backgroundColor: 'rgba(255,107,107,0.18)' },
  bannerText: { color: '#FFF', fontSize: wp('3.2%'), flex: 1, marginRight: 8 },
  card: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('4%'),
    marginBottom: hp('1.8%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardInfoBorder: { borderLeftWidth: 4, borderLeftColor: ACCENT_BLUE },
  cardActive: {
    borderColor: 'rgba(0,232,157,0.25)',
    backgroundColor: '#2a2a3e',
  },
  cardTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '600',
    marginBottom: hp('0.4%'),
  },
  cardBody: {
    color: MUTED,
    fontSize: wp('3.2%'),
    lineHeight: wp('4.6%'),
    marginTop: hp('0.4%'),
    marginBottom: hp('1%'),
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.1%'),
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: hp('0.5%'),
    gap: 6,
  },
  primaryButton: { backgroundColor: ACCENT },
  primaryButtonDisabled: { backgroundColor: 'rgba(0,232,157,0.5)' },
  primaryButtonText: { color: '#FFF', fontWeight: '600', fontSize: wp('3.4%') },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.6%'),
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  activeTitle: {
    color: ACCENT,
    fontSize: wp('3.6%'),
    fontWeight: '600',
    flex: 1,
  },
  tierChip: {
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.2%'),
    borderRadius: 10,
  },
  tierChipText: {
    color: ACCENT,
    fontSize: wp('2.8%'),
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: hp('0.6%'),
  },
  statCell: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: hp('0.6%'),
  },
  statValue: {
    color: '#FFF',
    fontSize: wp('4.2%'),
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    color: MUTED,
    fontSize: wp('2.8%'),
    marginTop: 2,
    textAlign: 'center',
  },
  hiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: hp('0.6%'),
  },
  hiveStat: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    paddingVertical: hp('1.2%'),
    marginBottom: hp('1%'),
  },
  hiveValue: { color: '#FFF', fontSize: wp('4.2%'), fontWeight: '700' },
  hiveLabel: {
    color: MUTED,
    fontSize: wp('2.8%'),
    marginTop: 2,
    textAlign: 'center',
  },
});

export default ComputeDashboardScreen;
