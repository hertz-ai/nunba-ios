/**
 * Get structured time-of-day bucket from current hour.
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
export function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 6) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

/**
 * Get a greeting string for the given time-of-day bucket.
 * @param {string} [timeOfDay] - If omitted, computed from current hour.
 * @returns {string}
 */
export function getGreeting(timeOfDay) {
  const tod = timeOfDay || getTimeOfDay();
  const greetings = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    night: 'Still up?',
  };
  return greetings[tod] || 'Hello';
}
