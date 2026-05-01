import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

let _persistTimer = null;

const STORAGE_KEY = '@kidsMedia:state';

const useKidsMediaStore = create((set, get) => ({
  // Network state
  isOnline: true,

  // Audio state
  isMuted: false,
  masterVolume: 1.0,

  // Active media jobs: { jobId: { type, status, progress, createdAt } }
  activeJobs: {},

  // Cache statistics
  cacheStats: {totalSize: 0, ttsCount: 0, musicCount: 0, videoCount: 0},

  // Offline media request queue
  pendingQueue: [],

  // Loading
  initialized: false,

  // Initialize from AsyncStorage
  initialize: async () => {
    try {
      const stateStr = await AsyncStorage.getItem(STORAGE_KEY);
      if (stateStr) {
        const saved = JSON.parse(stateStr);
        set({
          isMuted: saved.isMuted ?? false,
          masterVolume: saved.masterVolume ?? 1.0,
          cacheStats: saved.cacheStats ?? {totalSize: 0, ttsCount: 0, musicCount: 0, videoCount: 0},
          pendingQueue: saved.pendingQueue ?? [],
          initialized: true,
        });
      } else {
        set({initialized: true});
      }
    } catch (e) {
      console.warn('kidsMediaStore: initialize failed', e);
      set({initialized: true});
    }
  },

  // Persist to AsyncStorage
  persist: async () => {
    const state = get();
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        isMuted: state.isMuted,
        masterVolume: state.masterVolume,
        cacheStats: state.cacheStats,
        pendingQueue: state.pendingQueue,
      }));
    } catch (e) {
      console.warn('kidsMediaStore: persist failed', e);
    }
  },

  // Actions
  setOnline: (online) => set({isOnline: online}),

  setMuted: (muted) => {
    set({isMuted: muted});
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => get().persist(), 100);
  },

  setMasterVolume: (volume) => {
    set({masterVolume: Math.max(0, Math.min(1, volume))});
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => get().persist(), 100);
  },

  addJob: (jobId, type) => {
    const state = get();
    set({
      activeJobs: {
        ...state.activeJobs,
        [jobId]: {type, status: 'pending', progress: 0, createdAt: Date.now()},
      },
    });
  },

  updateJob: (jobId, updates) => {
    const state = get();
    const job = state.activeJobs[jobId];
    if (!job) return;
    set({
      activeJobs: {
        ...state.activeJobs,
        [jobId]: {...job, ...updates},
      },
    });
  },

  removeJob: (jobId) => {
    const state = get();
    const {[jobId]: _, ...remaining} = state.activeJobs;
    set({activeJobs: remaining});
  },

  queueMediaRequest: (request) => {
    const state = get();
    set({
      pendingQueue: [...state.pendingQueue, {
        ...request,
        queuedAt: Date.now(),
      }],
    });
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => get().persist(), 100);
  },

  processMediaQueue: async (handler) => {
    const state = get();
    if (!state.isOnline || state.pendingQueue.length === 0) return;

    const queue = [...state.pendingQueue];
    const remaining = [];

    for (const request of queue) {
      try {
        await handler(request);
      } catch (e) {
        // Keep failed requests in queue for retry
        remaining.push(request);
      }
    }

    set({pendingQueue: remaining});
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => get().persist(), 100);
  },

  updateCacheStats: (stats) => {
    set({cacheStats: stats});
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => get().persist(), 100);
  },
}));

export default useKidsMediaStore;
