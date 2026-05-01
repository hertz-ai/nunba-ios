// src/state/zustandStore.js
import { create } from 'zustand';

const useLanguageStore = create(set => ({
  preferred_language: 'en-US',
  userAge: 0, // Initial value for userAge
  setpreferred_language: (lang) => set({ preferred_language: lang }),
  setUserAge: (age) => set({ userAge: age }),
}));

export default useLanguageStore;
