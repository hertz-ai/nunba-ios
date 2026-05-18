/**
 * OpenStatusDot — small colored dot signaling user presence.
 *
 *   - 'online'    → green
 *   - 'in_call'   → yellow (active call)
 *   - 'idle'      → soft gray
 *   - 'offline'   → invisible (component returns null)
 *
 * Default size 10 px.  Suitable for positioning in the bottom-right of
 * an avatar (caller wraps in absolutely-positioned container).  Adds a
 * thin dark border so the dot reads cleanly on light backgrounds.
 *
 * Plan ref: Part X.3.2 (sunny-gliding-eich.md).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';

const COLOR_BY_STATUS = {
  online: '#27D17E',
  in_call: '#F5C842',
  idle: '#888888',
  offline: null,
};

const LABEL_BY_STATUS = {
  online: 'Online',
  in_call: 'In a call',
  idle: 'Idle',
  offline: 'Offline',
};

const OpenStatusDot = ({
  status = 'offline',
  size = 10,
  borderColor = '#0E1114',
}) => {
  const color = COLOR_BY_STATUS[status];
  if (!color) return null;
  const borderWidth = Math.max(1, Math.round(size / 6));
  return (
    <View
      testID={`OpenStatusDot.${status}`}
      accessibilityLabel={LABEL_BY_STATUS[status] || status}
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderColor,
          borderWidth,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  dot: {},
});

export default OpenStatusDot;
