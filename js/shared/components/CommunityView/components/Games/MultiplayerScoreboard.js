import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
} from '../../../../theme/colors';

// Deterministic avatar color from name
const AVATAR_COLORS = [
  '#6C63FF', '#FF6B6B', '#2ECC71', '#FFAB00', '#00B8D9',
  '#EC4899', '#8B5CF6', '#F59E0B', '#3B82F6', '#10B981',
];
const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

/**
 * LiveScoreBar — Compact horizontal bar shown during gameplay.
 * Props: multiplayer (from useMultiplayerSync)
 */
export const LiveScoreBar = ({ multiplayer }) => {
  const players = multiplayer?.state?.players || multiplayer?.scores || [];

  if (!players || players.length <= 1) return null;

  return (
    <View style={styles.liveBar}>
      {players.map((player, idx) => {
        const name = player.username || player.name || `P${idx + 1}`;
        const bgColor = getAvatarColor(name);
        return (
          <View key={player.id || idx} style={styles.liveBarItem}>
            <View style={[styles.liveAvatar, { backgroundColor: bgColor }]}>
              <Text style={styles.liveAvatarText}>{getInitials(name)}</Text>
            </View>
            <Text style={styles.liveScore}>{player.score ?? 0}</Text>
          </View>
        );
      })}
    </View>
  );
};

/**
 * MultiplayerResults — Full results screen shown after game ends.
 * Props: multiplayer (from useMultiplayerSync)
 */
export const MultiplayerResults = ({ multiplayer }) => {
  const players = multiplayer?.state?.players
    || multiplayer?.state?.results?.leaderboard
    || multiplayer?.scores
    || [];

  // Sort by score descending
  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const getMedalIcon = (rank) => {
    if (rank === 0) return { name: 'medal', color: '#FFD700' };
    if (rank === 1) return { name: 'medal', color: '#C0C0C0' };
    if (rank === 2) return { name: 'medal', color: '#CD7F32' };
    return null;
  };

  return (
    <Animatable.View animation="fadeInUp" style={styles.resultsContainer}>
      <Icon name="trophy" size={56} color={colors.pulse} />
      <Text style={styles.resultsTitle}>Final Results</Text>

      <View style={styles.resultsList}>
        {sorted.map((player, idx) => {
          const name = player.username || player.name || `Player ${idx + 1}`;
          const bgColor = getAvatarColor(name);
          const medal = getMedalIcon(idx);
          const isWinner = idx === 0;

          return (
            <Animatable.View
              key={player.id || idx}
              animation="fadeInLeft"
              delay={idx * 100}
              style={[styles.resultRow, isWinner && styles.resultRowWinner]}
            >
              <Text style={styles.resultRank}>#{idx + 1}</Text>
              <View style={[styles.resultAvatar, { backgroundColor: bgColor }]}>
                <Text style={styles.resultAvatarText}>{getInitials(name)}</Text>
              </View>
              <Text style={styles.resultName} numberOfLines={1}>{name}</Text>
              {medal && (
                <Icon name={medal.name} size={20} color={medal.color} />
              )}
              <Text style={[styles.resultScore, isWinner && styles.resultScoreWinner]}>
                {player.score ?? 0}
              </Text>
            </Animatable.View>
          );
        })}
      </View>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  // Live Score Bar
  liveBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.lg,
    ...shadows.sm,
  },
  liveBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveAvatarText: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  liveScore: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },

  // Results
  resultsContainer: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  resultsTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  resultsList: {
    width: '100%',
    gap: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultRowWinner: {
    borderColor: colors.pulse,
    backgroundColor: colors.pulse + '10',
  },
  resultRank: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    width: 32,
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  resultName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    flex: 1,
  },
  resultScore: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  resultScoreWinner: {
    color: colors.pulse,
  },
});
