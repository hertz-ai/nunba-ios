import { create } from 'zustand';

const useLiquidOverlayStore = create((set, get) => ({
  // Overlay visibility
  visible: false,

  // LiquidUI layout from agent response
  layout: null,
  layoutData: {},

  // Agent info
  agentName: 'Nunba',
  agentPromptId: null,

  // Chat messages
  messages: [],
  isLoading: false,
  conversationId: null,

  // Actions
  show: (layout, data, agentName) => set({
    visible: true,
    layout,
    layoutData: data || {},
    agentName: agentName || 'Nunba',
  }),

  dismiss: () => set({
    visible: false,
    layout: null,
    layoutData: {},
  }),

  pushMessage: (msg) => set((s) => ({
    messages: [...s.messages.slice(-49), msg], // keep last 50
  })),

  /**
   * Draft-replacement: find a draft message by speculationId and replace
   * its text with the expert response. If no matching draft is found,
   * append as a new assistant message.
   */
  replaceDraft: (speculationId, text, source) => set((s) => {
    const idx = s.messages.findIndex(
      (m) => m.speculationId === speculationId && m.isDraft
    );
    if (idx !== -1) {
      const updated = [...s.messages];
      updated[idx] = {
        ...updated[idx],
        text,
        isDraft: false,
        source: source || 'expert',
      };
      return { messages: updated };
    }
    // No matching draft -- append as new message
    return {
      messages: [...s.messages.slice(-49), {
        role: 'assistant',
        text,
        ts: Date.now(),
        source: source || 'expert',
      }],
    };
  }),

  clearMessages: () => set({ messages: [], conversationId: null }),

  setLoading: (v) => set({ isLoading: v }),

  setAgent: (name, promptId) => set({
    agentName: name || 'Nunba',
    agentPromptId: promptId || null,
    messages: [],
    conversationId: null,
  }),

  setConversationId: (id) => set({ conversationId: id }),
}));

export default useLiquidOverlayStore;
