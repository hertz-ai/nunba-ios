/**
 * conversationStore — Zustand store for Channel Conversations.
 *
 * Bridges channelConversationService (Nunba-HART patterns) to provide
 * reactive state for channel conversation UI components.
 *
 * State includes:
 *   - Active channel sessions with message history
 *   - Typing indicators (local + remote)
 *   - Channel presence (online/offline/error)
 *   - Message queue status
 *   - Channel catalog and capabilities
 */

import { create } from 'zustand';
import channelConversationService, { CHANNEL_CATALOG } from './services/channelConversationService';

const useConversationStore = create((set, get) => ({
  // ── Active Conversations ────────────────────────────────────────────────
  activeChannel: null,      // Currently viewing channel type
  activeUserId: null,       // Currently viewing user
  messages: [],             // Messages for active channel/user
  messagesLoading: false,

  // ── Typing State ────────────────────────────────────────────────────────
  typingChannels: {},       // { channelType: { userId, typing, ts } }
  localTyping: null,        // Channel we're currently typing in

  // ── Presence State ──────────────────────────────────────────────────────
  channelPresence: {},      // { channelType: { status, lastHeartbeat } }

  // ── Queue State ─────────────────────────────────────────────────────────
  queueLength: 0,
  queueProcessing: false,

  // ── Channel Catalog ─────────────────────────────────────────────────────
  catalog: CHANNEL_CATALOG,

  // ── Initialization ──────────────────────────────────────────────────────
  _initialized: false,

  init: async () => {
    if (get()._initialized) return;
    set({ _initialized: true });

    // Subscribe to incoming messages
    channelConversationService.on('message_received', ({ channelType, userId, message }) => {
      const state = get();
      if (state.activeChannel === channelType) {
        set((s) => ({
          messages: [...s.messages, message],
        }));
      }
    });

    // Subscribe to sent messages
    channelConversationService.on('message_sent', ({ channelType, message }) => {
      const state = get();
      if (state.activeChannel === channelType) {
        set((s) => ({
          messages: [...s.messages, message],
        }));
      }
    });

    // Subscribe to typing indicators
    channelConversationService.on('typing', ({ channelType, userId, typing }) => {
      set((s) => ({
        typingChannels: {
          ...s.typingChannels,
          [channelType]: typing ? { userId, typing: true, ts: Date.now() } : undefined,
        },
      }));
    });

    // Subscribe to presence updates
    channelConversationService.on('presence', ({ channelType, status, lastHeartbeat }) => {
      set((s) => ({
        channelPresence: {
          ...s.channelPresence,
          [channelType]: { status, lastHeartbeat },
        },
      }));
    });

    // Initial presence fetch
    get().fetchPresence();
  },

  // ── Channel Selection ───────────────────────────────────────────────────

  setActiveChannel: (channelType, userId = 'self') => {
    set({ activeChannel: channelType, activeUserId: userId, messages: [] });

    // Load local history
    const history = channelConversationService.getLocalHistory(channelType, userId);
    set({ messages: history });
  },

  clearActiveChannel: () => {
    const { activeChannel } = get();
    if (activeChannel) {
      channelConversationService.stopTyping(activeChannel);
    }
    set({ activeChannel: null, activeUserId: null, messages: [], localTyping: null });
  },

  // ── Message Actions ─────────────────────────────────────────────────────

  sendMessage: async (content, options = {}) => {
    const { activeChannel, activeUserId } = get();
    if (!activeChannel || !content?.trim()) return null;

    const message = await channelConversationService.sendMessage(
      activeChannel,
      content.trim(),
      { userId: activeUserId, ...options },
    );

    // Stop typing when message is sent
    channelConversationService.stopTyping(activeChannel);
    set({ localTyping: null });

    return message;
  },

  // ── Typing Actions ──────────────────────────────────────────────────────

  startTyping: () => {
    const { activeChannel } = get();
    if (!activeChannel) return;
    channelConversationService.startTyping(activeChannel);
    set({ localTyping: activeChannel });
  },

  stopTyping: () => {
    const { activeChannel } = get();
    if (!activeChannel) return;
    channelConversationService.stopTyping(activeChannel);
    set({ localTyping: null });
  },

  // ── History Actions ─────────────────────────────────────────────────────

  fetchHistory: async (params = {}) => {
    set({ messagesLoading: true });
    try {
      const data = await channelConversationService.fetchHistory({
        ...params,
        channel_type: params.channel_type || get().activeChannel,
      });
      // History is hydrated into sessions; reload messages from local
      const { activeChannel, activeUserId } = get();
      if (activeChannel) {
        const history = channelConversationService.getLocalHistory(activeChannel, activeUserId || 'self');
        set({ messages: history });
      }
      return data;
    } catch {
      return [];
    } finally {
      set({ messagesLoading: false });
    }
  },

  // ── Presence Actions ────────────────────────────────────────────────────

  fetchPresence: async () => {
    const presenceData = await channelConversationService.fetchPresence();
    const presenceMap = {};
    presenceData.forEach((p) => {
      presenceMap[p.channel_type] = {
        status: p.status,
        lastHeartbeat: p.last_heartbeat,
      };
    });
    set({ channelPresence: presenceMap });
  },

  // ── Channel Info ────────────────────────────────────────────────────────

  getChannelInfo: (channelType) => {
    return CHANNEL_CATALOG[channelType] || null;
  },

  getChannelCapabilities: (channelType) => {
    return CHANNEL_CATALOG[channelType]?.capabilities || {};
  },

  // ── Active Sessions ─────────────────────────────────────────────────────

  getActiveSessions: () => {
    return channelConversationService.listActiveSessions();
  },

  clearSession: (channelType, userId) => {
    channelConversationService.clearSession(channelType, userId);
    const state = get();
    if (state.activeChannel === channelType) {
      set({ messages: [] });
    }
  },

  // ── Cleanup ─────────────────────────────────────────────────────────────
  reset: () => {
    channelConversationService.destroy();
    set({
      activeChannel: null,
      activeUserId: null,
      messages: [],
      typingChannels: {},
      localTyping: null,
      channelPresence: {},
      queueLength: 0,
      queueProcessing: false,
      _initialized: false,
    });
  },
}));

export default useConversationStore;
