/**
 * Nunba / Hevolve unified dark theme — aligned with web socialTokens.js
 * Used across all social, gamification, and agent components.
 */
import { Easing } from 'react-native';

export const colors = {
  // Backgrounds (aligned with web: #0F0E17 / #1A1932)
  background: '#0F0E17',
  backgroundSecondary: '#1A1932',
  backgroundTertiary: '#252542',
  card: '#1F1E36',
  cardHover: '#2A2950',

  // Text
  textPrimary: '#FFFFFE',
  textSecondary: 'rgba(255,255,254,0.72)',
  textMuted: 'rgba(255,255,254,0.45)',
  textDisabled: 'rgba(255,255,254,0.28)',
  textOnDark: '#FFFFFF',

  // Currency colors (Resonance system)
  pulse: '#FFD700',       // Gold - reputation
  spark: '#FF6B6B',       // Coral - creative energy
  signal: '#00D9FF',      // Cyan - governance trust
  xp: '#10B981',          // Emerald - experience

  // Level tier colors
  levelGreen: '#10B981',    // 1-10
  levelBlue: '#3B82F6',     // 11-25
  levelPurple: '#8B5CF6',   // 26-40
  levelGold: '#F59E0B',     // 41+
  levelLegend: '#EC4899',   // 50+

  // Rarity colors
  rarityCommon: '#6B7280',
  rarityUncommon: '#10B981',
  rarityRare: '#3B82F6',
  rarityLegendary: '#F59E0B',

  // Status colors (aligned with web palette)
  success: '#2ECC71',
  successLight: '#A8E6CF',
  warning: '#FFAB00',
  warningLight: '#FFD740',
  error: '#e74c3c',
  errorLight: '#FF7675',
  info: '#00B8D9',
  infoLight: '#79E2F2',

  // Campaign status
  campaignDraft: '#6B7280',
  campaignActive: '#2ECC71',
  campaignPaused: '#FFAB00',
  campaignCompleted: '#3B82F6',

  // Region tiers
  regionMember: '#6B7280',
  regionContributor: '#2ECC71',
  regionModerator: '#3B82F6',
  regionAdmin: '#8B5CF6',
  regionSteward: '#F59E0B',

  // Season tiers
  tierBronze: '#CD7F32',
  tierSilver: '#C0C0C0',
  tierGold: '#FFD700',
  tierPlatinum: '#E5E4E2',

  // Accent colors (aligned with web primary/secondary)
  accent: '#6C63FF',           // Aspiration violet (web primary)
  accentLight: '#9B94FF',
  accentDark: '#4A42CC',
  accentSecondary: '#FF6B6B',  // Coral (web secondary)
  accentTertiary: '#EC4899',

  // Gradients (as arrays for react-native-linear-gradient)
  gradientPulse: ['#FFD700', '#FFA500'],
  gradientSpark: ['#FF6B6B', '#FF8E53'],
  gradientSignal: ['#00D9FF', '#00B4DB'],
  gradientXp: ['#2ECC71', '#A8E6CF'],
  gradientPrimary: ['#6C63FF', '#9B94FF'],
  gradientPrimaryHover: ['#5A52E0', '#8A83F0'],
  gradientAccent: ['#FF6B6B', '#FF9494'],
  gradientBrand: ['#6C63FF', '#FF6B6B', '#2ECC71'],
  gradientGrowth: ['#2ECC71', '#A8E6CF'],
  gradientDark: ['#1A1932', '#0F0E17'],
  gradientSurface: ['rgba(108,99,255,0.05)', 'transparent'],

  // Borders
  border: 'rgba(255,255,255,0.12)',
  borderLight: 'rgba(255,255,255,0.08)',
  borderFocus: '#6C63FF',

  // Shadows
  shadowColor: '#000000',
  glowPrimary: 'rgba(108, 99, 255, 0.3)',
  glowPulse: 'rgba(255, 215, 0, 0.3)',
  glowSpark: 'rgba(255, 107, 107, 0.3)',
  glowSignal: 'rgba(0, 217, 255, 0.3)',
  glowSuccess: 'rgba(46, 204, 113, 0.3)',

  // Surface layers (for glassmorphism-like depth)
  surfaceBase: '#1A1932',
  surfaceElevated: '#1F1E36',
  surfaceOverlay: 'rgba(255,255,255,0.03)',
};

/* ── Intent Categories (Thought Experiments) ── */
export const INTENT_COLORS = {
  community: '#FF6B6B',
  environment: '#2ECC71',
  education: '#6C63FF',
  health: '#00B8D9',
  equity: '#FFAB00',
  technology: '#7C4DFF',
};

export const INTENT_ICONS = {
  community: 'account-group',
  environment: 'tree',
  education: 'school',
  health: 'heart-pulse',
  equity: 'scale-balance',
  technology: 'memory',
};

export const INTENT_LABELS = {
  community: 'Community',
  environment: 'Environment',
  education: 'Education',
  health: 'Health',
  equity: 'Equity',
  technology: 'Technology',
};

/* ── Gradients (LinearGradient color arrays) ── */
export const GRADIENTS = {
  primary: ['#6C63FF', '#9B94FF'],
  primaryHover: ['#5A52E0', '#8A83F0'],
  accent: ['#FF6B6B', '#FF9494'],
  brand: ['#6C63FF', '#FF6B6B', '#2ECC71'],
  brandWide: ['#6C63FF', '#FF6B6B', '#2ECC71'],
  growth: ['#2ECC71', '#A8E6CF'],
  surface: ['rgba(108,99,255,0.05)', 'transparent'],
  // Intent gradients
  intentCommunity: ['#FF6B6B', '#FF9494'],
  intentEnvironment: ['#2ECC71', '#A8E6CF'],
  intentEducation: ['#6C63FF', '#9B94FF'],
  intentHealth: ['#00B8D9', '#79E2F2'],
  intentEquity: ['#FFAB00', '#FFD740'],
  intentTechnology: ['#7C4DFF', '#B47CFF'],
};

export const INTENT_GRADIENT_MAP = {
  community: GRADIENTS.intentCommunity,
  environment: GRADIENTS.intentEnvironment,
  education: GRADIENTS.intentEducation,
  health: GRADIENTS.intentHealth,
  equity: GRADIENTS.intentEquity,
  technology: GRADIENTS.intentTechnology,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,   // aligned with web (was 12)
  lg: 24,   // aligned with web (was 16)
  xl: 32,   // aligned with web (was 24)
  xxl: 48,  // aligned with web (was 32)
};

export const borderRadius = {
  sm: 8,    // aligned with web (was 4)
  md: 12,   // aligned with web (was 8)
  lg: 16,   // aligned with web (was 12)
  xl: 24,   // aligned with web (was 16)
  xxl: 32,
  pill: 9999,
  full: 9999,
};

export const fontSize = {
  xs: 12,    // aligned with web (was 10)
  sm: 14,    // aligned with web (was 12)
  md: 16,    // aligned with web (was 14)
  lg: 20,    // aligned with web (was 16)
  xl: 24,    // aligned with web (was 18)
  xxl: 32,   // aligned with web (was 24)
  xxxl: 40,  // was 32
  display: 48,
};

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

/* ── Shadow presets ── */
export const shadows = {
  sm: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  card: {
    shadowColor: 'rgba(108, 99, 255, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  glow: (color) => ({
    shadowColor: color || colors.glowPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  }),
};

/* ── Animation presets ── */
export const EASINGS = {
  snappy: Easing.bezier(0.2, 0, 0, 1),
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1),
  smooth: Easing.bezier(0.4, 0, 0.2, 1),
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  spring: Easing.bezier(0.175, 0.885, 0.32, 1.275),
};

export const DURATIONS = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
};

/* ── Spring presets (named configs for Animated.spring) ── */
export const SPRINGS = {
  bouncy:  { friction: 4, tension: 40, useNativeDriver: true },  // celebrations
  smooth:  { friction: 8, tension: 40, useNativeDriver: true },  // transitions
  snappy:  { friction: 6, tension: 80, useNativeDriver: true },  // UI responses
  gentle:  { friction: 10, tension: 20, useNativeDriver: true }, // subtle motions
  playful: { friction: 5, tension: 60, useNativeDriver: true },  // game interactions
  quick:   { friction: 3, tension: 40, useNativeDriver: true },  // micro-interactions
  standard:{ friction: 6, tension: 40, useNativeDriver: true },  // default entry
  rush:    { friction: 6, tension: 100, useNativeDriver: true }, // urgent
  flippy:  { friction: 8, tension: 10, useNativeDriver: true },  // card flips
};

// Legacy alias
export const animations = {
  fast: DURATIONS.fast,
  normal: DURATIONS.normal,
  slow: DURATIONS.slow,
  stagger: 50,
};

/* ── Utility: get intent color ── */
export const intentColor = (category) => INTENT_COLORS[category] || colors.accent;
export const intentGradient = (category) => INTENT_GRADIENT_MAP[category] || GRADIENTS.primary;

/* ── Diverse avatar palette (seeded by agent name) ── */
export const AVATAR_PALETTES = [
  { bg: '#8B5E3C', accent: '#FFD8B1' },
  { bg: '#6C63FF', accent: '#C5C1FF' },
  { bg: '#D4A373', accent: '#FEFAE0' },
  { bg: '#2D6A4F', accent: '#B7E4C7' },
  { bg: '#E76F51', accent: '#FFDDD2' },
  { bg: '#264653', accent: '#A8DADC' },
  { bg: '#F4A261', accent: '#FFF1DB' },
  { bg: '#7B2CBF', accent: '#E0AAFF' },
  { bg: '#D62828', accent: '#FFCCD5' },
  { bg: '#023E8A', accent: '#90E0EF' },
  { bg: '#BC6C25', accent: '#DDA15E' },
  { bg: '#606C38', accent: '#FEFAE0' },
];

export const getAgentPalette = (seed) => {
  if (!seed) return AVATAR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
};

/* ── Provenance / channel colors (UNIF-G3) ──
 * Color codes adapter platforms by their canonical brand color so
 * provenance chips ("via Discord", "in #cosmic-tea-club") are
 * recognizable without text on a small screen.  Hevolve / Nunba /
 * HevolveAI native messages use the brand accent.  Unknown platforms
 * fall back to textMuted so a new adapter doesn't crash the renderer.
 */
export const PROVENANCE_COLORS = {
  discord:    '#5865F2',
  whatsapp:   '#25D366',
  slack:      '#4A154B',
  matrix:     '#0DBD8B',
  teams:      '#6264A7',
  telegram:   '#26A5E4',
  email:      '#888888',
  livekit:    '#3CB54E',
  hevolve:    '#6C63FF',
  nunba:      '#6C63FF',
  hevolveai:  '#6C63FF',
  default:    '#888888',
};

/** Resolve color for a row's `channel_type` (UNIF-G3 shape:
 * `"platform:room_id"`).  Returns the brand muted gray when the
 * platform isn't in the table — never throws.
 */
export const platformColor = (channelType) => {
  if (!channelType || typeof channelType !== 'string') {
    return PROVENANCE_COLORS.default;
  }
  const platform = channelType.split(':')[0].toLowerCase();
  return PROVENANCE_COLORS[platform] || PROVENANCE_COLORS.default;
};

/* ── Animation timing tokens (UI kit) ──
 * Single source of truth for cross-component motion timings so
 * stagger / pulse / shimmer feel consistent across screens.  Values
 * tuned for responsiveness without busy-feeling jitter on low-end
 * Android devices.
 */
export const TIMINGS = {
  staggerMs:        30,    // per-row stagger on FlatList mount
  pulseMs:        1500,    // unread-dot pulse cycle
  fadeMs:          300,    // mount fade-in
  swipeThresholdPx: 80,    // distance to trigger swipe action
  shimmerMs:      1400,    // skeleton shimmer cycle
  longPressMs:     350,    // long-press → action sheet
};

export default {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  animations,
  INTENT_COLORS,
  INTENT_ICONS,
  INTENT_LABELS,
  GRADIENTS,
  INTENT_GRADIENT_MAP,
  EASINGS,
  DURATIONS,
  SPRINGS,
  AVATAR_PALETTES,
  getAgentPalette,
  intentColor,
  intentGradient,
  PROVENANCE_COLORS,
  platformColor,
  TIMINGS,
};
