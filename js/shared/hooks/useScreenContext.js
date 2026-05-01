import { useMemo } from 'react';
import useEncounterStore from '../encounterStore';
import useExperimentStore from '../experimentStore';
import useGamificationStore from '../gamificationStore';
import useKidsIntelligenceStore from '../kidsIntelligenceStore';
import useContextAwarenessStore from '../contextAwarenessStore';
import { getLevelProgress } from '../utils/gamification';

// Zustand selectors — subscribe only to the slice each screen needs
const encounterSelector = (s) => ({
  nearbyCount: s.nearbyCount,
  isTracking: s.isTracking,
  matchCount: s.matches?.length || 0,
});

const experimentSelector = (s) => ({
  userIntents: s.userIntents,
  experimentCount: s.experiments?.length || 0,
});

const gamificationSelector = (s) => ({
  activeChallenges: s.activeChallenges,
  wallet: s.wallet,
  userAchievements: s.userAchievements,
  onboardingProgress: s.onboardingProgress,
});

const kidsSelector = (s) => s.conceptMap;

const awarenessSelector = (s) => s._pendingTasks;

const useScreenContext = (screenName) => {
  const encounterData = useEncounterStore(encounterSelector);
  const experimentData = useExperimentStore(experimentSelector);
  const gamData = useGamificationStore(gamificationSelector);
  const conceptMap = useKidsIntelligenceStore(kidsSelector);
  const pendingTasks = useContextAwarenessStore(awarenessSelector);

  const data = useMemo(() => {
    switch (screenName) {
      case 'Encounters': {
        return {
          nearbyCount: encounterData.nearbyCount,
          isTracking: encounterData.isTracking,
          matchCount: encounterData.matchCount,
        };
      }
      case 'Challenges': {
        const active = gamData.activeChallenges || [];
        const now = Date.now();
        const endingSoon = active.filter((c) => {
          const end = new Date(c.end_time || c.endTime || 0).getTime();
          return end - now < 24 * 60 * 60 * 1000 && end > now;
        });
        return {
          activeCount: active.length,
          endingSoonCount: endingSoon.length,
          streakDays: gamData.wallet?.streak_days || 0,
        };
      }
      case 'Experiments': {
        const intents = experimentData.userIntents || {};
        const top = Object.entries(intents).sort((a, b) => b[1] - a[1])[0];
        return {
          userTopIntent: top ? top[0] : null,
          newCount: experimentData.experimentCount,
        };
      }
      case 'Achievements': {
        const ua = gamData.userAchievements || [];
        const unlocked = ua.filter((a) => a.unlocked_at || a.completed);
        const nearComplete = ua.filter((a) => {
          if (a.unlocked_at || a.completed) return false;
          const progress = a.progress || 0;
          const target = a.target || a.criteria_target || 1;
          return progress / target > 0.75;
        });
        return {
          unlockedCount: unlocked.length,
          totalCount: ua.length,
          nearCompleteCount: nearComplete.length,
        };
      }
      case 'Resonance': {
        const w = gamData.wallet;
        if (!w) return { level: 1, streakDays: 0, sparkBalance: 0, nearLevelUp: false };
        const level = w.level || 1;
        const xp = w.xp || 0;
        const progress = getLevelProgress(level, xp);
        return {
          level,
          streakDays: w.streak_days || 0,
          sparkBalance: w.spark || 0,
          nearLevelUp: progress > 0.75,
        };
      }
      case 'KidsHub': {
        const cm = conceptMap || {};
        const now = Date.now();
        const dueCount = Object.values(cm).filter((c) =>
          c.nextReviewDate && new Date(c.nextReviewDate).getTime() <= now
        ).length;
        return {
          totalStars: 0,
          reviewDueCount: dueCount,
        };
      }
      case 'Tasks': {
        return {
          pendingCount: pendingTasks || 0,
        };
      }
      default:
        return {};
    }
  }, [screenName, encounterData, experimentData, gamData, conceptMap, pendingTasks]);

  return { data, loading: false };
};

export default useScreenContext;
