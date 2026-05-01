/**
 * Game Theme Registry — gives each of the 15 game templates a unique identity.
 *
 * GameShell, FeedbackOverlay, GameComplete, and SoundManager all read from this
 * registry so every game *feels* different: distinct entry animation, feedback style,
 * win celebration, color palette, and sound palette.
 */

// ── Per-template color palettes ──
// Each palette has 5 colors: primary (brand), secondary (complement), accent (highlight),
// correctGlow (feedback bg), wrongGlow (feedback bg)
export const GAME_PALETTES = {
  quiz:     { primary: '#6C5CE7', secondary: '#A29BFE', accent: '#FFEAA7', correctGlow: '#D4EFDF', wrongGlow: '#FADBD8' },
  match:    { primary: '#00B894', secondary: '#55EFC4', accent: '#FD79A8', correctGlow: '#D5F5E3', wrongGlow: '#F9E0E0' },
  memory:   { primary: '#0984E3', secondary: '#74B9FF', accent: '#FDCB6E', correctGlow: '#D6EAF8', wrongGlow: '#FADBD8' },
  drag:     { primary: '#E17055', secondary: '#FAB1A0', accent: '#00CEC9', correctGlow: '#DFFFF7', wrongGlow: '#FFE8E8' },
  count:    { primary: '#4ECDC4', secondary: '#81ECEC', accent: '#FF6B6B', correctGlow: '#D1F2EB', wrongGlow: '#F9E0E0' },
  fill:     { primary: '#636E72', secondary: '#B2BEC3', accent: '#6C5CE7', correctGlow: '#E8F5E9', wrongGlow: '#FFE8E8' },
  puzzle:   { primary: '#E84393', secondary: '#FD79A8', accent: '#00B894', correctGlow: '#FCE4EC', wrongGlow: '#FADBD8' },
  sequence: { primary: '#F39C12', secondary: '#F1C40F', accent: '#3498DB', correctGlow: '#FEF9E7', wrongGlow: '#FADBD8' },
  sim:      { primary: '#8E44AD', secondary: '#BB8FCE', accent: '#2ECC71', correctGlow: '#F5EEF8', wrongGlow: '#FADBD8' },
  spot:     { primary: '#2C3E50', secondary: '#5D6D7E', accent: '#F39C12', correctGlow: '#EBF5FB', wrongGlow: '#F9E0E0' },
  story:    { primary: '#D35400', secondary: '#E67E22', accent: '#1ABC9C', correctGlow: '#FDEBD0', wrongGlow: '#FADBD8' },
  rush:     { primary: '#C0392B', secondary: '#E74C3C', accent: '#F1C40F', correctGlow: '#FDEDEC', wrongGlow: '#F9E0E0' },
  trace:    { primary: '#27AE60', secondary: '#58D68D', accent: '#9B59B6', correctGlow: '#D5F5E3', wrongGlow: '#FADBD8' },
  tf:       { primary: '#2980B9', secondary: '#5DADE2', accent: '#E74C3C', correctGlow: '#D6EAF8', wrongGlow: '#FADBD8' },
  word:     { primary: '#16A085', secondary: '#48C9B0', accent: '#E84393', correctGlow: '#D1F2EB', wrongGlow: '#F9E0E0' },
};

// ── Confetti color sets (per template, used by GameComplete celebrations) ──
export const CONFETTI_COLORS = {
  quiz:     ['#6C5CE7', '#A29BFE', '#FFEAA7', '#FF6B6B', '#55EFC4'],
  match:    ['#00B894', '#55EFC4', '#FD79A8', '#74B9FF', '#FDCB6E'],
  memory:   ['#0984E3', '#74B9FF', '#FDCB6E', '#FF6B6B', '#A29BFE'],
  drag:     ['#E17055', '#FAB1A0', '#00CEC9', '#FDCB6E', '#6C5CE7'],
  count:    ['#4ECDC4', '#81ECEC', '#FF6B6B', '#FFEAA7', '#A29BFE'],
  fill:     ['#636E72', '#6C5CE7', '#A29BFE', '#00B894', '#FDCB6E'],
  puzzle:   ['#E84393', '#FD79A8', '#00B894', '#74B9FF', '#FFEAA7'],
  sequence: ['#F39C12', '#F1C40F', '#3498DB', '#2ECC71', '#E84393'],
  sim:      ['#8E44AD', '#BB8FCE', '#2ECC71', '#3498DB', '#F39C12'],
  spot:     ['#2C3E50', '#F39C12', '#E74C3C', '#3498DB', '#2ECC71'],
  story:    ['#D35400', '#E67E22', '#1ABC9C', '#6C5CE7', '#FF6B6B'],
  rush:     ['#C0392B', '#F1C40F', '#E74C3C', '#FF6B6B', '#FFEAA7'],
  trace:    ['#27AE60', '#58D68D', '#9B59B6', '#74B9FF', '#FDCB6E'],
  tf:       ['#2980B9', '#5DADE2', '#E74C3C', '#F1C40F', '#55EFC4'],
  word:     ['#16A085', '#48C9B0', '#E84393', '#FDCB6E', '#74B9FF'],
};

// ── Feedback styles ──
// 'stamp'    — check/X slams down from 2x scale (quiz/true-false feel)
// 'ripple'   — green/red ripple ring expands from center
// 'flip'     — card flips to reveal check/X (memory game feel)
// 'pop'      — bubble pops with mini confetti circles
// 'drop'     — correct: item settles with gravity; wrong: bounces back up
// 'glow'     — screen edges pulse green/red (immersive, non-intrusive)
export const FEEDBACK_STYLES = ['stamp', 'ripple', 'flip', 'pop', 'drop', 'glow'];

// ── Main theme registry ──
const GAME_THEMES = {
  MultipleChoice: {
    palette: 'quiz',
    winIcon: 'brain',
    winVerb: 'Nailed it!',
    entrAnim: 'flipInY',
    entrDuration: 400,
    feedbackStyle: 'stamp',
    bgmCategory: 'quiz_upbeat',
    celebrationType: 'podium',  // quiz podium rises from bottom
  },
  MatchPairs: {
    palette: 'match',
    winIcon: 'puzzle-piece-outline',
    winVerb: 'All matched!',
    entrAnim: 'zoomIn',
    entrDuration: 500,
    feedbackStyle: 'ripple',
    bgmCategory: 'match_playful',
    celebrationType: 'orbit',  // matched pairs orbit trophy
  },
  MemoryFlip: {
    palette: 'memory',
    winIcon: 'cards-outline',
    winVerb: 'Sharp memory!',
    entrAnim: 'flipInX',
    entrDuration: 500,
    feedbackStyle: 'flip',
    bgmCategory: 'memory_calm',
    celebrationType: 'cascade',  // cards cascade-flip revealing WINNER
  },
  DragToZone: {
    palette: 'drag',
    winIcon: 'bullseye-arrow',
    winVerb: 'Sorted!',
    entrAnim: 'slideInUp',
    entrDuration: 400,
    feedbackStyle: 'drop',
    bgmCategory: 'drag_groove',
    celebrationType: 'formation',  // items fly into trophy shape
  },
  Counting: {
    palette: 'count',
    winIcon: 'calculator-variant-outline',
    winVerb: 'Count master!',
    entrAnim: 'bounceIn',
    entrDuration: 600,
    feedbackStyle: 'pop',
    bgmCategory: 'count_bouncy',
    celebrationType: 'rain',  // numbers rain, tally up to score
  },
  FillBlank: {
    palette: 'fill',
    winIcon: 'lead-pencil',
    winVerb: 'Wordsmith!',
    entrAnim: 'fadeInUp',
    entrDuration: 500,
    feedbackStyle: 'glow',
    bgmCategory: 'fill_mellow',
    celebrationType: 'typewriter',  // letters type out congratulations
  },
  PuzzleAssemble: {
    palette: 'puzzle',
    winIcon: 'puzzle-outline',
    winVerb: 'Pieced together!',
    entrAnim: 'zoomIn',
    entrDuration: 500,
    feedbackStyle: 'drop',
    bgmCategory: 'puzzle_ambient',
    celebrationType: 'snap',  // pieces snap into final formation
  },
  SequenceOrder: {
    palette: 'sequence',
    winIcon: 'sort-ascending',
    winVerb: 'In order!',
    entrAnim: 'slideInLeft',
    entrDuration: 400,
    feedbackStyle: 'drop',
    bgmCategory: 'sequence_rhythmic',
    celebrationType: 'cascade',  // items cascade in sequence
  },
  Simulation: {
    palette: 'sim',
    winIcon: 'flask-outline',
    winVerb: 'Experiment done!',
    entrAnim: 'fadeIn',
    entrDuration: 500,
    feedbackStyle: 'glow',
    bgmCategory: 'sim_sci',
    celebrationType: 'bubbles',  // science bubbles float up
  },
  SpotDifference: {
    palette: 'spot',
    winIcon: 'eye-outline',
    winVerb: 'Eagle eye!',
    entrAnim: 'zoomIn',
    entrDuration: 400,
    feedbackStyle: 'glow',
    bgmCategory: 'spot_detective',
    celebrationType: 'spotlight',  // magnifying glass reveals all
  },
  StoryBuilder: {
    palette: 'story',
    winIcon: 'book-open-variant',
    winVerb: 'Story told!',
    entrAnim: 'fadeInUp',
    entrDuration: 600,
    feedbackStyle: 'glow',
    bgmCategory: 'story_gentle',
    celebrationType: 'pages',  // book pages flip to "The End"
  },
  TimedRush: {
    palette: 'rush',
    winIcon: 'timer-outline',
    winVerb: 'Speed demon!',
    entrAnim: 'bounceInDown',
    entrDuration: 300,
    feedbackStyle: 'stamp',
    bgmCategory: 'rush_intense',
    celebrationType: 'freeze',  // stopwatch freezes, dramatic zoom
  },
  Tracing: {
    palette: 'trace',
    winIcon: 'draw',
    winVerb: 'Traced it!',
    entrAnim: 'fadeIn',
    entrDuration: 500,
    feedbackStyle: 'pop',
    bgmCategory: 'trace_calm',
    celebrationType: 'illuminate',  // drawn path glows golden
  },
  TrueFalse: {
    palette: 'tf',
    winIcon: 'scale-balance',
    winVerb: 'Truth seeker!',
    entrAnim: 'flipInY',
    entrDuration: 400,
    feedbackStyle: 'stamp',
    bgmCategory: 'tf_playful',
    celebrationType: 'podium',
  },
  WordBuild: {
    palette: 'word',
    winIcon: 'alphabetical-variant',
    winVerb: 'Word wizard!',
    entrAnim: 'bounceIn',
    entrDuration: 600,
    feedbackStyle: 'pop',
    bgmCategory: 'word_cheerful',
    celebrationType: 'typewriter',
  },
};

// ── Spring presets (replaces hardcoded friction/tension everywhere) ──
export const SPRINGS = {
  bouncy:  { friction: 4, tension: 40, useNativeDriver: true },  // celebrations, win screens
  smooth:  { friction: 8, tension: 40, useNativeDriver: true },  // page/content transitions
  snappy:  { friction: 6, tension: 80, useNativeDriver: true },  // UI responses, card flips
  gentle:  { friction: 10, tension: 20, useNativeDriver: true }, // idle, breathing, ambient
  playful: { friction: 5, tension: 60, useNativeDriver: true },  // game interactions
  quick:   { friction: 3, tension: 40, useNativeDriver: true },  // micro-interactions, scale pops
  standard:{ friction: 6, tension: 40, useNativeDriver: true },  // default entry animations
  rush:    { friction: 6, tension: 100, useNativeDriver: true }, // timed/urgent game interactions
  flippy:  { friction: 8, tension: 10, useNativeDriver: true },  // card flip rotations
};

/**
 * Get theme for a template type. Falls back to MultipleChoice theme for unknown types.
 * @param {string} templateType - e.g. 'MultipleChoice', 'MemoryFlip'
 * @returns {object} theme config
 */
export const getGameTheme = (templateType) => {
  const theme = GAME_THEMES[templateType] || GAME_THEMES.MultipleChoice;
  return {
    ...theme,
    colors: GAME_PALETTES[theme.palette] || GAME_PALETTES.quiz,
    confetti: CONFETTI_COLORS[theme.palette] || CONFETTI_COLORS.quiz,
  };
};

/**
 * Resolve template type from config object.
 * Reads config.templateType or config.template or falls back to 'MultipleChoice'.
 */
export const resolveTemplateType = (config) => {
  if (!config) return 'MultipleChoice';
  return config.templateType || config.template || 'MultipleChoice';
};

export default GAME_THEMES;
