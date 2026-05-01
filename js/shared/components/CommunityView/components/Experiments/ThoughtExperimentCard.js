/**
 * ThoughtExperimentCard — React Native port of the web ThoughtExperimentCard.
 *
 * Displays intent badge, hypothesis quote, title, author, vote/comment/view counts,
 * contributor count, and Spark funding. Context-aware status badges.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
} from 'react-native-responsive-screen';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  INTENT_COLORS,
  INTENT_ICONS,
  INTENT_LABELS,
  intentColor,
} from '../../../../theme/colors';
import colors from '../../../../theme/colors';

const STATUS_LABELS = {
  proposed: 'Proposed',
  discussing: 'Open Discussion',
  voting: 'Voting Now',
  evaluating: 'AI Evaluating',
  decided: 'Decided',
  archived: 'Archived',
};

export default function ThoughtExperimentCard({ experiment, onPress, style }) {
  const {
    title,
    hypothesis,
    expected_outcome,
    intent_category,
    experiment_type,
    status,
    contributor_count = 0,
    funding_total = 0,
    total_votes = 0,
    upvotes = 0,
    comment_count = 0,
    view_count = 0,
    discovery_score,
    author,
    created_at,
  } = experiment;

  const color = intentColor(intent_category);
  const iconName = INTENT_ICONS[intent_category] || 'flask';
  const categoryLabel = INTENT_LABELS[intent_category] || intent_category;

  const typeIcon =
    experiment_type === 'physical_ai'
      ? 'camera'
      : experiment_type === 'software'
      ? 'code-tags'
      : 'wrench';
  const typeLabel =
    experiment_type === 'physical_ai'
      ? 'Physical AI'
      : experiment_type === 'software'
      ? 'Software'
      : 'Traditional';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(experiment)}
      style={[styles.card, { borderLeftColor: color }, style]}
    >
      {/* Intent + Type badges row */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: color + '22' }]}>
          <MaterialCommunityIcons name={iconName} size={13} color={color} />
          <Text style={[styles.badgeText, { color }]}>{categoryLabel}</Text>
        </View>
        {experiment_type && experiment_type !== 'traditional' && (
          <View style={[styles.badge, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name={typeIcon} size={13} color={colors.textSecondary} />
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{typeLabel}</Text>
          </View>
        )}
        {status && status !== 'proposed' && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  status === 'voting' ? '#FFD70022' : colors.accent + '22',
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: status === 'voting' ? '#FFD700' : colors.accent },
              ]}
            >
              {STATUS_LABELS[status] || status}
            </Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      {/* Hypothesis quote */}
      {hypothesis ? (
        <View style={[styles.hypothesisBox, { borderLeftColor: color }]}>
          <MaterialIcons name="format-quote" size={16} color={color} />
          <Text style={styles.hypothesis} numberOfLines={3}>
            {hypothesis}
          </Text>
        </View>
      ) : null}

      {/* Expected outcome */}
      {expected_outcome ? (
        <View style={styles.outcomeRow}>
          <MaterialIcons name="auto-awesome" size={14} color="#FFD700" />
          <Text style={styles.outcomeText} numberOfLines={2}>
            {expected_outcome}
          </Text>
        </View>
      ) : null}

      {/* Contributor + funding row */}
      <View style={styles.metricsRow}>
        {contributor_count > 0 && (
          <View style={styles.metricItem}>
            <MaterialIcons name="people-alt" size={14} color={color} />
            <Text style={styles.metricText}>
              {contributor_count} {contributor_count === 1 ? 'believer' : 'believers'}
            </Text>
          </View>
        )}
        {funding_total > 0 && (
          <View style={styles.metricItem}>
            <MaterialIcons name="auto-awesome" size={14} color="#FF6B6B" />
            <Text style={styles.metricText}>
              {funding_total.toLocaleString()} Spark
            </Text>
          </View>
        )}
        {discovery_score > 8 && (
          <View style={[styles.badge, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              Recommended
            </Text>
          </View>
        )}
      </View>

      {/* Author + engagement row */}
      <View style={styles.footer}>
        <Text style={styles.authorText}>
          {author?.display_name || author?.username || 'Anonymous'}
        </Text>
        <View style={styles.engagementRow}>
          <View style={styles.engagementItem}>
            <MaterialIcons name="thumb-up" size={13} color={colors.textMuted} />
            <Text style={styles.engagementText}>{upvotes || total_votes}</Text>
          </View>
          <View style={styles.engagementItem}>
            <MaterialIcons name="chat-bubble-outline" size={13} color={colors.textMuted} />
            <Text style={styles.engagementText}>{comment_count}</Text>
          </View>
          <View style={styles.engagementItem}>
            <MaterialIcons name="visibility" size={13} color={colors.textMuted} />
            <Text style={styles.engagementText}>{view_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: wp('4%'),
    marginBottom: 12,
    borderLeftWidth: 3,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
  },
  hypothesisBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingLeft: 10,
    borderLeftWidth: 2,
    marginBottom: 8,
  },
  hypothesis: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  outcomeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  authorText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  engagementRow: {
    flexDirection: 'row',
    gap: 12,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  engagementText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
