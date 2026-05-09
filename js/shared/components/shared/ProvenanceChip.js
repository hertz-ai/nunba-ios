/**
 * ProvenanceChip — platform-colored chip showing where a row originated
 * (Discord, WhatsApp, Slack, ...) so the unified inbox stays glanceable.
 *
 * Renders nothing when neither channelType nor parentLabel is supplied —
 * that lets call sites drop it in unconditionally without an outer guard.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { platformColor, colors } from '../../theme/colors';

const PLATFORM_LABELS = {
  discord:    'Discord',
  whatsapp:   'WhatsApp',
  slack:      'Slack',
  matrix:     'Matrix',
  teams:      'Teams',
  telegram:   'Telegram',
  email:      'Email',
  livekit:    'Live call',
  hevolve:    'Nunba',
  nunba:      'Nunba',
  hevolveai:  'Nunba',
};

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const ProvenanceChip = ({ channelType, parentLabel, compact = false }) => {
  if (!channelType && !parentLabel) return null;
  const platform = channelType
    ? String(channelType).split(':')[0].toLowerCase()
    : null;
  const label =
    parentLabel ||
    (platform && PLATFORM_LABELS[platform]) ||
    titleCase(platform) ||
    'Channel';
  const color = platform ? platformColor(channelType) : colors.accent;
  return (
    <View
      style={[
        styles.chip,
        compact && styles.chipCompact,
        { borderColor: color, backgroundColor: color + '22' },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipCompact: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 140,
  },
});

export default ProvenanceChip;
