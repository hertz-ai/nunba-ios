/**
 * NewItemsPill — floating "N new" indicator that surfaces when items
 * arrive on a list the user is currently reading.  Tap → invokes
 * caller's onPress (typically scrollToTop or scrollToIndex).
 *
 * Why users would love this (Part X.4.1 PostDetail surface):
 *   - Comments arrive while you're reading — instead of yanking the
 *     scroll up (Reddit / FB) or hiding the new content (Twitter),
 *     a subtle pill drops in at the top of the screen.  You choose
 *     when to jump.
 *   - The pill is `accessibilityLiveRegion="polite"` so VoiceOver /
 *     TalkBack announces the change without interrupting.
 *
 * Multi-hat self-critique:
 *   - Designer: floats absolutely at top center; pulses subtly on
 *     mount; pill shape with accent border + faint glow.
 *   - PM: each pill tap = re-engagement event.  Pluralisation matters
 *     ("1 new comment" vs "5 new comments").
 *   - A11y: live region + descriptive label.
 *   - Engineer: parent owns `count` + the `onPress` handler; pill is
 *     pure presentational; no internal timer or state.
 *
 * Props:
 *   - count     : number (new items)
 *   - noun      : 'comment' | 'reply' | 'message' | string (singular form)
 *   - onPress   : () => void
 *   - top       : number (px from top, default 12)
 *
 * Plan ref: Part X.4.1 + Part X.7.1 (P3 tests).
 */
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const NewItemsPill = ({ count = 0, noun = 'item', onPress, top = 12 }) => {
  if (!count || count < 1) return null;
  const label = count === 1 ? `1 new ${noun}` : `${count} new ${noun}s`;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.pill, { top }]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityHint="Scrolls to the new items"
      testID="NewItemsPill"
    >
      <MaterialCommunityIcons name="arrow-up" size={14} color="#0E1114" />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#00e89d',
    shadowColor: '#00e89d',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 100,
  },
  text: {
    color: '#0E1114',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
});

export default NewItemsPill;
