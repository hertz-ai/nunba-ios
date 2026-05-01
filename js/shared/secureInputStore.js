import { create } from 'zustand';

const useSecureInputStore = create((set) => ({
  // Current secret request from agent (null = no request pending)
  currentRequest: null,

  // Set of stored key names (for UI feedback, never stores values)
  storedKeys: [],

  // Open overlay with a secret request from the agent
  requestSecret: (request) => set({ currentRequest: request }),

  // Secret stored successfully — close overlay, track key name
  resolve: (keyName) =>
    set((state) => ({
      currentRequest: null,
      storedKeys: state.storedKeys.includes(keyName)
        ? state.storedKeys
        : [...state.storedKeys, keyName],
    })),

  // Close without storing
  dismiss: () => set({ currentRequest: null }),
}));

export default useSecureInputStore;
