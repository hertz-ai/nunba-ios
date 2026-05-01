import { create } from 'zustand';
import { dashboardApi, trackerApi } from './services/socialApi';

const useExperimentStore = create((set) => ({
  experiments: [],
  recommended: [],
  loading: false,
  intentFilter: null,
  typeFilter: null,
  offset: 0,
  hasMore: true,
  selectedMetrics: null,
  userIntents: {},

  // Hive state
  hiveAgents: [],
  hiveSummary: {},
  hiveLoading: false,
  selectedHiveAgent: null,
  hiveFilter: 'all', // all | active | needs_review
  hiveConversations: [],
  hiveConversationsLoading: false,
  interviewMessages: [],
  interviewLoading: false,

  setExperiments: (list) => set({ experiments: list }),
  appendExperiments: (list) =>
    set((s) => ({ experiments: [...s.experiments, ...list] })),
  setRecommended: (list) => set({ recommended: list }),
  setLoading: (val) => set({ loading: val }),
  setIntentFilter: (val) => set({ intentFilter: val }),
  setTypeFilter: (val) => set({ typeFilter: val }),
  setOffset: (n) => set({ offset: n }),
  setHasMore: (val) => set({ hasMore: val }),
  setSelectedMetrics: (data) => set({ selectedMetrics: data }),
  setUserIntents: (obj) => set({ userIntents: obj }),

  // Hive actions
  fetchHiveAgents: async () => {
    set({ hiveLoading: true });
    try {
      const res = await dashboardApi.agents();
      const data = res?.data || res;
      if (data?.agents) {
        set({ hiveAgents: data.agents, hiveSummary: data.summary || {} });
      }
    } catch (e) {
      console.warn('fetchHiveAgents:', e);
    }
    set({ hiveLoading: false });
  },

  selectHiveAgent: (agent) => set({ selectedHiveAgent: agent }),
  setHiveFilter: (filter) => set({ hiveFilter: filter }),

  fetchHiveConversations: async (postId) => {
    set({ hiveConversationsLoading: true });
    try {
      const res = await trackerApi.getConversations(postId);
      set({ hiveConversations: res?.data || [] });
    } catch (e) {
      console.warn('fetchHiveConversations:', e);
    }
    set({ hiveConversationsLoading: false });
  },

  injectVariable: async (postId, data) => {
    try {
      const res = await trackerApi.inject(postId, data);
      return res;
    } catch {
      return { success: false };
    }
  },

  sendInterview: async (postId, question) => {
    set({ interviewLoading: true });
    try {
      const res = await trackerApi.interview(postId, { question });
      const answer = res?.data?.answer || res?.answer || 'No response.';
      set((s) => ({
        interviewMessages: [
          ...s.interviewMessages,
          { role: 'user', text: question },
          { role: 'agent', text: answer },
        ],
      }));
      return res;
    } catch (e) {
      set((s) => ({
        interviewMessages: [
          ...s.interviewMessages,
          { role: 'user', text: question },
          { role: 'agent', text: 'Error: could not reach agent.' },
        ],
      }));
      return { success: false };
    } finally {
      set({ interviewLoading: false });
    }
  },

  clearInterview: () => set({ interviewMessages: [] }),

  reset: () =>
    set({
      experiments: [],
      recommended: [],
      offset: 0,
      hasMore: true,
      selectedMetrics: null,
    }),

  resetHive: () =>
    set({
      hiveAgents: [],
      hiveSummary: {},
      selectedHiveAgent: null,
      hiveFilter: 'all',
      hiveConversations: [],
      interviewMessages: [],
    }),
}));

export default useExperimentStore;
