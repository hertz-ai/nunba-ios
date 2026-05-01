import { create } from 'zustand';

const useFleetCommandStore = create((set, get) => ({
  pendingConsents: [],    // Array of {commandId, action, agentId, description, timeoutS, receivedAt}
  activeTTS: null,        // {commandId, text, voice, lang, agentId} or null
  commandHistory: [],     // Last 20 commands processed

  addConsent: (consent) => set((state) => ({
    pendingConsents: [
      ...state.pendingConsents,
      { ...consent, receivedAt: Date.now() },
    ],
  })),

  resolveConsent: (commandId) => set((state) => ({
    pendingConsents: state.pendingConsents.filter(
      (c) => c.commandId !== commandId,
    ),
  })),

  setActiveTTS: (tts) => set({ activeTTS: tts }),
  clearTTS: () => set({ activeTTS: null }),

  addToHistory: (command) => set((state) => ({
    commandHistory: [command, ...state.commandHistory].slice(0, 20),
  })),
}));

export default useFleetCommandStore;
