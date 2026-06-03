/**
 * responsiveFont — orientation-aware font sizing.
 *
 * The codebase widely uses `widthPercentageToDP` (wp) from
 * `react-native-responsive-screen` for font sizes. That works in
 * portrait — wp('3.8%') on a 1440-wide phone ≈ 55px which downscales
 * to a reasonable 14sp via density. But on a tablet in LANDSCAPE
 * (2560×1600) wp('3.8%') = 97px — fonts become huge ("disproportionate
 * landscape" user feedback 2026-06-03).
 *
 * Fix: base font scaling on the SHORTER device dimension. For a
 * tablet that's 1600 in landscape (= 1600 in portrait too). For a
 * phone 1440 portrait / 3088 landscape — the shorter is 1440 either
 * way. Font math stays the same regardless of orientation.
 *
 * Usage:
 *   import { rfp, rfpHeight } from '../../utils/responsiveFont';
 *   styles.label = { fontSize: rfp(3.8) };
 *
 * Pass the percentage as a NUMBER (not a string with %).
 */
import { Dimensions, PixelRatio } from 'react-native';

// Compute lazily on first call so jest mocks of react-native that
// omit Dimensions don't blow up at import time. The value is cached
// after first compute and refreshed on orientation change.
let SHORT = null;
let _listenerAttached = false;

const computeShortSide = () => {
  try {
    const { width = 360, height = 640 } = Dimensions.get('window') || {};
    return Math.min(width, height);
  } catch (_) {
    return 360; // safe phone-portrait default
  }
};

const ensureInit = () => {
  if (SHORT === null) SHORT = computeShortSide();
  if (!_listenerAttached && Dimensions && typeof Dimensions.addEventListener === 'function') {
    try {
      Dimensions.addEventListener('change', () => { SHORT = computeShortSide(); });
      _listenerAttached = true;
    } catch (_) { /* no-op for older RN test envs */ }
  }
};

/**
 * Orientation-stable replacement for widthPercentageToDP when used
 * for fonts. Always scales off the shorter device dimension.
 *
 * @param {number} percent — e.g. 3.8 for what was wp('3.8%')
 * @returns {number} fontSize in dp suitable for a Text component
 */
export const rfp = (percent) => {
  ensureInit();
  const px = (percent * SHORT) / 100;
  return PixelRatio && PixelRatio.roundToNearestPixel
    ? PixelRatio.roundToNearestPixel(px)
    : Math.round(px);
};

/**
 * Optional companion for vertical margins / line heights where
 * keeping rhythm across orientation matters.
 */
export const rfpHeight = (percent) => {
  ensureInit();
  const px = (percent * SHORT) / 100;
  return PixelRatio && PixelRatio.roundToNearestPixel
    ? PixelRatio.roundToNearestPixel(px)
    : Math.round(px);
};

export default rfp;
