/**
 * ExperimentMetricsCard — Inline metrics display for React Native.
 * Shows type-specific metrics: camera feed for physical_ai, build stats for software.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { experimentsApi } from '../../../../services/socialApi';
import colors from '../../../../theme/colors';

export default function ExperimentMetricsCard({ experimentId, experimentType }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!experimentId) return;
    let cancelled = false;
    experimentsApi
      .metrics(experimentId)
      .then((r) => {
        if (!cancelled && r?.data) setMetrics(r.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [experimentId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (!metrics) return null;

  const {
    contributor_count = 0,
    funding_total = 0,
    compute_nodes = 0,
    total_gpu_hours = 0,
    vote_distribution = {},
    build_stats,
    has_camera,
    camera_feed_url,
  } = metrics;

  return (
    <View style={styles.container}>
      {/* Common metrics */}
      <View style={styles.row}>
        {contributor_count > 0 && (
          <View style={styles.metric}>
            <MaterialIcons name="people-alt" size={14} color={colors.accent} />
            <Text style={styles.metricText}>
              {contributor_count} believer{contributor_count !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        {funding_total > 0 && (
          <View style={styles.metric}>
            <MaterialIcons name="auto-awesome" size={14} color="#FF6B6B" />
            <Text style={styles.metricText}>
              {funding_total.toLocaleString()} Spark
            </Text>
          </View>
        )}
        {compute_nodes > 0 && (
          <View style={styles.metric}>
            <MaterialCommunityIcons name="memory" size={14} color="#10B981" />
            <Text style={styles.metricText}>
              {compute_nodes} nodes &middot; {total_gpu_hours}h
            </Text>
          </View>
        )}
      </View>

      {/* Physical AI: camera feed */}
      {experimentType === 'physical_ai' && has_camera && camera_feed_url && (
        <View style={styles.cameraContainer}>
          <Image
            source={{ uri: camera_feed_url }}
            style={styles.cameraImage}
            resizeMode="cover"
          />
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
      )}

      {/* Software: build stats */}
      {experimentType === 'software' && build_stats && (
        <View style={styles.buildStatsRow}>
          <MaterialIcons name="build" size={14} color="#FFAB00" />
          <Text style={styles.buildLabel}>Build</Text>
          <View style={styles.buildBar}>
            <View
              style={[
                styles.buildBarFill,
                {
                  width: `${(build_stats.success_rate || 0) * 100}%`,
                  backgroundColor:
                    build_stats.success_rate >= 0.7 ? '#2ECC71' : '#FFAB00',
                },
              ]}
            />
          </View>
          <Text style={styles.buildPct}>
            {Math.round((build_stats.success_rate || 0) * 100)}%
          </Text>
          <Text style={styles.buildDetail}>
            {build_stats.merged || 0}/{build_stats.total_tasks || 0}
          </Text>
        </View>
      )}

      {/* Vote distribution bar */}
      {(vote_distribution.support > 0 || vote_distribution.oppose > 0) && (
        <View style={styles.voteRow}>
          <MaterialIcons name="thumb-up" size={12} color="#2ECC71" />
          <Text style={[styles.voteCount, { color: '#2ECC71' }]}>
            {vote_distribution.support}
          </Text>
          <View style={styles.voteBar}>
            {(() => {
              const total =
                (vote_distribution.support || 0) +
                (vote_distribution.oppose || 0) +
                (vote_distribution.neutral || 0);
              if (!total) return null;
              const supportPct =
                ((vote_distribution.support || 0) / total) * 100;
              const opposePct =
                ((vote_distribution.oppose || 0) / total) * 100;
              return (
                <>
                  <View
                    style={[styles.voteBarSegment, { width: `${supportPct}%`, backgroundColor: '#2ECC71' }]}
                  />
                  <View
                    style={[
                      styles.voteBarSegment,
                      { width: `${100 - supportPct - opposePct}%`, backgroundColor: colors.border },
                    ]}
                  />
                  <View
                    style={[styles.voteBarSegment, { width: `${opposePct}%`, backgroundColor: '#e74c3c' }]}
                  />
                </>
              );
            })()}
          </View>
          <Text style={[styles.voteCount, { color: '#e74c3c' }]}>
            {vote_distribution.oppose}
          </Text>
          <MaterialIcons name="thumb-down" size={12} color="#e74c3c" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: wp('4%'),
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  loadingContainer: {
    marginHorizontal: wp('4%'),
    alignItems: 'center',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 6,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cameraContainer: {
    position: 'relative',
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginVertical: 6,
  },
  cameraImage: {
    width: '100%',
    height: '100%',
  },
  liveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#e74c3c',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  buildStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  buildLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  buildBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  buildBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  buildPct: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  buildDetail: {
    fontSize: 10,
    color: colors.textMuted,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  voteCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  voteBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  voteBarSegment: {
    height: '100%',
  },
});
