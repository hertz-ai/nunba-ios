import { create } from 'zustand';
import useEncounterStore from './encounterStore';
import useExperimentStore from './experimentStore';
import useGamificationStore from './gamificationStore';
import useKidsIntelligenceStore from './kidsIntelligenceStore';
import {
  notificationsApi,
  tasksApi,
  resonanceApi,
  challengesApi,
  achievementsApi,
} from './services/socialApi';
import { XP_THRESHOLDS, getLevelProgress } from './utils/gamification';
import { getTimeOfDay, getGreeting } from './utils/timeOfDay';
import { INTENT_COLORS } from './theme/colors';

// Priority modifiers by time of day
const TIME_BOOSTS = {
  morning: { challenges_ending: 2, streak_active: 3, onboarding: 1 },
  afternoon: { experiment_trending: 2, tasks_pending: 2 },
  evening: { encounters_nearby: 3, experiment_trending: 2, kids_review: 2 },
  night: { streak_active: 2, achievement_near: 1 },
};

const MAX_SIGNALS = 6;

// Shallow-compare signal arrays by id + title (skip set() if unchanged)
function signalsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].title !== b[i].title) return false;
  }
  return true;
}

const useContextAwarenessStore = create((set, get) => ({
  signals: [],
  timeOfDay: getTimeOfDay(),
  greeting: getGreeting(getTimeOfDay()),
  refreshing: false,
  lastRefreshed: null,
  celebrationEvent: null,
  _celebrationTimer: null,

  // Fetched context (not in other stores)
  _unreadCount: 0,
  _pendingTasks: 0,
  _activeChallengesDetail: [],

  refreshAllSignals: async () => {
    set({ refreshing: true });
    const tod = getTimeOfDay();
    set({ timeOfDay: tod, greeting: getGreeting(tod) });

    // Parallel API fetches for data not in existing stores
    const fetches = [
      notificationsApi.list({ limit: 1 })
        .then((r) => {
          const unread = r?.data?.filter?.((n) => !n.is_read)?.length ?? r?.unread_count ?? 0;
          set({ _unreadCount: unread });
        })
        .catch(() => {}),
      tasksApi.list({ status: 'pending', limit: 1 })
        .then((r) => {
          set({ _pendingTasks: r?.data?.length ?? r?.count ?? 0 });
        })
        .catch(() => {}),
      resonanceApi.getWallet()
        .then((r) => {
          if (r?.data) useGamificationStore.getState().setWallet(r.data);
        })
        .catch(() => {}),
      challengesApi.list({ status: 'active' })
        .then((r) => {
          const list = r?.data || [];
          set({ _activeChallengesDetail: list });
          useGamificationStore.getState().setActiveChallenges(list);
        })
        .catch(() => {}),
      achievementsApi.list()
        .then((r) => {
          if (r?.data) useGamificationStore.getState().setUserAchievements(r.data);
        })
        .catch(() => {}),
    ];

    await Promise.allSettled(fetches);
    get().computeSignals();
    set({ refreshing: false, lastRefreshed: Date.now() });
  },

  computeSignals: () => {
    const state = get();
    const tod = state.timeOfDay;
    const timeBoost = TIME_BOOSTS[tod] || {};
    const signals = [];

    // --- encounters_nearby ---
    const enc = useEncounterStore.getState();
    if (enc.nearbyCount > 0) {
      signals.push({
        id: 'encounters_nearby',
        type: 'encounters_nearby',
        screen: 'Encounters',
        priority: 7 + (timeBoost.encounters_nearby || 0),
        title: `${enc.nearbyCount} nearby`,
        subtitle: enc.nearbyCount === 1 ? 'Someone is close' : 'People around you',
        icon: 'people',
        iconType: 'material',
        color: '#00e89d',
        data: { nearbyCount: enc.nearbyCount },
      });
    }

    // --- challenges_ending ---
    const now = Date.now();
    const endingSoon = (state._activeChallengesDetail || []).filter((c) => {
      if (!c.end_time && !c.endTime) return false;
      const end = new Date(c.end_time || c.endTime).getTime();
      return end - now < 24 * 60 * 60 * 1000 && end > now;
    });
    if (endingSoon.length > 0) {
      const hoursLeft = Math.max(1, Math.round((new Date(endingSoon[0].end_time || endingSoon[0].endTime).getTime() - now) / 3600000));
      signals.push({
        id: 'challenges_ending',
        type: 'challenges_ending',
        screen: 'Challenges',
        priority: 9 + (timeBoost.challenges_ending || 0),
        title: `Ends in ${hoursLeft}h`,
        subtitle: endingSoon[0].title || 'Challenge expiring',
        icon: 'flag-checkered',
        iconType: 'community',
        color: '#EF4444',
        data: { challenge: endingSoon[0], count: endingSoon.length },
      });
    }

    // --- streak_active ---
    const gam = useGamificationStore.getState();
    const wallet = gam.wallet;
    if (wallet && wallet.streak_days > 0) {
      signals.push({
        id: 'streak_active',
        type: 'streak_active',
        screen: 'ResonanceDashboard',
        priority: 5 + (timeBoost.streak_active || 0) + (wallet.streak_days >= 7 ? 2 : 0),
        title: `${wallet.streak_days}-day streak`,
        subtitle: wallet.streak_days >= 7 ? 'Keep it going!' : 'Check in to extend',
        icon: 'local-fire-department',
        iconType: 'material',
        color: '#FFD700',
        data: { streakDays: wallet.streak_days },
      });
    }

    // --- level_progress ---
    if (wallet && wallet.xp !== undefined) {
      const level = wallet.level || 1;
      const currentXp = wallet.xp || 0;
      const progress = getLevelProgress(level, currentXp);
      if (progress > 0.75) {
        signals.push({
          id: 'level_progress',
          type: 'level_progress',
          screen: 'ResonanceDashboard',
          priority: 6 + (timeBoost.level_progress || 0),
          title: `Almost level ${level + 1}`,
          subtitle: `${Math.round(progress * 100)}% there`,
          icon: 'arrow-up-circle',
          iconType: 'community',
          color: '#10B981',
          data: { level, progress, xp: currentXp },
        });
      }
    }

    // --- experiment_trending ---
    const exp = useExperimentStore.getState();
    const intents = exp.userIntents || {};
    const topIntent = Object.entries(intents).sort((a, b) => b[1] - a[1])[0];
    if (topIntent) {
      signals.push({
        id: 'experiment_trending',
        type: 'experiment_trending',
        screen: 'ExperimentDiscovery',
        priority: 5 + (timeBoost.experiment_trending || 0),
        title: `New in ${topIntent[0].charAt(0).toUpperCase() + topIntent[0].slice(1)}`,
        subtitle: 'Thought experiments for you',
        icon: 'flask',
        iconType: 'community',
        color: INTENT_COLORS[topIntent[0]] || '#6C63FF',
        data: { intent: topIntent[0], weight: topIntent[1] },
      });
    }

    // --- achievement_near ---
    const ua = gam.userAchievements || [];
    const nearComplete = ua.filter((a) => {
      if (a.unlocked_at || a.completed) return false;
      const progress = a.progress || 0;
      const target = a.target || a.criteria_target || 1;
      return progress / target > 0.75;
    });
    if (nearComplete.length > 0) {
      signals.push({
        id: 'achievement_near',
        type: 'achievement_near',
        screen: 'Achievements',
        priority: 6 + (timeBoost.achievement_near || 0),
        title: nearComplete.length === 1 ? '1 almost unlocked' : `${nearComplete.length} almost unlocked`,
        subtitle: nearComplete[0].title || 'Keep going',
        icon: 'trophy',
        iconType: 'ion',
        color: '#F59E0B',
        data: { achievements: nearComplete },
      });
    }

    // --- kids_review ---
    const ki = useKidsIntelligenceStore.getState();
    const conceptMap = ki.conceptMap || {};
    const todayMs = Date.now();
    const dueCount = Object.values(conceptMap).filter((c) => {
      if (!c.nextReviewDate) return false;
      return new Date(c.nextReviewDate).getTime() <= todayMs;
    }).length;
    if (dueCount > 0) {
      signals.push({
        id: 'kids_review',
        type: 'kids_review',
        screen: 'KidsHub',
        priority: 5 + (timeBoost.kids_review || 0),
        title: `${dueCount} to review`,
        subtitle: 'Concepts need practice',
        icon: 'school',
        iconType: 'community',
        color: '#6C63FF',
        data: { dueCount },
      });
    }

    // --- notifications_unread ---
    if (state._unreadCount > 0) {
      signals.push({
        id: 'notifications_unread',
        type: 'notifications_unread',
        screen: 'Notifications',
        priority: 4 + (state._unreadCount >= 5 ? 2 : 0),
        title: `${state._unreadCount} unread`,
        subtitle: 'New alerts',
        icon: 'notifications',
        iconType: 'ion',
        color: '#FF6B35',
        data: { count: state._unreadCount },
      });
    }

    // --- tasks_pending ---
    if (state._pendingTasks > 0) {
      signals.push({
        id: 'tasks_pending',
        type: 'tasks_pending',
        screen: 'Tasks',
        priority: 5 + (timeBoost.tasks_pending || 0),
        title: `${state._pendingTasks} pending`,
        subtitle: 'Tasks waiting',
        icon: 'clipboard-check',
        iconType: 'community',
        color: '#00D9FF',
        data: { count: state._pendingTasks },
      });
    }

    // --- onboarding ---
    const op = gam.onboardingProgress;
    if (op && !op.completed_at && !op.tutorial_dismissed) {
      signals.push({
        id: 'onboarding',
        type: 'onboarding',
        screen: 'Onboarding',
        priority: 8 + (timeBoost.onboarding || 0),
        title: 'Get started',
        subtitle: 'Complete your profile',
        icon: 'rocket-launch',
        iconType: 'community',
        color: '#8B5CF6',
        data: { step: op.current_step },
      });
    }

    // Sort by priority descending, cap at MAX_SIGNALS
    signals.sort((a, b) => b.priority - a.priority);
    const newSignals = signals.slice(0, MAX_SIGNALS);

    // Only trigger re-renders if signals actually changed
    if (!signalsEqual(newSignals, state.signals)) {
      set({ signals: newSignals });
    }
  },

  setCelebrationEvent: (event) => {
    // Cancel any pending clear timer
    const prev = get()._celebrationTimer;
    if (prev) clearTimeout(prev);

    const timer = setTimeout(() => {
      set({ celebrationEvent: null, _celebrationTimer: null });
    }, 4000);
    set({ celebrationEvent: event, _celebrationTimer: timer });
  },

  clearSignals: () => set({ signals: [], _unreadCount: 0, _pendingTasks: 0 }),
}));

export default useContextAwarenessStore;
