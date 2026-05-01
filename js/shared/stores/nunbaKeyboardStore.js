import { create } from 'zustand';

/**
 * NunbaKeyboard Zustand store.
 *
 * Manages the floating agent-keyboard state:
 *  - visibility, mode (alpha / numeric / symbols / agent)
 *  - agent suggestions (autocomplete row powered by chatApi)
 *  - target callback for key presses
 */
const useNunbaKeyboardStore = create((set, get) => ({
  // Visibility
  visible: false,
  // Keyboard mode: 'alpha' | 'numeric' | 'symbols' | 'agent'
  mode: 'alpha',
  // Shift state
  shift: false,
  capsLock: false,

  // The text buffer that the keyboard is editing
  text: '',
  // Cursor position (index in text)
  cursor: 0,

  // Agent suggestion row
  suggestions: [],
  suggestionsLoading: false,

  // Callback: when user presses a key, the target receives text updates
  onChangeText: null,
  onSubmit: null,
  placeholder: 'Type with Nunba...',

  // ── Actions ──

  show: ({ onChangeText, onSubmit, initialText, placeholder }) =>
    set({
      visible: true,
      onChangeText: onChangeText || null,
      onSubmit: onSubmit || null,
      text: initialText || '',
      cursor: (initialText || '').length,
      placeholder: placeholder || 'Type with Nunba...',
      mode: 'alpha',
      shift: true, // start with shift for first letter
      capsLock: false,
      suggestions: [],
    }),

  dismiss: () =>
    set({
      visible: false,
      suggestions: [],
      suggestionsLoading: false,
    }),

  setMode: (mode) => set({ mode }),
  toggleShift: () => {
    const { shift, capsLock } = get();
    if (capsLock) {
      set({ shift: false, capsLock: false });
    } else if (shift) {
      set({ capsLock: true }); // double-tap shift = caps lock
    } else {
      set({ shift: true });
    }
  },

  // Insert character at cursor
  pressKey: (char) => {
    const { text, cursor, shift, capsLock, onChangeText } = get();
    const ch = shift || capsLock ? char.toUpperCase() : char.toLowerCase();
    const newText = text.slice(0, cursor) + ch + text.slice(cursor);
    const newCursor = cursor + 1;
    set({
      text: newText,
      cursor: newCursor,
      shift: capsLock ? true : false, // reset shift after one char unless caps lock
    });
    if (onChangeText) onChangeText(newText);
  },

  // Backspace
  pressBackspace: () => {
    const { text, cursor, onChangeText } = get();
    if (cursor === 0) return;
    const newText = text.slice(0, cursor - 1) + text.slice(cursor);
    set({ text: newText, cursor: cursor - 1 });
    if (onChangeText) onChangeText(newText);
  },

  // Space
  pressSpace: () => {
    const { text, cursor, onChangeText } = get();
    const newText = text.slice(0, cursor) + ' ' + text.slice(cursor);
    set({ text: newText, cursor: cursor + 1 });
    if (onChangeText) onChangeText(newText);
  },

  // Enter / submit
  pressEnter: () => {
    const { onSubmit, text } = get();
    if (onSubmit) onSubmit(text);
  },

  // Accept a suggestion (replace current word or append)
  acceptSuggestion: (suggestion) => {
    const { text, cursor, onChangeText } = get();
    // Find start of current word
    let wordStart = cursor;
    while (wordStart > 0 && text[wordStart - 1] !== ' ') wordStart--;
    const newText = text.slice(0, wordStart) + suggestion + ' ' + text.slice(cursor);
    const newCursor = wordStart + suggestion.length + 1;
    set({ text: newText, cursor: newCursor, suggestions: [] });
    if (onChangeText) onChangeText(newText);
  },

  setSuggestions: (s) => set({ suggestions: s }),
  setSuggestionsLoading: (v) => set({ suggestionsLoading: v }),

  // Set text externally
  setText: (t) => set({ text: t, cursor: t.length }),
}));

export default useNunbaKeyboardStore;
