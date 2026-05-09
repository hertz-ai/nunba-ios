/**
 * AvatarBadged — initials-or-image avatar with optional agent badge
 * and Discord-style speaking ring.
 *
 * Why: agents and humans share the inbox; the badge lets a user tell
 * them apart at a glance, and the speaking ring lets a live voice/video
 * call surface "who is talking right now" without an extra row.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, getAgentPalette } from '../../theme/colors';

const initialsOf = (name) => {
  const cleaned = String(name || '').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map(p => p[0] || '').join('').toUpperCase() || '?';
};

const AvatarBadged = ({
  name,
  uri,
  isAgent = false,
  isSpeaking = false,
  size = 44,
}) => {
  const palette = getAgentPalette(name);
  const half = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      {isSpeaking ? (
        <Animatable.View
          animation={{
            0: { scale: 1, opacity: 0.75 },
            1: { scale: 1.35, opacity: 0 },
          }}
          iterationCount="infinite"
          duration={1200}
          easing="ease-out"
          useNativeDriver
          style={[
            styles.ring,
            {
              width: size, height: size, borderRadius: half,
              borderColor: colors.success,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.circle,
          {
            width: size, height: size, borderRadius: half,
            backgroundColor: palette.bg,
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: half }}
          />
        ) : (
          <Text
            style={[
              styles.initials,
              { fontSize: size * 0.36, color: palette.accent },
            ]}
          >
            {initialsOf(name)}
          </Text>
        )}
      </View>
      {isAgent ? (
        <View style={styles.agentBadge}>
          <MaterialCommunityIcons name="robot" size={10} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '700',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  agentBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
});

export default AvatarBadged;
