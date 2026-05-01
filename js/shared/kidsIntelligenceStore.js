import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

let _persistTimer = null;

const STORAGE_KEY = '@kidsLearning:intelligence';

// Spaced repetition intervals (in days)
const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

const useKidsIntelligenceStore = create((set, get) => ({
  // Per-concept tracking: { "category:concept": ConceptData }
  conceptMap: {},
  initialized: false,

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({conceptMap: JSON.parse(stored), initialized: true});
      } else {
        set({initialized: true});
      }
    } catch (e) {
      console.warn('kidsIntelligenceStore: initialize failed', e);
      set({initialized: true});
    }
  },

  persist: async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(get().conceptMap));
    } catch (e) {
      console.warn('kidsIntelligenceStore: persist failed', e);
    }
  },

  // Record an answer for a concept
  recordConceptAnswer: (conceptKey, isCorrect, responseTimeMs) => {
    const {conceptMap} = get();
    const now = new Date().toISOString();
    const existing = conceptMap[conceptKey];

    if (!existing) {
      // First time seeing this concept - Registration tracking
      const newConcept = {
        firstSeen: now,
        timesPresented: 1,
        timesCorrect: isCorrect ? 1 : 0,
        registration: {
          firstAttemptCorrect: isCorrect,
          attemptsToMaster: isCorrect ? 1 : null, // null = not yet mastered
          mastered: isCorrect,
        },
        retention: {
          lastTested: now,
          score: isCorrect ? 1.0 : 0.0,
          nextReview: get().calculateNextReview(now, 0, isCorrect),
          reviewLevel: 0,
        },
        recall: {
          responseTimes: [responseTimeMs],
          avgResponseTimeMs: responseTimeMs,
          timedAccuracy: isCorrect ? 1.0 : 0.0,
          totalTimed: 1,
          correctTimed: isCorrect ? 1 : 0,
        },
      };
      set({conceptMap: {...conceptMap, [conceptKey]: newConcept}});
    } else {
      // Updating existing concept
      const timesPresented = existing.timesPresented + 1;
      const timesCorrect = existing.timesCorrect + (isCorrect ? 1 : 0);

      // Registration update
      const registration = {...existing.registration};
      if (!registration.mastered && isCorrect) {
        registration.attemptsToMaster = timesPresented;
        registration.mastered = true;
      }

      // Retention update (spaced repetition)
      const retention = {...existing.retention};
      retention.lastTested = now;
      const daysSinceLast = get().daysBetween(existing.retention.lastTested, now);
      if (daysSinceLast >= 1) {
        // This is a retention test (enough time has passed)
        const newLevel = isCorrect
          ? Math.min(retention.reviewLevel + 1, REVIEW_INTERVALS.length - 1)
          : Math.max(retention.reviewLevel - 1, 0);
        retention.reviewLevel = newLevel;
        retention.score = timesCorrect / timesPresented;
        retention.nextReview = get().calculateNextReview(now, newLevel, isCorrect);
      }

      // Recall update
      const responseTimes = [...existing.recall.responseTimes, responseTimeMs].slice(-20);
      const avgResponseTimeMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const correctTimed = existing.recall.correctTimed + (isCorrect ? 1 : 0);
      const totalTimed = existing.recall.totalTimed + 1;

      const updated = {
        ...existing,
        timesPresented,
        timesCorrect,
        registration,
        retention,
        recall: {
          responseTimes,
          avgResponseTimeMs,
          timedAccuracy: correctTimed / totalTimed,
          totalTimed,
          correctTimed,
        },
      };
      set({conceptMap: {...conceptMap, [conceptKey]: updated}});
    }
    // Persist after update
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => get().persist(), 100);
  },

  // Calculate next review date based on spaced repetition
  calculateNextReview: (fromDate, level, wasCorrect) => {
    const days = wasCorrect
      ? REVIEW_INTERVALS[Math.min(level, REVIEW_INTERVALS.length - 1)]
      : 1; // If wrong, review tomorrow
    const date = new Date(fromDate);
    date.setDate(date.getDate() + days);
    return date.toISOString();
  },

  daysBetween: (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  },

  // Get concepts due for retention review
  getConceptsDueForReview: (category) => {
    const {conceptMap} = get();
    const now = new Date().toISOString();
    return Object.entries(conceptMap)
      .filter(([key, data]) => {
        if (category && !key.startsWith(category + ':')) return false;
        return data.retention.nextReview <= now;
      })
      .map(([key, data]) => ({key, ...data}))
      .sort((a, b) => a.retention.nextReview.localeCompare(b.retention.nextReview));
  },

  // Get weak concepts (low recall accuracy or low retention)
  getWeakConcepts: (category, limit = 10) => {
    const {conceptMap} = get();
    return Object.entries(conceptMap)
      .filter(([key]) => !category || key.startsWith(category + ':'))
      .map(([key, data]) => ({
        key,
        weakness: (1 - data.recall.timedAccuracy) + (1 - data.retention.score),
        ...data,
      }))
      .sort((a, b) => b.weakness - a.weakness)
      .slice(0, limit);
  },

  // Get 3R summary for a category
  getThreeRSummary: (category) => {
    const {conceptMap} = get();
    const concepts = Object.entries(conceptMap)
      .filter(([key]) => !category || key.startsWith(category + ':'));

    if (concepts.length === 0) {
      return {registration: 0, retention: 0, recall: 0, totalConcepts: 0};
    }

    let regTotal = 0, retTotal = 0, recTotal = 0;
    concepts.forEach(([, data]) => {
      regTotal += data.registration.mastered ? 1 : 0;
      retTotal += data.retention.score;
      recTotal += data.recall.timedAccuracy;
    });

    const count = concepts.length;
    return {
      registration: Math.round((regTotal / count) * 100),
      retention: Math.round((retTotal / count) * 100),
      recall: Math.round((recTotal / count) * 100),
      totalConcepts: count,
    };
  },

  // Get adaptive next question parameters
  getAdaptiveParams: (category) => {
    const dueForReview = get().getConceptsDueForReview(category);
    const weakConcepts = get().getWeakConcepts(category, 5);

    if (dueForReview.length > 0) {
      // Prioritize retention review
      return {
        type: 'retention',
        concept: dueForReview[0].key,
        difficulty: Math.max(1, 3 - dueForReview[0].retention.reviewLevel),
      };
    }

    if (weakConcepts.length > 0 && weakConcepts[0].weakness > 0.5) {
      // Practice weak recall areas
      return {
        type: 'recall',
        concept: weakConcepts[0].key,
        difficulty: 2,
      };
    }

    // Introduce new concepts (registration)
    return {
      type: 'registration',
      concept: null,
      difficulty: 1,
    };
  },

  reset: () => {
    set({conceptMap: {}, initialized: false});
    AsyncStorage.removeItem(STORAGE_KEY).catch((e) => {
      console.warn('kidsIntelligenceStore: reset persist failed', e);
    });
  },
}));

export default useKidsIntelligenceStore;
