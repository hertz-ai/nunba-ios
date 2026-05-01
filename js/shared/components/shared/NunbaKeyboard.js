/**
 * NunbaKeyboard — The Hyve agent's touchscreen skin.
 *
 * A floating custom soft keyboard overlay for mobile/tablet devices.
 * Features:
 *  - Agent suggestion row at top (powered by chatApi)
 *  - QWERTY alpha layout, numeric pad, symbols
 *  - Nunba-themed with design tokens
 *  - Animated slide-up from bottom
 *  - Quick-action buttons (Ask Nunba, voice, dismiss)
 *  - Haptic feedback on keypress (if available)
 *
 * Rendered at navigator root level (like LiquidOverlay).
 * Triggered by: store.show({ onChangeText, onSubmit, initialText })
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Keyboard,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

import useNunbaKeyboardStore from '../../nunbaKeyboardStore';
import useLiquidOverlayStore from '../../liquidOverlayStore';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  GRADIENTS,
  getAgentPalette,
} from '../../theme/colors';

// Try importing haptics (optional dep)
let ReactNativeHapticFeedback = null;
try {
  ReactNativeHapticFeedback = require('react-native-haptic-feedback').default;
} catch (_) {}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const KEY_GAP = 4;
const KEYS_PER_ROW = [10, 9, 7]; // QWERTY row lengths
const KEY_WIDTH = (SCREEN_WIDTH - spacing.sm * 2 - KEY_GAP * 11) / 10;
const KEY_HEIGHT = 44;

// ── Key Layouts ──

const ALPHA_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const NUMERIC_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
  ['.', ',', '?', '!', "'", '#', '%', '+'],
];

const SYMBOL_ROWS = [
  ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
  ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '·'],
  ['.', ',', '?', '!', "'", '`', '…'],
];

// ── Helper ──

const triggerHaptic = () => {
  if (ReactNativeHapticFeedback) {
    try {
      ReactNativeHapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch (_) {}
  }
};

// ── Sub-components ──

const SuggestionRow = React.memo(({ suggestions, loading, onAccept }) => {
  if (!suggestions.length && !loading) return null;
  return (
    <View style={styles.suggestionRow}>
      {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestionScroll}
        keyboardShouldPersistTaps="always"
      >
        {suggestions.map((s, i) => (
          <TouchableOpacity
            key={`${s}_${i}`}
            style={styles.suggestionChip}
            activeOpacity={0.7}
            onPress={() => { triggerHaptic(); onAccept(s); }}
          >
            <Text style={styles.suggestionText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

const KeyButton = React.memo(({ label, onPress, width, style, textStyle, icon, iconSet }) => {
  const IconComponent = iconSet === 'ionicons' ? Ionicons : Icon;
  return (
    <TouchableOpacity
      style={[styles.key, width && { width }, style]}
      activeOpacity={0.5}
      onPress={() => { triggerHaptic(); onPress(); }}
    >
      {icon ? (
        <IconComponent name={icon} size={20} color={textStyle?.color || colors.textPrimary} />
      ) : (
        <Text style={[styles.keyText, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
});

// ── Main Component ──

const NunbaKeyboard = () => {
  const slideAnim = useRef(new Animated.Value(300)).current;

  // Store selectors
  const visible = useNunbaKeyboardStore((s) => s.visible);
  const mode = useNunbaKeyboardStore((s) => s.mode);
  const shift = useNunbaKeyboardStore((s) => s.shift);
  const capsLock = useNunbaKeyboardStore((s) => s.capsLock);
  const suggestions = useNunbaKeyboardStore((s) => s.suggestions);
  const suggestionsLoading = useNunbaKeyboardStore((s) => s.suggestionsLoading);
  const text = useNunbaKeyboardStore((s) => s.text);
  const placeholder = useNunbaKeyboardStore((s) => s.placeholder);

  const dismiss = useNunbaKeyboardStore((s) => s.dismiss);
  const pressKey = useNunbaKeyboardStore((s) => s.pressKey);
  const pressBackspace = useNunbaKeyboardStore((s) => s.pressBackspace);
  const pressSpace = useNunbaKeyboardStore((s) => s.pressSpace);
  const pressEnter = useNunbaKeyboardStore((s) => s.pressEnter);
  const setMode = useNunbaKeyboardStore((s) => s.setMode);
  const toggleShift = useNunbaKeyboardStore((s) => s.toggleShift);
  const acceptSuggestion = useNunbaKeyboardStore((s) => s.acceptSuggestion);

  // LiquidOverlay store — "Ask Nunba" button opens the overlay
  const showOverlay = useLiquidOverlayStore((s) => s.show);

  const palette = useMemo(() => getAgentPalette('Nunba'), []);

  // ── Animate in/out ──
  useEffect(() => {
    if (visible) {
      // Dismiss system keyboard first
      Keyboard.dismiss();
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 50,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // ── Get rows for current mode ──
  const rows = useMemo(() => {
    if (mode === 'numeric') return NUMERIC_ROWS;
    if (mode === 'symbols') return SYMBOL_ROWS;
    return ALPHA_ROWS;
  }, [mode]);

  // ── Key display (shift/caps) ──
  const displayChar = useCallback((char) => {
    if (mode !== 'alpha') return char;
    return (shift || capsLock) ? char.toUpperCase() : char;
  }, [mode, shift, capsLock]);

  const handleAskNunba = useCallback(() => {
    dismiss();
    showOverlay(null, {}, 'Nunba');
  }, [dismiss, showOverlay]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* ── Agent branding bar ── */}
      <View style={styles.brandBar}>
        <View style={styles.brandLeft}>
          <View style={[styles.miniAvatar, { backgroundColor: palette.bg }]}>
            <Text style={[styles.miniAvatarText, { color: palette.accent }]}>N</Text>
          </View>
          <Text style={styles.brandText}>Nunba</Text>
          {capsLock && (
            <View style={styles.capsIndicator}>
              <Text style={styles.capsIndicatorText}>CAPS</Text>
            </View>
          )}
        </View>
        <View style={styles.brandRight}>
          <TouchableOpacity
            style={styles.brandAction}
            onPress={handleAskNunba}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="creation" size={18} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.brandAction}
            onPress={dismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="keyboard-close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Suggestion row ── */}
      <SuggestionRow
        suggestions={suggestions}
        loading={suggestionsLoading}
        onAccept={acceptSuggestion}
      />

      {/* ── Text preview bar ── */}
      <View style={styles.previewBar}>
        <Text
          style={[styles.previewText, !text && { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {text || placeholder}
        </Text>
      </View>

      {/* ── Key rows ── */}
      {rows.map((row, rowIdx) => (
        <View key={`row_${rowIdx}`} style={styles.keyRow}>
          {/* Shift / Symbol toggle on row 2 (left side) */}
          {rowIdx === 2 && mode === 'alpha' && (
            <KeyButton
              icon={capsLock ? 'arrow-up-bold-box' : shift ? 'arrow-up-bold' : 'arrow-up-bold-outline'}
              onPress={toggleShift}
              width={KEY_WIDTH * 1.4}
              style={[
                styles.specialKey,
                (shift || capsLock) && { backgroundColor: colors.accent + '30' },
              ]}
              textStyle={{ color: (shift || capsLock) ? colors.accent : colors.textSecondary }}
            />
          )}
          {rowIdx === 2 && mode !== 'alpha' && (
            <KeyButton
              label={mode === 'numeric' ? '#+=': 'ABC'}
              onPress={() => setMode(mode === 'numeric' ? 'symbols' : 'alpha')}
              width={KEY_WIDTH * 1.4}
              style={styles.specialKey}
              textStyle={styles.specialKeyText}
            />
          )}

          {row.map((char) => (
            <KeyButton
              key={char}
              label={displayChar(char)}
              onPress={() => pressKey(char)}
              width={KEY_WIDTH}
            />
          ))}

          {/* Backspace on row 2 (right side) */}
          {rowIdx === 2 && (
            <KeyButton
              icon="backspace-outline"
              onPress={pressBackspace}
              width={KEY_WIDTH * 1.4}
              style={styles.specialKey}
              textStyle={{ color: colors.textSecondary }}
            />
          )}
        </View>
      ))}

      {/* ── Bottom row: mode toggle, space, enter ── */}
      <View style={styles.keyRow}>
        <KeyButton
          label={mode === 'alpha' ? '123' : 'ABC'}
          onPress={() => setMode(mode === 'alpha' ? 'numeric' : 'alpha')}
          width={KEY_WIDTH * 1.2}
          style={styles.specialKey}
          textStyle={styles.specialKeyText}
        />
        <KeyButton
          icon="emoticon-outline"
          onPress={() => {
            // Future: emoji picker
            triggerHaptic();
          }}
          width={KEY_WIDTH}
          style={styles.specialKey}
          textStyle={{ color: colors.textSecondary }}
        />
        <KeyButton
          label="space"
          onPress={pressSpace}
          width={SCREEN_WIDTH - spacing.sm * 2 - KEY_GAP * 6 - KEY_WIDTH * 1.2 - KEY_WIDTH - KEY_WIDTH * 1.8}
          style={styles.spaceKey}
          textStyle={styles.spaceKeyText}
        />
        <KeyButton
          icon="keyboard-return"
          onPress={pressEnter}
          width={KEY_WIDTH * 1.8}
          style={styles.enterKey}
          textStyle={{ color: colors.textOnDark }}
        />
      </View>

      {/* ── Safe area bottom padding ── */}
      {Platform.OS === 'ios' && <View style={{ height: 20 }} />}
    </Animated.View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.xs : spacing.sm,
    ...shadows.xl,
    zIndex: 9999,
    elevation: 50,
  },

  // ── Brand bar ──
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 11,
    fontWeight: fontWeight.extrabold,
  },
  brandText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
  },
  capsIndicator: {
    backgroundColor: colors.accent + '25',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  capsIndicatorText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  brandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandAction: {
    padding: 4,
  },

  // ── Suggestion row ──
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionScroll: {
    gap: 8,
    paddingRight: spacing.sm,
  },
  suggestionChip: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  suggestionText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // ── Preview bar ──
  previewBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  previewText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
  },

  // ── Key rows ──
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginVertical: KEY_GAP / 2,
    gap: KEY_GAP,
  },

  // ── Individual key ──
  key: {
    height: KEY_HEIGHT,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  keyText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },

  // ── Special keys ──
  specialKey: {
    backgroundColor: colors.backgroundTertiary,
  },
  specialKeyText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // ── Space key ──
  spaceKey: {
    backgroundColor: colors.card,
  },
  spaceKeyText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textTransform: 'lowercase',
  },

  // ── Enter key ──
  enterKey: {
    backgroundColor: colors.accent,
  },
});

export default NunbaKeyboard;
