/**
 * Autopilot store — RN parity for the web SPA's
 * landing-page/src/components/Social/Autopilot/autopilotStore.js.
 *
 * RN-simplified scope (intentional — see NUNBA_PARITY.md):
 *   - Config persisted in AsyncStorage (web uses localStorage).
 *   - Default config + getters/setters + toggleAgent + toggleInterest.
 *   - getTimeSuggestions() / getDailyContent() — pure time-of-day fns.
 *
 * Dropped vs web (deferred — would need backend infra not yet wired):
 *   - Activity logging + pattern detection (last 500 entries +
 *     hourly/repeated/daily/affinity analytics).  Useful but it adds
 *     a lot of state + read-side cost; defer to a follow-up.
 *   - Agent dispatch chain orchestration (DISPATCH_CHAINS) — needs
 *     the backend `/api/social/agent/dispatch` endpoint to be wired
 *     into a Hevolve_RN agentDispatchApi first.
 *
 * The screen reads from this module synchronously where it can; the
 * config-load itself is async (AsyncStorage), so the screen kicks off
 * a fetch in useEffect and uses DEFAULT_CONFIG until it lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'nunba_autopilot';

export const DEFAULT_CONFIG = {
  enabled: true,
  // Core automations (toggle on/off)
  dailyDigest: true,
  smartReminders: true,
  healthNudges: true,
  contentCuration: true,
  gameSuggestions: true,
  learningGoals: false,
  agentObservation: false, // opt-in: agent watches behavior for self-critique
  // User preferences
  interests: ['technology', 'education', 'health'],
  // Agent orchestration
  agentMode: 'suggest', // 'suggest' | 'auto' | 'off'
  agentFrequency: 'normal', // 'minimal' | 'normal' | 'frequent'
  // Per-agent toggles
  agents: {
    games: true,
    learning: true,
    content: true,
    wellness: true,
    social: true,
    creative: false,
  },
};

export async function getAutopilotConfig() {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG, agents: { ...DEFAULT_CONFIG.agents } };
    const stored = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      agents: { ...DEFAULT_CONFIG.agents, ...(stored.agents || {}) },
      ...stored,
      // re-merge agents so the spread above doesn't lose new defaults.
      agents: { ...DEFAULT_CONFIG.agents, ...(stored.agents || {}) },
    };
  } catch {
    return { ...DEFAULT_CONFIG, agents: { ...DEFAULT_CONFIG.agents } };
  }
}

export async function saveAutopilotConfig(config) {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(config));
  } catch {
    // AsyncStorage write failed — keep in-memory state, surface via
    // banner up the caller.  Don't crash.
  }
}

// Time-of-day suggestions.  Pure function of (hour, config) — same
// hour buckets as the web SPA (autopilotStore.js:242-325).  Returns
// up to 3 suggestions per slot.  `action` keys map to RN route
// names via ACTION_ROUTES below.
export function getTimeSuggestions(config) {
  const hour = new Date().getHours();
  const c = config || DEFAULT_CONFIG;
  const out = [];
  if (hour >= 6 && hour < 9) {
    if (c.dailyDigest) {
      out.push({ icon: '🌅', text: 'Good morning! Ready for your daily digest?', action: 'daily_digest' });
    }
    out.push({ icon: '📰', text: 'Check the latest news and updates', action: 'view_feed' });
  } else if (hour >= 9 && hour < 12) {
    out.push({ icon: '🎯', text: 'Focus time — tackle your most important task', action: 'focus_mode' });
    out.push({ icon: '📚', text: 'Learn something new today', action: 'kids_learning' });
    if (c.agents && c.agents.games) {
      out.push({ icon: '🎮', text: 'Quick brain game to sharpen your mind', action: 'play_games' });
    }
  } else if (hour >= 12 && hour < 14) {
    out.push({ icon: '🍽️', text: 'Lunch break — catch up with your community', action: 'view_communities' });
    if (c.healthNudges) {
      out.push({ icon: '🧘', text: 'Quick mindfulness break?', action: 'wellness' });
    }
  } else if (hour >= 14 && hour < 17) {
    out.push({ icon: '💪', text: "Afternoon push — you're doing great!", action: 'motivation' });
    out.push({ icon: '🤝', text: 'Connect with someone in your community', action: 'encounters' });
  } else if (hour >= 17 && hour < 20) {
    out.push({ icon: '🌇', text: "Wind down — review your day's progress", action: 'view_progress' });
    if (c.agents && c.agents.games) {
      out.push({ icon: '🎮', text: 'Relax with a game', action: 'play_games' });
    }
  } else {
    out.push({ icon: '🌙', text: 'Evening reflection — what did you accomplish today?', action: 'reflection' });
    out.push({ icon: '📖', text: 'Light reading from your feed', action: 'view_feed' });
  }
  return out;
}

// RN navigation route names mapped from autopilot action keys.  Web
// uses URL paths (e.g. `/social/games`) — we map to `Stack.Screen`
// names so the screen can call `navigation.navigate(...)` directly.
export const ACTION_ROUTES = {
  daily_digest: ['Communities'],
  view_feed: ['Communities'],
  focus_mode: ['Tasks'],
  kids_learning: ['KidsHub'],
  view_communities: ['Communities'],
  wellness: ['Tasks'],
  motivation: ['ResonanceDashboard'],
  encounters: ['Encounters'],
  view_progress: ['ResonanceDashboard'],
  reflection: ['Tasks'],
  games: ['GameHub'],
  play_games: ['GameHub'],
  explore_games: ['GameHub'],
};

// Daily content card — picked deterministically by day-of-week, so
// the same tip shows all day across app restarts.  Filters by user
// interests when possible.
const DAILY_TIPS = [
  { title: 'Productivity Tip', emoji: '⚡', category: 'productivity',
    content: 'Try the 2-minute rule: if a task takes less than 2 minutes, do it now instead of scheduling it.' },
  { title: 'Health Reminder', emoji: '🧘', category: 'health',
    content: "You've been active for a while. Remember to stand up, stretch, and hydrate!" },
  { title: 'Learning Moment', emoji: '🧠', category: 'education',
    content: 'Did you know? The human brain processes images 60,000 times faster than text. Visual learning is powerful.' },
  { title: 'Community Spotlight', emoji: '💬', category: 'community',
    content: "Engage with your community today — a simple comment or reaction can make someone's day." },
  { title: 'Creative Spark', emoji: '💡', category: 'creativity',
    content: 'Take 5 minutes to brainstorm one wild idea. The best innovations start as "crazy" thoughts.' },
  { title: 'Wellness Check', emoji: '🔋', category: 'health',
    content: "Rate your energy 1-10 right now. If it's below 5, consider a short walk or a power nap." },
  { title: 'Tech Discovery', emoji: '🚀', category: 'technology',
    content: 'Try a new feature in Nunba today — explore the Games Hub or check the Activity Hub.' },
  { title: 'Game Break', emoji: '🎮', category: 'games',
    content: 'Challenge a friend to a quick game — trivia, word scrambles, or collab puzzles in the Games Hub.' },
];

export function getDailyContent(config) {
  const c = config || DEFAULT_CONFIG;
  const interests = c.interests || [];
  const dayIndex = new Date().getDay();
  const interestTips = DAILY_TIPS.filter((t) => interests.includes(t.category));
  const pool = interestTips.length > 0 ? interestTips : DAILY_TIPS;
  return pool[dayIndex % pool.length];
}

export const INTEREST_OPTIONS = [
  'Technology',
  'Health',
  'Education',
  'Environment',
  'Community',
  'Creativity',
];

export const AGENT_OPTIONS = [
  { key: 'games',    label: 'Games Agent',    desc: 'Suggest games based on your activity', icon: 'sports-esports' },
  { key: 'learning', label: 'Learning Agent', desc: 'Track progress + suggest content', icon: 'school' },
  { key: 'content',  label: 'Content Agent',  desc: 'Curate feed based on your interests', icon: 'article' },
  { key: 'wellness', label: 'Wellness Agent', desc: 'Break reminders + health nudges', icon: 'favorite-border' },
  { key: 'social',   label: 'Social Agent',   desc: 'Community engagement prompts', icon: 'group' },
  { key: 'creative', label: 'Creative Agent', desc: 'Creative challenges + prompts', icon: 'palette' },
];

export const AUTOMATION_OPTIONS = [
  { key: 'dailyDigest',      label: 'Daily Digest',       desc: 'Morning news + content summary',         icon: '📰' },
  { key: 'smartReminders',   label: 'Smart Reminders',    desc: 'Time-based activity suggestions',        icon: '⏰' },
  { key: 'healthNudges',     label: 'Health Nudges',      desc: 'Break reminders + activity tracking',    icon: '💚' },
  { key: 'contentCuration',  label: 'Content Curation',   desc: 'Interest-based feed filtering',          icon: '✨' },
  { key: 'gameSuggestions',  label: 'Game Suggestions',   desc: 'Game recs based on activity',            icon: '🎮' },
  { key: 'agentObservation', label: 'Agent Learning',     desc: 'Let Nunba observe usage to improve (privacy-safe)', icon: '🧠' },
];

export const AGENT_MODES = [
  { key: 'suggest', label: 'Suggest', desc: 'Agents suggest, you decide' },
  { key: 'auto',    label: 'Auto',    desc: 'Agents act and chain automatically' },
  { key: 'off',     label: 'Off',     desc: 'No agent activity' },
];
