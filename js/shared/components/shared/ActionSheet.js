/**
 * ActionSheet — Discord-style bottom sheet for row long-press actions.
 * Renders nothing visible when `visible=false`; the parent owns state.
 * Tapping any action closes the sheet *before* invoking the handler so
 * the handler can navigate without racing the dismiss animation.
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius } from '../../theme/colors';

const ActionSheet = ({ visible = false, title, actions = [], onClose }) => (
  <Modal
    transparent
    visible={visible}
    animationType="fade"
    onRequestClose={onClose}
  >
    <Pressable style={styles.scrim} onPress={onClose}>
      <Animatable.View
        animation="slideInUp"
        duration={220}
        useNativeDriver
        style={styles.sheet}
        // stop scrim taps from bubbling
        onStartShouldSetResponder={() => true}
      >
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {actions.map((a, i) => (
          <TouchableOpacity
            key={a.key || `${a.label}-${i}`}
            onPress={() => {
              if (onClose) onClose();
              if (a.onPress) a.onPress();
            }}
            style={styles.row}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            {a.icon ? (
              <MaterialCommunityIcons
                name={a.icon}
                size={20}
                color={a.destructive ? colors.error : colors.textPrimary}
                style={styles.icon}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                a.destructive && styles.labelDestructive,
              ]}
            >
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={onClose}
          style={[styles.row, styles.cancelRow]}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={[styles.label, styles.cancelLabel]}>Cancel</Text>
        </TouchableOpacity>
      </Animatable.View>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  title: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
  },
  icon: { marginRight: 12 },
  label: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  labelDestructive: {
    color: colors.error,
  },
  cancelRow: {
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelLabel: {
    color: colors.textMuted,
    fontWeight: '600',
  },
});

export default ActionSheet;
