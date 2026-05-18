/**
 * ReactionsStrip — horizontal row of emoji + count chips for a post
 * or comment.  Tap a chip → toggles the viewer's reaction with that
 * emoji.  Optimistic via services/optimistic — UI flips immediately,
 * server confirms in the background.
 *
 * Why users would love this (Part X.4.1 PostDetail surface):
 *   - One glance shows the social temperature: 12 ❤️ · 4 🚀 · 1 🔥.
 *   - Tap a chip to join the reaction — same emoji acts as both
 *     "see who reacted" and "react yourself".  No separate picker.
 *   - The "+" chip opens the full picker for novel emoji.
 *
 * Multi-hat self-critique (Part X.2):
 *   - Designer: chips are 36px tall (≥ 44pt hit slop via hitSlop), small
 *     font + emoji prominent so the emoji carries the meaning.
 *   - PM: each chip = lightweight social proof; tapping = engagement.
 *   - A11y: accessibilityLabel="reaction <emoji> <count>", role=button,
 *     accessibilityState.selected reflects own-reaction.
 *   - Engineer: caller controls state; ReactionsStrip is pure
 *     presentational + a single onToggleReaction(emoji) callback.
 *   - Trust & Safety: emoji picker is constrained to a fixed allowlist;
 *     no free-form text (skin tone variations belong in profile).
 *
 * Props:
 *   - reactions     : Array<{ emoji: string, count: number, mine?: boolean }>
 *   - onToggle      : (emoji: string) => Promise (resolves on success)
 *   - onPickerOpen  : () => void  (caller opens an ActionSheet/Modal of more emoji)
 *
 * Plan ref: Part X.4.1 + Part X.7.1 (P3 tests).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { optimistic } from '../../services/optimistic';

const ACCENT = '#00e89d';
const BG_DARK = '#1A1A2E';
const BG_DARK_MINE = '#00e89d22';
const TEXT_LIGHT = '#FFFFFF';
const TEXT_MUTED = '#AAAAAA';

const ReactionsStrip = ({
  reactions = [],
  onToggle,
  onPickerOpen,
  testID = 'ReactionsStrip',
}) => {
  // Local override map: emoji → {count, mine} for optimistic flips
  // (caller can also pass updated reactions array; we prefer the
  // local override if present so taps flip instantly without
  // waiting for the parent to re-render).
  const [overrides, setOverrides] = useState({});

  const handleTap = useCallback(
    (emoji, isMine, count) => {
      const next = !isMine;
      const delta = next ? +1 : -1;
      const prev = { count, mine: isMine };

      optimistic({
        apply: () => {
          setOverrides((o) => ({
            ...o,
            [emoji]: { count: count + delta, mine: next },
          }));
        },
        request: () => (typeof onToggle === 'function' ? Promise.resolve(onToggle(emoji)) : Promise.resolve()),
        rollback: () => {
          setOverrides((o) => ({ ...o, [emoji]: prev }));
        },
        errorToast: next ? "Couldn't add reaction — try again" : "Couldn't remove reaction — try again",
        successHaptic: next ? 'light' : null,
      });
    },
    [onToggle],
  );

  if (!Array.isArray(reactions) || reactions.length === 0) {
    // Empty state: just the "+" picker affordance.
    return (
      <View style={styles.row} testID={`${testID}.empty`}>
        <TouchableOpacity
          onPress={onPickerOpen}
          style={styles.addChip}
          accessibilityRole="button"
          accessibilityLabel="Add a reaction"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          testID={`${testID}.add`}
        >
          <MaterialCommunityIcons name="emoticon-happy-outline" size={18} color={TEXT_MUTED} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID={testID}
    >
      {reactions.map((r) => {
        const o = overrides[r.emoji];
        const count = o ? o.count : (r.count || 0);
        const mine = o ? o.mine : !!r.mine;
        return (
          <TouchableOpacity
            key={r.emoji}
            onPress={() => handleTap(r.emoji, mine, count)}
            style={[styles.chip, mine && styles.chipMine]}
            accessibilityRole="button"
            accessibilityLabel={`reaction ${r.emoji} ${count}`}
            accessibilityState={{ selected: mine }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            testID={`${testID}.chip.${r.emoji}`}
          >
            <Text style={styles.emoji}>{r.emoji}</Text>
            <Text style={[styles.count, mine && styles.countMine]}>{count}</Text>
          </TouchableOpacity>
        );
      })}

      {/* "+" picker — opens the full emoji ActionSheet */}
      <TouchableOpacity
        onPress={onPickerOpen}
        style={styles.addChip}
        accessibilityRole="button"
        accessibilityLabel="Add a different reaction"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        testID={`${testID}.add`}
      >
        <MaterialCommunityIcons name="plus" size={16} color={TEXT_MUTED} />
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: BG_DARK,
    marginRight: 6,
  },
  chipMine: {
    backgroundColor: BG_DARK_MINE,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  emoji: {
    fontSize: 14,
    marginRight: 4,
  },
  count: {
    color: TEXT_LIGHT,
    fontSize: 12,
    fontWeight: '600',
  },
  countMine: {
    color: ACCENT,
  },
  addChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BG_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ReactionsStrip;
