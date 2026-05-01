// Canonical XP thresholds per level (exponential growth)
export const XP_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1800, 2800, 4200, 6000, 8500,
  12000, 16000, 21000, 28000, 36000, 46000, 58000, 72000, 90000, 110000,
];

/**
 * Calculate level progress as a 0-1 fraction.
 * @param {number} level - Current level (1-based)
 * @param {number} xp - Current XP
 * @returns {number} Progress toward next level (0 to 1)
 */
export function getLevelProgress(level, xp) {
  const next = XP_THRESHOLDS[Math.min(level, XP_THRESHOLDS.length - 1)] || xp * 1.5;
  const prev = XP_THRESHOLDS[Math.min(level - 1, XP_THRESHOLDS.length - 1)] || 0;
  return next > prev ? (xp - prev) / (next - prev) : 0;
}
