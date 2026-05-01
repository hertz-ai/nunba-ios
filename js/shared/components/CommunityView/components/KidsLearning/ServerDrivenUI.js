import React, {useState, useCallback, useRef, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import {
  kidsColors,
  kidsSpacing,
  kidsBorderRadius,
  kidsFontSize,
  kidsFontWeight,
  kidsShadows,
} from '../../../../theme/kidsColors';
import OptionButton from './shared/OptionButton';
import ProgressDots from './shared/ProgressDots';
import TimerBar from './shared/TimerBar';
import FeedbackOverlay from './shared/FeedbackOverlay';
import NumberPad from './shared/NumberPad';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// Default kids tokens — used when no themeTokens prop is provided
const DEFAULT_TOKENS = {
  colors: kidsColors,
  spacing: kidsSpacing,
  borderRadius: kidsBorderRadius,
  fontSizes: kidsFontSize,
  fontWeights: kidsFontWeight,
  shadows: kidsShadows,
};

/**
 * ServerDrivenUI - Renders dynamic UI from server JSON descriptors.
 *
 * The backend compute agent sends a JSON layout tree, and this component
 * maps each node to a native React Native component. This enables the server
 * to dynamically create templates, games, and UI without shipping new code.
 *
 * Rendering Modes:
 * 1. Layout mode: Pure UI from JSON (headers, cards, grids, text, buttons)
 * 2. Template mode: Game template with data binding + action callbacks
 * 3. Screen mode: Full screen layouts (custom hub, progress, etc.)
 *
 * JSON Node Schema:
 * {
 *   type: 'view' | 'text' | 'button' | 'icon' | 'image' | 'input' |
 *         'scroll' | 'row' | 'column' | 'grid' | 'card' | 'spacer' |
 *         'option-button' | 'progress-dots' | 'timer-bar' | 'feedback' |
 *         'number-pad' | 'animated' | 'conditional' | 'loop',
 *   props: { ... },           // Component-specific props
 *   style: { ... } | string,  // Inline style object or preset name
 *   children: [ ... ],        // Child nodes
 *   bind: string,             // Data binding path (e.g., "state.score")
 *   action: string,           // Action name on press/submit
 *   visible: string | bool,   // Conditional visibility (bind path or bool)
 *   animation: string,        // Animatable animation name
 *   key: string,              // React key for lists
 * }
 */

// Resolve a dot-path value from a data context
const FORBIDDEN_PATHS = new Set(['__proto__', 'constructor', 'prototype']);

const resolvePath = (obj, path) => {
  if (!path || !obj) return undefined;
  const parts = path.split('.');
  if (parts.length > 10) return undefined;
  let current = obj;
  for (const part of parts) {
    if (FORBIDDEN_PATHS.has(part)) return undefined;
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

/**
 * Build STYLE_PRESETS from theme tokens.
 *
 * @param {object} tokens - { colors, spacing, borderRadius, fontSizes, fontWeights, shadows }
 * @returns {object} Map of preset name → style object
 */
const buildStylePresets = ({colors, spacing, borderRadius, fontSizes, fontWeights, shadows}) => ({
  // Text styles
  title: {fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary},
  subtitle: {fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary},
  body: {fontSize: fontSizes.md, color: colors.textPrimary},
  caption: {fontSize: fontSizes.sm, color: colors.textSecondary},
  muted: {fontSize: fontSizes.xs, color: colors.textMuted},
  instruction: {fontSize: fontSizes.md, fontWeight: fontWeights.medium, color: colors.textSecondary, textAlign: 'center'},
  display: {fontSize: fontSizes.display, fontWeight: fontWeights.extrabold, color: colors.accent, textAlign: 'center'},
  correct: {fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.correct},
  incorrect: {fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.incorrect},

  // Layout styles
  centered: {justifyContent: 'center', alignItems: 'center'},
  padded: {padding: spacing.md},
  paddedLg: {padding: spacing.lg},
  row: {flexDirection: 'row', alignItems: 'center'},
  rowSpaced: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  column: {flexDirection: 'column'},
  wrap: {flexDirection: 'row', flexWrap: 'wrap'},
  flex1: {flex: 1},
  gap: {gap: spacing.md},
  gapSm: {gap: spacing.sm},
  gapLg: {gap: spacing.lg},

  // Card/surface styles
  card: {backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, ...(shadows.card || {})},
  cardAccent: {backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 2, borderColor: colors.accent, ...(shadows.card || {})},
  chip: {backgroundColor: colors.card, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border},
  banner: {backgroundColor: colors.hintBg || colors.backgroundTertiary, borderRadius: borderRadius.md, padding: spacing.md},

  // Button styles
  primaryBtn: {backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, ...(shadows.button || shadows.md || {})},
  secondaryBtn: {backgroundColor: colors.accentSecondary, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md},
  outlineBtn: {borderWidth: 2, borderColor: colors.accent, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md},
  dangerBtn: {backgroundColor: colors.incorrect || colors.error, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md},
  btnText: {fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.textOnDark, textAlign: 'center'},
  btnTextDark: {fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.accent, textAlign: 'center'},

  // Game-specific
  questionCard: {backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.lg, marginHorizontal: spacing.md, ...(shadows.float || shadows.lg || {})},
  optionGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', paddingHorizontal: spacing.md},
  hintBanner: {backgroundColor: colors.hintBg || colors.backgroundTertiary, borderRadius: borderRadius.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs},

  // Full background
  screenBg: {flex: 1, backgroundColor: colors.background},
  screenBgSecondary: {flex: 1, backgroundColor: colors.backgroundSecondary},
});

// Static kids presets (backward-compatible module-level constant)
const STYLE_PRESETS = buildStylePresets(DEFAULT_TOKENS);

/**
 * Resolve style: supports string preset names, arrays, and inline objects.
 * When colorMap is provided, $token lookups use it instead of kidsColors.
 *
 * @param {string|object|Array} style - Style descriptor
 * @param {object} [colorMap] - Color token map for $token resolution (defaults to kidsColors)
 * @param {object} [presets] - Style presets map (defaults to STYLE_PRESETS)
 * @returns {object|Array|undefined} Resolved style object(s)
 */
const resolveStyle = (style, colorMap, presets) => {
  const cm = colorMap || kidsColors;
  const pm = presets || STYLE_PRESETS;

  if (!style) return undefined;
  if (typeof style === 'string') {
    // Space-separated preset names
    const resolved = style.split(' ').map(s => pm[s]).filter(Boolean);
    return resolved.length === 1 ? resolved[0] : resolved;
  }
  if (Array.isArray(style)) {
    return style.map(s => resolveStyle(s, cm, pm));
  }
  // Map color tokens in inline styles
  if (typeof style === 'object') {
    const mapped = { ...(style ?? {}) };
    for (const key of Object.keys(mapped)) {
      if (typeof mapped[key] === 'string' && mapped[key].startsWith('$')) {
        const token = mapped[key].slice(1);
        if (!FORBIDDEN_PATHS.has(token) && Object.prototype.hasOwnProperty.call(cm, token)) {
          mapped[key] = cm[token];
        }
      }
    }
    return mapped;
  }
  return style;
};

/**
 * Build default styles from tokens (used for the StyleSheet defaults in RenderNode).
 */
const buildDefaultStyles = ({colors, spacing, borderRadius, fontSizes, fontWeights, shadows}) => ({
  defaultText: {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  defaultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...(shadows.button || shadows.md || {}),
  },
  defaultButtonText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.textOnDark,
  },
  defaultInput: {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  defaultCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...(shadows.card || {}),
  },
});

/**
 * RenderNode - Recursively renders a JSON UI node to native components.
 *
 * @param {object} node - JSON UI descriptor node
 * @param {object} data - Data context for bindings
 * @param {function} onAction - Callback when an action is triggered
 * @param {number} depth - Current nesting depth (safety limit)
 * @param {object} tokens - Theme tokens for this render tree
 * @param {object} presets - Prebuilt STYLE_PRESETS for these tokens
 * @param {object} defaultStyles - Prebuilt default styles for these tokens
 */
const MAX_LOOP_ITEMS = 100;

const RenderNode = ({node, data, onAction, depth = 0, tokens, presets, defaultStyles}) => {
  // Use fallback defaults when tokens not provided (backward compat)
  const tk = tokens || DEFAULT_TOKENS;
  const pm = presets || STYLE_PRESETS;
  const ds = defaultStyles || styles;

  if (!node || depth > 20) return null;

  // Validate node structure
  if (typeof node !== 'object' || (node.type && typeof node.type !== 'string')) return null;

  // Handle conditional visibility
  if (node.visible !== undefined) {
    const isVisible = typeof node.visible === 'string'
      ? !!resolvePath(data, node.visible)
      : node.visible;
    if (!isVisible) return null;
  }

  // Handle loop (repeat children for each item in a bound array)
  if (node.type === 'loop') {
    const rawItems = resolvePath(data, node.bind) || [];
    if (!Array.isArray(rawItems)) return null;
    const items = rawItems.length > MAX_LOOP_ITEMS ? rawItems.slice(0, MAX_LOOP_ITEMS) : rawItems;
    const template = node.children?.[0];
    if (!template) return null;
    return items.map((item, index) => (
      <RenderNode
        key={node.key ? `${node.key}-${index}` : index}
        node={{...template, key: `loop-${index}`}}
        data={{...data, item, index}}
        onAction={onAction}
        depth={depth + 1}
        tokens={tk}
        presets={pm}
        defaultStyles={ds}
      />
    ));
  }

  // Handle conditional rendering
  if (node.type === 'conditional') {
    const condition = resolvePath(data, node.bind);
    const branch = condition ? node.children?.[0] : node.children?.[1];
    if (!branch) return null;
    return <RenderNode node={branch} data={data} onAction={onAction} depth={depth + 1} tokens={tk} presets={pm} defaultStyles={ds} />;
  }

  // Resolve data binding for text content
  const boundValue = node.bind ? resolvePath(data, node.bind) : undefined;
  const style = resolveStyle(node?.style ?? {}, tk.colors, pm);
  const nodeProps = node.props || {};

  // Render children recursively
  const renderChildren = (children) => {
    if (!children || !Array.isArray(children)) return null;
    return children.map((child, i) => (
      <RenderNode
        key={child.key || `child-${i}`}
        node={child}
        data={data}
        onAction={onAction}
        depth={depth + 1}
        tokens={tk}
        presets={pm}
        defaultStyles={ds}
      />
    ));
  };

  const handlePress = () => {
    if (node.action && onAction) {
      onAction(node.action, {node, boundValue, ...nodeProps});
    }
  };

  switch (node.type) {
    case 'view':
    case 'column':
      return (
        <View style={[node.type === 'column' && {flexDirection: 'column'}, style]} {...nodeProps}>
          {renderChildren(node.children)}
        </View>
      );

    case 'row':
      return (
        <View style={[{flexDirection: 'row', alignItems: 'center'}, style]} {...nodeProps}>
          {renderChildren(node.children)}
        </View>
      );

    case 'grid': {
      const columns = nodeProps.columns || 2;
      return (
        <View style={[{flexDirection: 'row', flexWrap: 'wrap', gap: tk.spacing.sm}, style]}>
          {(node.children || []).map((child, i) => (
            <View key={child.key || `grid-${i}`} style={{width: `${100 / columns - 2}%`}}>
              <RenderNode node={child} data={data} onAction={onAction} depth={depth + 1} tokens={tk} presets={pm} defaultStyles={ds} />
            </View>
          ))}
        </View>
      );
    }

    case 'scroll':
      return (
        <ScrollView
          style={style}
          contentContainerStyle={resolveStyle(nodeProps.contentStyle, tk.colors, pm)}
          showsVerticalScrollIndicator={false}
          {...nodeProps}
        >
          {renderChildren(node.children)}
        </ScrollView>
      );

    case 'text':
      return (
        <Text
          style={[ds.defaultText, style]}
          numberOfLines={nodeProps.numberOfLines}
          adjustsFontSizeToFit={nodeProps.adjustsFontSizeToFit}
        >
          {boundValue !== undefined ? String(boundValue) : nodeProps.text || ''}
        </Text>
      );

    case 'button':
      return (
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.7}
          disabled={nodeProps.disabled}
          style={[ds.defaultButton, style]}
        >
          {nodeProps.icon && (
            <Icon name={nodeProps.icon} size={nodeProps.iconSize || 20} color={nodeProps.iconColor || tk.colors.textOnDark} />
          )}
          {nodeProps.text && (
            <Text style={[ds.defaultButtonText, resolveStyle(nodeProps.textStyle, tk.colors, pm)]}>
              {nodeProps.text}
            </Text>
          )}
          {renderChildren(node.children)}
        </TouchableOpacity>
      );

    case 'icon':
      return (
        <Icon
          name={boundValue || nodeProps.name || 'help-circle'}
          size={nodeProps.size || 24}
          color={nodeProps.color ? (nodeProps.color.startsWith('$') ? tk.colors[nodeProps.color.slice(1)] : nodeProps.color) : tk.colors.accent}
          style={style}
        />
      );

    case 'image':
      return (
        <Image
          source={nodeProps.uri ? {uri: boundValue || nodeProps.uri} : undefined}
          style={[{width: nodeProps.width || 100, height: nodeProps.height || 100, borderRadius: nodeProps.borderRadius || 0}, style]}
          resizeMode={nodeProps.resizeMode || 'contain'}
        />
      );

    case 'input':
      return (
        <TextInput
          style={[ds.defaultInput, style]}
          placeholder={nodeProps.placeholder || ''}
          placeholderTextColor={tk.colors.textMuted}
          value={boundValue !== undefined ? String(boundValue) : undefined}
          onChangeText={(text) => onAction && onAction(node.action || 'inputChange', {text, field: node.bind})}
          onSubmitEditing={() => node.action && onAction && onAction(node.action, {field: node.bind})}
          keyboardType={nodeProps.keyboardType || 'default'}
          multiline={nodeProps.multiline || false}
          numberOfLines={nodeProps.numberOfLines || 1}
          autoCapitalize={nodeProps.autoCapitalize || 'sentences'}
        />
      );

    case 'spacer':
      return <View style={[{height: nodeProps.size || tk.spacing.md}, style]} />;

    case 'divider':
      return <View style={[{height: 1, backgroundColor: tk.colors.border, marginVertical: tk.spacing.sm}, style]} />;

    case 'card':
      return (
        <TouchableOpacity
          activeOpacity={node.action ? 0.7 : 1}
          onPress={node.action ? handlePress : undefined}
          style={[ds.defaultCard, style]}
        >
          {renderChildren(node.children)}
        </TouchableOpacity>
      );

    // ── Kids Learning shared components ──
    // These remain unchanged — they use their own internal styling

    case 'option-button':
      return (
        <OptionButton
          label={boundValue || nodeProps.label || ''}
          icon={nodeProps.icon}
          color={nodeProps.color}
          selected={nodeProps.selected}
          correct={nodeProps.correct}
          disabled={nodeProps.disabled}
          onPress={handlePress}
        />
      );

    case 'progress-dots':
      return (
        <ProgressDots
          total={nodeProps.total || 10}
          current={boundValue || nodeProps.current || 0}
          results={nodeProps.results}
        />
      );

    case 'timer-bar':
      return (
        <TimerBar
          duration={nodeProps.duration || 30}
          running={nodeProps.running !== false}
          onTimeUp={() => onAction && onAction('timeUp')}
        />
      );

    case 'feedback':
      return (
        <FeedbackOverlay
          visible={boundValue !== undefined ? !!boundValue : !!nodeProps.visible}
          isCorrect={nodeProps.isCorrect || false}
          onDismiss={() => onAction && onAction('feedbackDismiss')}
        />
      );

    case 'number-pad':
      return (
        <NumberPad
          onNumber={(num) => onAction && onAction('numberPress', {number: num})}
          onDelete={() => onAction && onAction('numberDelete')}
          onSubmit={() => onAction && onAction('numberSubmit')}
        />
      );

    // ── Animation wrapper ──

    case 'animated':
      return (
        <Animatable.View
          animation={nodeProps.animation || 'fadeIn'}
          duration={nodeProps.duration || 500}
          delay={nodeProps.delay || 0}
          iterationCount={nodeProps.loop ? 'infinite' : 1}
          style={style}
        >
          {renderChildren(node.children)}
        </Animatable.View>
      );

    default:
      // Unknown type - render as View container
      return (
        <View style={style}>
          {renderChildren(node.children)}
        </View>
      );
  }
};

/**
 * ServerDrivenUI - Main component for rendering server-defined layouts.
 *
 * Props:
 * - layout: JSON layout tree from server
 * - data: Data context for bindings (state, config, etc.)
 * - onAction: Callback when user interacts (action name, payload)
 * - style: Additional container style
 * - themeTokens: Optional theme tokens { colors, spacing, borderRadius, fontSizes, fontWeights, shadows }
 *               When omitted, defaults to kids theme (backward compatible)
 */
const ServerDrivenUI = ({layout, data = {}, onAction, style, themeTokens}) => {
  if (!layout) return null;

  // Memoize derived presets and default styles so they only rebuild when tokens change
  const tokens = themeTokens || DEFAULT_TOKENS;
  const presets = useMemo(() => buildStylePresets(tokens), [tokens]);
  const defaultStyles = useMemo(() => buildDefaultStyles(tokens), [tokens]);

  return (
    <View style={[styles.container, style]}>
      <RenderNode
        node={layout}
        data={data}
        onAction={onAction}
        tokens={tokens}
        presets={presets}
        defaultStyles={defaultStyles}
      />
    </View>
  );
};

// Export both the main component and utilities for flexibility
export {RenderNode, resolvePath, STYLE_PRESETS, resolveStyle, buildStylePresets, buildDefaultStyles, DEFAULT_TOKENS};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  defaultText: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textPrimary,
  },
  defaultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    backgroundColor: kidsColors.accent,
    paddingHorizontal: kidsSpacing.lg,
    paddingVertical: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg,
    ...kidsShadows.button,
  },
  defaultButtonText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
  defaultInput: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textPrimary,
    borderWidth: 1,
    borderColor: kidsColors.border,
    borderRadius: kidsBorderRadius.md,
    padding: kidsSpacing.md,
    backgroundColor: kidsColors.card,
  },
  defaultCard: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.lg,
    padding: kidsSpacing.md,
    ...kidsShadows.card,
  },
});

export default ServerDrivenUI;
