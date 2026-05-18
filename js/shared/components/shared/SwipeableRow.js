/**
 * SwipeableRow — wraps any list row in a horizontal swipe gesture
 * exposing a leftAction (revealed by swiping RIGHT) and/or a
 * rightAction (revealed by swiping LEFT).  iOS Mail / Instagram /
 * Slack pattern.
 *
 * Why users would love this (Part X.4.4 Communication surface):
 *   - One swipe = one action.  Two taps (long-press → menu →
 *     option) is gone.  At inbox-zero velocity this saves seconds
 *     per row × 30 rows = 30 s per session.
 *   - Left-of-row action visualisation (color + icon) tells the
 *     user what swipe direction means BEFORE they commit — vs
 *     hidden gestures (Reddit) where you discover by trying.
 *
 * Multi-hat self-critique (Part X.2):
 *   - Designer: action backgrounds use intent colour (red for
 *     destructive archive/mute, accent for positive pin/save) so
 *     swipe direction has unambiguous semantic.
 *   - PM: each swipe = retention event (the user just cleared
 *     their list).
 *   - A11y: swipes are gestural — VoiceOver users get a long-press
 *     fallback via the `onLongPress` prop that callers can wire to
 *     an ActionSheet listing the same actions.
 *   - Engineer: pure presentational wrapper over react-native-gesture-handler
 *     `Swipeable`.  Caller owns the action handlers; no internal
 *     state beyond the gesture's own.
 *   - Trust & Safety: destructive actions (archive, mute) should
 *     have a server-side undo path; not the swipe's job.
 *
 * Props:
 *   - leftAction?  : { label, icon, color, onPress } — revealed by swipe-RIGHT
 *   - rightAction? : { label, icon, color, onPress } — revealed by swipe-LEFT
 *   - onLongPress? : a11y fallback (caller opens an ActionSheet)
 *   - children     : the row content (typically a ListRowCard)
 *
 * Plan ref: Part X.4.4 + Part X.7.1 (P4 tests).
 */
import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Dynamic require — Swipeable is from react-native-gesture-handler.
// We keep the require lazy so jest tests that don't need actual
// swipe behaviour can render the row content without pulling the
// native module.
let Swipeable = null;
try {
  // eslint-disable-next-line global-require
  Swipeable = require('react-native-gesture-handler').Swipeable;
} catch (_e) {
  Swipeable = null;
}

const renderAction = (action, side) => () => {
  if (!action) return null;
  const { label, icon, color = '#666', onPress } = action;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.action, side === 'left' ? styles.actionLeft : styles.actionRight, { backgroundColor: color }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`SwipeableRow.action.${side}`}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={20} color="#FFF" />
      ) : null}
      {label ? <Text style={styles.actionLabel}>{label}</Text> : null}
    </TouchableOpacity>
  );
};

const SwipeableRow = ({ leftAction, rightAction, onLongPress, children, testID = 'SwipeableRow' }) => {
  const swipeableRef = useRef(null);

  const handleLeftAction = useCallback(() => {
    if (leftAction?.onPress) leftAction.onPress();
    swipeableRef.current?.close?.();
  }, [leftAction]);

  const handleRightAction = useCallback(() => {
    if (rightAction?.onPress) rightAction.onPress();
    swipeableRef.current?.close?.();
  }, [rightAction]);

  // Fallback when Swipeable is unavailable (jest tests without the
  // native module): render children + a long-press handler that the
  // caller wires to its own ActionSheet for a11y parity.
  if (!Swipeable) {
    return (
      <View testID={`${testID}.fallback`}>
        <TouchableOpacity
          onLongPress={onLongPress}
          activeOpacity={1}
          accessibilityRole="button"
        >
          {children}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={leftAction ? renderAction({ ...leftAction, onPress: handleLeftAction }, 'left') : undefined}
      renderRightActions={rightAction ? renderAction({ ...rightAction, onPress: handleRightAction }, 'right') : undefined}
      onSwipeableLeftOpen={handleLeftAction}
      onSwipeableRightOpen={handleRightAction}
    >
      <View testID={testID}>
        <TouchableOpacity
          onLongPress={onLongPress}
          activeOpacity={1}
          accessibilityRole="button"
        >
          {children}
        </TouchableOpacity>
      </View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    minWidth: 96,
  },
  actionLeft: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  actionRight: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
});

export default SwipeableRow;
