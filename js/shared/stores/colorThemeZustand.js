// useThemeStore.js
import { create } from 'zustand';

const useThemeStore = create((set) => ({
  theme: null, // Set an initial theme
  // Function to set the theme
  setTheme: (newTheme) => set({ theme: newTheme }),
}));

// If you want to add a listener for theme changes, you can do it like this:
useThemeStore.subscribe(
  (state) => state.theme,
  (theme) => {
    console.log('Theme changed:', theme);
  }
);

export default useThemeStore;