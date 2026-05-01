export const kidsColors = {
  // Backgrounds
  background: '#F0F4FF',
  backgroundSecondary: '#E8F5E9',
  backgroundTertiary: '#FFF3E0',
  card: '#FFFFFF',
  cardHover: '#F5F5F5',
  cardShadow: '#636E72',

  // Text
  textPrimary: '#2D3436',
  textSecondary: '#636E72',
  textMuted: '#B2BEC3',
  textOnDark: '#FFFFFF',

  // Category colors
  english: '#FF6B6B',
  math: '#4ECDC4',
  lifeSkills: '#FFE66D',
  science: '#A29BFE',
  creativity: '#FD79A8',

  // Category gradients
  gradientEnglish: ['#FF6B6B', '#EE5A24'],
  gradientMath: ['#4ECDC4', '#00B894'],
  gradientLifeSkills: ['#FFE66D', '#FDCB6E'],
  gradientScience: ['#A29BFE', '#6C5CE7'],
  gradientCreativity: ['#FD79A8', '#E84393'],

  // Game feedback
  correct: '#00B894',
  correctLight: '#DFFFF7',
  incorrect: '#FF7675',
  incorrectLight: '#FFE8E8',
  star: '#FDCB6E',
  starGlow: '#F9CA24',
  streak: '#E17055',
  streakFire: '#FF4500',

  // UI accent
  accent: '#6C5CE7',
  accentLight: '#A29BFE',
  accentSecondary: '#00CEC9',

  // Bright palette for game elements
  palette: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DFE6E9', '#FD79A8', '#6C5CE7',
    '#55EFC4', '#81ECEC', '#74B9FF', '#A29BFE',
  ],

  // Level stars
  starBronze: '#E17055',
  starSilver: '#B2BEC3',
  starGold: '#FDCB6E',

  // Borders
  border: '#DFE6E9',
  borderFocus: '#6C5CE7',

  // Header gradient
  gradientHeader: ['#6C5CE7', '#A29BFE'],
  gradientSuccess: ['#00B894', '#55EFC4'],

  // Difficulty colors
  difficultyEasy: '#00B894',
  difficultyMedium: '#FDCB6E',
  difficultyHard: '#FF6B6B',

  // Hint/banner backgrounds
  hintBg: '#FFF9E6',
  warmBg: '#FFF0E0',

  // Transparent overlays
  overlayDark: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(255,255,255,0.9)',
};

export const kidsSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const kidsBorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const kidsFontSize = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28,
  xxl: 36,
  display: 48,
};

export const kidsFontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const kidsShadows = {
  card: {
    shadowColor: '#636E72',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    shadowColor: '#6C5CE7',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  float: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Colorful number pad colors (one per digit 0-9)
export const numPadColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DFE6E9', '#FD79A8', '#6C5CE7', '#55EFC4', '#74B9FF',
];

export const CATEGORY_MAP = {
  english: {color: kidsColors.english, gradient: kidsColors.gradientEnglish, icon: 'alphabetical-variant', label: 'English'},
  math: {color: kidsColors.math, gradient: kidsColors.gradientMath, icon: 'calculator-variant', label: 'Math'},
  lifeSkills: {color: kidsColors.lifeSkills, gradient: kidsColors.gradientLifeSkills, icon: 'heart-pulse', label: 'Life Skills'},
  science: {color: kidsColors.science, gradient: kidsColors.gradientScience, icon: 'flask', label: 'Science'},
  creativity: {color: kidsColors.creativity, gradient: kidsColors.gradientCreativity, icon: 'palette', label: 'Creative'},
};
