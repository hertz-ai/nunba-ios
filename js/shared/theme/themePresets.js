/**
 * Theme Presets — RN parity for the web SPA's
 * landing-page/src/theme/themePresets.js.
 *
 * 8 curated dark-mode presets.  This is the trimmed RN-side mirror:
 * we keep id/name/description and the 6 swatch colors that the
 * Theme Settings preset cards display.  The full Nunba record also
 * carries glass-blur, animation intensity, font, and shell knobs
 * — those live server-side and are returned by themeApi.apply()
 * via /theme/active to clients that consume them.  The RN client
 * only renders previews + delegates the full theme to HARTOS.
 *
 * The first preset (`hart-default`) matches the current static RN
 * theme so existing users see zero visual change when switching to
 * "default" via the picker.
 */

const presetWithDefaults = (preset) => ({
  ...preset,
  metadata: { is_preset: true, is_ai_generated: false },
});

export const DEFAULT_THEME_CONFIG = presetWithDefaults({
  id: 'hart-default',
  name: 'HART Default',
  description: 'Deep navy with aspiration violet accents',
  colors: {
    background: '#0F0E17',
    paper: '#1A1932',
    primary: '#6C63FF',
    secondary: '#FF6B6B',
    accent: '#2ECC71',
    text_primary: '#FFFFFE',
  },
});

export const THEME_PRESETS = [
  DEFAULT_THEME_CONFIG,
  presetWithDefaults({
    id: 'midnight-black',
    name: 'Midnight Black',
    description: 'True OLED black with ice-blue highlights',
    colors: {
      background: '#000000',
      paper: '#0A0A0F',
      primary: '#00B8D9',
      secondary: '#7C4DFF',
      accent: '#00E5FF',
      text_primary: '#E8E8E8',
    },
  }),
  presetWithDefaults({
    id: 'ocean-blue',
    name: 'Ocean Blue',
    description: 'Deep sea gradients with coral accents',
    colors: {
      background: '#0B1426',
      paper: '#112240',
      primary: '#64B5F6',
      secondary: '#FF8A65',
      accent: '#4DD0E1',
      text_primary: '#E3F2FD',
    },
  }),
  presetWithDefaults({
    id: 'forest-green',
    name: 'Forest Green',
    description: 'Deep forest with amber firelight',
    colors: {
      background: '#0A1F0A',
      paper: '#142814',
      primary: '#66BB6A',
      secondary: '#FFB74D',
      accent: '#81C784',
      text_primary: '#E8F5E9',
    },
  }),
  presetWithDefaults({
    id: 'sunset-warm',
    name: 'Sunset Warm',
    description: 'Warm amber dusk with rose highlights',
    colors: {
      background: '#1A0F0A',
      paper: '#2D1B12',
      primary: '#FF8A65',
      secondary: '#F48FB1',
      accent: '#FFD54F',
      text_primary: '#FFF3E0',
    },
  }),
  presetWithDefaults({
    id: 'neon-purple',
    name: 'Neon Purple',
    description: 'Cyberpunk vibes with electric neon',
    colors: {
      background: '#0D0015',
      paper: '#1A0030',
      primary: '#E040FB',
      secondary: '#00E5FF',
      accent: '#76FF03',
      text_primary: '#F3E5F5',
    },
  }),
  presetWithDefaults({
    id: 'rose-gold',
    name: 'Rose Gold',
    description: 'Elegant rose with warm gold tones',
    colors: {
      background: '#1A0F14',
      paper: '#2D1B25',
      primary: '#F48FB1',
      secondary: '#FFD54F',
      accent: '#CE93D8',
      text_primary: '#FCE4EC',
    },
  }),
  presetWithDefaults({
    id: 'arctic-frost',
    name: 'Arctic Frost',
    description: 'Cool silver-white with ice accents',
    colors: {
      background: '#0E1621',
      paper: '#162433',
      primary: '#B0BEC5',
      secondary: '#80CBC4',
      accent: '#B3E5FC',
      text_primary: '#ECEFF1',
    },
  }),
];

// Resolve a preset by id; falls back to default if id is unknown
// (matches the web-side semantics in mergeThemeConfig consumers).
export const findPresetById = (id) =>
  THEME_PRESETS.find((p) => p.id === id) || DEFAULT_THEME_CONFIG;
