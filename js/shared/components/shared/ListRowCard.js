/**
 * ListRowCard — LinkedIn-compact row card.  Avatar | body | trailing
 * meta + optional provenance chip.  Stagger-fades on mount via the
 * row index so a fresh inbox feels alive, not janky.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { colors, spacing, TIMINGS } from '../../theme/colors';
import AvatarBadged from './AvatarBadged';
import UnreadDot from './UnreadDot';
import ProvenanceChip from './ProvenanceChip';

const ListRowCard = ({
  index = 0,
  senderName,
  senderUri,
  isAgent = false,
  isSpeaking = false,
  title,
  preview,
  channelType,
  parentLabel,
  isUnread = false,
  trailingTime,
  onPress,
  onLongPress,
}) => (
  <Animatable.View
    animation="fadeInUp"
    duration={TIMINGS.fadeMs}
    delay={Math.min(index, 12) * TIMINGS.staggerMs}
    useNativeDriver
  >
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={TIMINGS.longPressMs}
      style={styles.card}
      accessibilityRole="button"
    >
      <View style={styles.unreadSlot}>
        <UnreadDot visible={isUnread} />
      </View>
      <View style={styles.avatarSlot}>
        <AvatarBadged
          name={senderName}
          uri={senderUri}
          isAgent={isAgent}
          isSpeaking={isSpeaking}
        />
      </View>
      <View style={styles.body}>
        <View style={styles.row1}>
          <Text style={styles.name} numberOfLines={1}>
            {senderName || 'Someone'}
          </Text>
          {trailingTime ? (
            <Text style={styles.time}>{trailingTime}</Text>
          ) : null}
        </View>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        ) : null}
        {preview ? (
          <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
        ) : null}
        {(channelType || parentLabel) ? (
          <View style={styles.chipRow}>
            <ProvenanceChip
              channelType={channelType}
              parentLabel={parentLabel}
              compact
            />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  </Animatable.View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  unreadSlot: {
    width: 12,
    paddingTop: 18,
    alignItems: 'center',
  },
  avatarSlot: {
    marginRight: spacing.md,
    marginLeft: spacing.xs,
  },
  body: { flex: 1 },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  time: {
    color: colors.textMuted,
    fontSize: 11,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  preview: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  chipRow: { marginTop: 6 },
});

export default ListRowCard;
