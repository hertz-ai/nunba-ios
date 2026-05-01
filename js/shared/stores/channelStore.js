import { create } from 'zustand';
import { channelsApi } from './services/socialApi';

const useChannelStore = create((set) => ({
  // Bindings (user's connected channels)
  bindings: [],
  bindingsLoading: false,

  // Catalog (all available channel types)
  catalog: {},
  catalogLoading: false,

  // Presence
  presence: [],

  // Pairing
  pairCode: null,
  pairQrUrl: '',

  // Conversation history
  conversations: [],
  conversationsLoading: false,
  conversationsHasMore: true,

  // Actions
  setBindings: (bindings) => set({ bindings }),
  setBindingsLoading: (loading) => set({ bindingsLoading: loading }),
  setCatalog: (catalog) => set({ catalog }),
  setCatalogLoading: (loading) => set({ catalogLoading: loading }),
  setPresence: (presence) => set({ presence }),
  setPairCode: (code) => set({ pairCode: code }),
  setPairQrUrl: (url) => set({ pairQrUrl: url }),
  setConversations: (conversations) => set({ conversations }),
  setConversationsLoading: (loading) => set({ conversationsLoading: loading }),
  setConversationsHasMore: (hasMore) => set({ conversationsHasMore: hasMore }),

  // Async fetchers
  fetchCatalog: async () => {
    set({ catalogLoading: true });
    try {
      const res = await channelsApi.catalog();
      if (res.success) set({ catalog: res.data || {} });
    } catch {
      // silent
    } finally {
      set({ catalogLoading: false });
    }
  },

  fetchBindings: async () => {
    set({ bindingsLoading: true });
    try {
      const res = await channelsApi.bindings();
      if (res.success) set({ bindings: res.data || [] });
    } catch {
      // silent
    } finally {
      set({ bindingsLoading: false });
    }
  },

  createBinding: async (bindingData) => {
    try {
      const res = await channelsApi.createBinding(bindingData);
      if (res.success && res.data) {
        set((state) => ({ bindings: [...state.bindings, res.data] }));
      }
      return res;
    } catch {
      return { success: false };
    }
  },

  removeBinding: async (id) => {
    try {
      const res = await channelsApi.removeBinding(id);
      if (res.success) {
        set((state) => ({
          bindings: state.bindings.filter((b) => b.id !== id),
        }));
      }
      return res;
    } catch {
      return { success: false };
    }
  },

  setPreferred: async (id) => {
    try {
      const res = await channelsApi.setPreferred(id);
      if (res.success) {
        set((state) => ({
          bindings: state.bindings.map((b) => ({
            ...b,
            is_preferred: b.id === id,
          })),
        }));
      }
      return res;
    } catch {
      return { success: false };
    }
  },

  generatePairCode: async () => {
    try {
      const res = await channelsApi.generatePairCode();
      if (res.success && res.data) {
        set({
          pairCode: res.data.code || null,
          pairQrUrl: res.data.qr_url || '',
        });
      }
      return res;
    } catch {
      return { success: false };
    }
  },

  verifyPairCode: async (code, channel, senderId) => {
    try {
      const res = await channelsApi.verifyPairCode({ code, channel, sender_id: senderId });
      return res;
    } catch {
      return { success: false };
    }
  },

  fetchPresence: async () => {
    try {
      const res = await channelsApi.presence();
      if (res.success) set({ presence: res.data || [] });
    } catch {
      // silent
    }
  },

  fetchConversations: async (params) => {
    set({ conversationsLoading: true });
    try {
      const res = await channelsApi.conversationHistory(params);
      if (res.success) {
        const data = res.data || [];
        if (params && params.offset > 0) {
          set((state) => ({
            conversations: [...state.conversations, ...data],
            conversationsHasMore: data.length >= (params.limit || 20),
          }));
        } else {
          set({
            conversations: data,
            conversationsHasMore: data.length >= (params?.limit || 20),
          });
        }
      }
    } catch {
      // silent
    } finally {
      set({ conversationsLoading: false });
    }
  },

  // Reset all
  reset: () =>
    set({
      bindings: [],
      catalog: {},
      presence: [],
      pairCode: null,
      pairQrUrl: '',
      conversations: [],
      conversationsHasMore: true,
    }),
}));

export default useChannelStore;
