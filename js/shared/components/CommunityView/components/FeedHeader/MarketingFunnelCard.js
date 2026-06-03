/**
 * MarketingFunnelCard (RN mobile) — closes #184 Android + iOS halves.
 *
 * Mobile parity for landing-page MarketingFunnelCard.js (Nunba commit
 * 659dcd2b).  Polls /api/social/marketing/stats every 30s and shows
 * channel-by-channel download conversion above the rest of the feed.
 *
 * Drop-in: rendered inside FeedHeader so it lives at the top of
 * MainScreen, which is the first page the user sees in the Nunba
 * Companion (Android + iOS share this RN bundle).
 *
 * Accessibility:
 *   - accessibilityLiveRegion="polite" so the metric is announced
 *     on update (TalkBack / VoiceOver friendly)
 *   - accessibilityLabel for each row spells out the shorthand
 *     "30 clicks, 8 downloads, 1 signup"
 *   - role-equivalent: the card uses accessibilityRole="summary"
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { marketingApi } from '../../../../services/socialApi';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../../../theme/colors';


function pickLeader(byCode) {
  if (!byCode || typeof byCode !== 'object') return null;
  let best = null;
  for (const [code, row] of Object.entries(byCode)) {
    const downloads = row?.download || 0;
    const clicks = row?.click || 0;
    if (
      !best
      || downloads > best.downloads
      || (downloads === best.downloads && clicks > best.clicks)
      || (downloads === best.downloads && clicks === best.clicks
          && code < best.code)
    ) {
      best = { code, downloads, clicks };
    }
  }
  return best;
}


export default function MarketingFunnelCard() {
  const [byCode, setByCode] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await marketingApi.stats();
        // socialApi.get returns the parsed response body shape
        // {success, data: {by_code, total}} matching the social_bp
        // _ok() contract.
        const payload = resp?.data || resp || {};
        if (!cancelled) {
          setByCode(payload.by_code || {});
          setTotal(payload.total || 0);
        }
      } catch (_e) {
        if (!cancelled) { setByCode({}); setTotal(0); }
      }
      if (!cancelled) setLoading(false);
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const totalDownloads = Object.values(byCode).reduce(
    (a, b) => a + (b?.download || 0), 0);
  const totalClicks = Object.values(byCode).reduce(
    (a, b) => a + (b?.click || 0), 0);
  const leader = pickLeader(byCode);
  const rows = Object.entries(byCode)
    .sort(([, a], [, b]) => (b?.download || 0) - (a?.download || 0))
    .slice(0, 4);

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={
        loading
          ? 'Marketing funnel loading'
          : `Marketing funnel, ${totalDownloads} downloads, ${totalClicks} clicks`
      }
      accessibilityLiveRegion="polite"
    >
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Icon
            name="trending-up"
            size={22}
            color={colors.primary || '#6C63FF'}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.label}>MARKETING FUNNEL</Text>
          <Text style={styles.metric}>
            {loading ? '—' : `${totalDownloads}`} downloads
          </Text>
          <Text style={styles.subtle}>
            {totalClicks} clicks · {total} events
          </Text>
        </View>
      </View>

      {!loading && leader && leader.downloads > 0 && (
        <View style={styles.leaderBox}>
          <Text style={styles.leaderText}>
            Leading channel: <Text style={styles.leaderCode}>{leader.code}</Text>
            {' '}({leader.downloads}d, {leader.clicks}c)
          </Text>
        </View>
      )}

      {!loading && rows.length === 0 && (
        <Text style={styles.empty}>
          No clicks yet. Marketing posts via /marketing/intents will
          show up here once links start landing.
        </Text>
      )}

      {!loading && rows.length > 0 && (
        <View style={styles.rows}>
          {rows.map(([code, row]) => {
            const c = row?.click || 0;
            const d = row?.download || 0;
            const s = row?.signup || 0;
            return (
              <View
                key={code}
                style={styles.row}
                accessible
                accessibilityLabel={
                  `${code}: ${c} clicks, ${d} downloads, ${s} signups`
                }
              >
                <Text style={styles.rowCode}>{code}</Text>
                <Text style={styles.rowMetric}>
                  {c}c · {d}d · {s}s
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md || 16,
    marginVertical: spacing.sm || 8,
    padding: spacing.md || 16,
    borderRadius: borderRadius.md || 12,
    backgroundColor: colors.backgroundSecondary || '#000000',
    borderWidth: 1,
    borderColor: colors.border || 'rgba(255,255,255,0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  label: {
    color: colors.textSecondary || 'rgba(255,255,255,0.5)',
    fontSize: fontSize.xs || 11,
    fontWeight: fontWeight.medium || '500',
    letterSpacing: 0.5,
  },
  metric: {
    color: colors.text || '#fff',
    fontSize: fontSize.lg || 20,
    fontWeight: fontWeight.bold || '700',
  },
  subtle: {
    color: colors.textTertiary || 'rgba(255,255,255,0.4)',
    fontSize: fontSize.xs || 11,
  },
  leaderBox: {
    padding: 8,
    marginBottom: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  leaderText: {
    color: colors.primary || '#9B94FF',
    fontSize: fontSize.xs || 12,
  },
  leaderCode: {
    fontWeight: fontWeight.bold || '700',
  },
  empty: {
    color: colors.textTertiary || 'rgba(255,255,255,0.4)',
    fontSize: fontSize.xs || 12,
    fontStyle: 'italic',
  },
  rows: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowCode: {
    color: colors.text || 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm || 13,
  },
  rowMetric: {
    color: colors.textSecondary || 'rgba(255,255,255,0.5)',
    fontSize: fontSize.sm || 13,
  },
});
