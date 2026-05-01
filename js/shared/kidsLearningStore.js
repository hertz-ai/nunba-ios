import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

let _persistTimer = null;

const STORAGE_KEYS = {
  progress: '@kidsLearning:progress',
  history: '@kidsLearning:history',
  stars: '@kidsLearning:totalStars',
  customGames: '@kidsLearning:customGames',
  pendingSync: '@kidsLearning:pendingSync',
};

const defaultProgress = {gamesPlayed: 0, totalScore: 0, bestScore: 0, lastPlayed: null};

const useKidsLearningStore = create((set, get) => ({
  // Age group derived from profile: 'early' (4-6), 'middle' (7-9), 'upper' (10-12)
  ageGroup: null,
  difficultyLevel: 1,

  // Current game session
  currentGame: null,
  currentScore: 0,
  currentStreak: 0,
  bestStreak: 0,
  questionsAnswered: 0,
  questionsCorrect: 0,
  sessionStars: 0,

  // Category progress
  englishProgress: {...defaultProgress},
  mathProgress: {...defaultProgress},
  lifeSkillsProgress: {...defaultProgress},
  scienceProgress: {...defaultProgress},
  creativityProgress: {...defaultProgress},

  // Stars
  totalStars: 0,

  // Network
  isOnline: true,

  // Game history
  gameHistory: [],

  // Custom games created by parents/teachers
  customGames: [],

  // Loading
  loading: false,
  fetchingQuestion: false,
  initialized: false,

  // Initialize from AsyncStorage
  initialize: async () => {
    try {
      const [progressStr, historyStr, starsStr, customStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.progress),
        AsyncStorage.getItem(STORAGE_KEYS.history),
        AsyncStorage.getItem(STORAGE_KEYS.stars),
        AsyncStorage.getItem(STORAGE_KEYS.customGames),
      ]);
      const progress = progressStr ? JSON.parse(progressStr) : {};
      const history = historyStr ? JSON.parse(historyStr) : [];
      const stars = starsStr ? parseInt(starsStr, 10) : 0;
      const custom = customStr ? JSON.parse(customStr) : [];
      set({
        englishProgress: progress.english || {...defaultProgress},
        mathProgress: progress.math || {...defaultProgress},
        lifeSkillsProgress: progress.lifeSkills || {...defaultProgress},
        scienceProgress: progress.science || {...defaultProgress},
        creativityProgress: progress.creativity || {...defaultProgress},
        gameHistory: history,
        totalStars: stars,
        customGames: custom,
        initialized: true,
      });
    } catch (e) {
      console.warn('kidsLearningStore: initialize failed', e);
      set({initialized: true});
    }
  },

  // Persist to AsyncStorage
  persist: async () => {
    const state = get();
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({
          english: state.englishProgress,
          math: state.mathProgress,
          lifeSkills: state.lifeSkillsProgress,
          science: state.scienceProgress,
          creativity: state.creativityProgress,
        })),
        AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.gameHistory)),
        AsyncStorage.setItem(STORAGE_KEYS.stars, String(state.totalStars)),
        AsyncStorage.setItem(STORAGE_KEYS.customGames, JSON.stringify(state.customGames)),
      ]);
    } catch (e) {
      console.warn('kidsLearningStore: persist failed', e);
    }
  },

  // Actions
  setAgeGroup: (ageGroup) => set({ageGroup}),
  setDifficultyLevel: (level) => set({difficultyLevel: level}),
  setIsOnline: (online) => set({isOnline: online}),
  setLoading: (loading) => set({loading}),
  setFetchingQuestion: (fetching) => set({fetchingQuestion: fetching}),

  startGame: (gameInfo) => set({
    currentGame: gameInfo,
    currentScore: 0,
    currentStreak: 0,
    bestStreak: 0,
    questionsAnswered: 0,
    questionsCorrect: 0,
    sessionStars: 0,
  }),

  recordAnswer: (isCorrect, points = 10) => {
    if (typeof points !== 'number' || !isFinite(points) || points < 0) {
      console.warn('kidsLearningStore: recordAnswer received invalid points, defaulting to 10');
      points = 10;
    }
    const state = get();
    const newStreak = isCorrect ? state.currentStreak + 1 : 0;
    const streakMultiplier = newStreak >= 5 ? 3 : newStreak >= 3 ? 2 : 1;
    const starsEarned = isCorrect ? streakMultiplier : 0;
    set({
      currentScore: state.currentScore + (isCorrect ? points * streakMultiplier : 0),
      currentStreak: newStreak,
      bestStreak: Math.max(newStreak, state.bestStreak),
      questionsAnswered: state.questionsAnswered + 1,
      questionsCorrect: state.questionsCorrect + (isCorrect ? 1 : 0),
      sessionStars: state.sessionStars + starsEarned,
      totalStars: state.totalStars + starsEarned,
    });
  },

  completeGame: () => {
    const state = get();
    if (!state.currentGame) return null;
    const {category} = state.currentGame;
    const progressKeyMap = {
      english: 'englishProgress',
      math: 'mathProgress',
      lifeSkills: 'lifeSkillsProgress',
      science: 'scienceProgress',
      creativity: 'creativityProgress',
    };
    const progressKey = progressKeyMap[category] || 'englishProgress';
    const prev = state[progressKey];

    // Bonus stars for perfect game
    const isPerfect = state.questionsCorrect === state.questionsAnswered && state.questionsAnswered > 0;
    const bonusStars = isPerfect ? 5 : 0;

    const result = {
      gameId: state.currentGame.id,
      gameTitle: state.currentGame.title,
      category,
      score: state.currentScore,
      stars: state.sessionStars + bonusStars,
      correct: state.questionsCorrect,
      total: state.questionsAnswered,
      bestStreak: state.bestStreak,
      isPerfect,
      date: new Date().toISOString(),
    };

    set({
      [progressKey]: {
        gamesPlayed: prev.gamesPlayed + 1,
        totalScore: prev.totalScore + state.currentScore,
        bestScore: Math.max(prev.bestScore, state.currentScore),
        lastPlayed: new Date().toISOString(),
      },
      totalStars: state.totalStars + bonusStars,
      gameHistory: [result, ...state.gameHistory].slice(0, 100),
      currentGame: null,
    });

    // Persist after game complete
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => get().persist(), 100);

    return result;
  },

  // Custom games management
  addCustomGame: (gameConfig) => {
    const state = get();
    const updated = [gameConfig, ...state.customGames];
    set({customGames: updated});
    AsyncStorage.setItem(STORAGE_KEYS.customGames, JSON.stringify(updated)).catch((e) => {
      console.warn('kidsLearningStore: addCustomGame persist failed', e);
    });
  },

  removeCustomGame: (gameId) => {
    const state = get();
    const updated = state.customGames.filter(g => g.id !== gameId);
    set({customGames: updated});
    AsyncStorage.setItem(STORAGE_KEYS.customGames, JSON.stringify(updated)).catch((e) => {
      console.warn('kidsLearningStore: removeCustomGame persist failed', e);
    });
  },

  // Queue result for sync when offline
  queueForSync: async (result) => {
    try {
      const pendingStr = await AsyncStorage.getItem(STORAGE_KEYS.pendingSync);
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      pending.push(result);
      await AsyncStorage.setItem(STORAGE_KEYS.pendingSync, JSON.stringify(pending));
    } catch (e) {
      console.warn('kidsLearningStore: queueForSync failed', e);
    }
  },

  getPendingSync: async () => {
    try {
      const pendingStr = await AsyncStorage.getItem(STORAGE_KEYS.pendingSync);
      return pendingStr ? JSON.parse(pendingStr) : [];
    } catch (e) {
      return [];
    }
  },

  clearPendingSync: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.pendingSync);
    } catch (e) {
      console.warn('kidsLearningStore: clearPendingSync failed', e);
    }
  },

  reset: () => {
    set({
      currentGame: null, currentScore: 0, currentStreak: 0, bestStreak: 0,
      questionsAnswered: 0, questionsCorrect: 0, sessionStars: 0,
      englishProgress: {...defaultProgress}, mathProgress: {...defaultProgress},
      lifeSkillsProgress: {...defaultProgress}, scienceProgress: {...defaultProgress},
      creativityProgress: {...defaultProgress},
      totalStars: 0, gameHistory: [], customGames: [],
      loading: false, fetchingQuestion: false,
    });
  },
}));

export default useKidsLearningStore;
