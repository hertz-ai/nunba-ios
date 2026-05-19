/**
 * savedPostsStore — Zustand store for bookmarked posts, persisted to
 * AsyncStorage so saves survive across app launches.  Single source
 * of truth for "did the viewer save this post".
 *
 * Why this exists (Part X.P2 follow-up, 2026-05-19 reviewer #2):
 *   BookmarkButton was shipping with onToggle returning Promise.resolve()
 *   — purely local component state that reset on remount.  Users saw
 *   the bookmark flip + forgot.  Reviewer flagged as broken integration.
 *   This store gives the toggle real persistence without requiring the
 *   server-side /api/social/saved endpoint (still deferred).
 *
 * Hydration: on first state subscription the store reads the AsyncStorage
 * snapshot once.  Subsequent toggles write asynchronously; failures are
 * silent (the in-memory state is authoritative for the session).
 *
 * Future server-side wiring (out of scope for now):
 *   - When /api/social/saved lands, add `syncWithServer()` action that
 *     diffs in-memory state vs server response + reconciles last-write-wins.
 *   - Stamp each save with `saved_at` ISO so the server can preserve order.
 *
 * Plan ref: Part X.4.1 + Part X.P2 follow-up.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'nunba.savedPosts.v1';

let hydratePromise = null;

const useSavedPostsStore = create((set, get) => ({
  // Map<postId, savedAt-iso> — using a Map keeps order + O(1) has().
  // Stored as plain object on AsyncStorage; rehydrated to Map on read.
  saved: new Map(),
  hydrated: false,

  has(postId) {
    return get().saved.has(String(postId));
  },

  add(postId) {
    const id = String(postId);
    const next = new Map(get().saved);
    next.set(id, new Date().toISOString());
    set({ saved: next });
    persist(next);
  },

  remove(postId) {
    const id = String(postId);
    const next = new Map(get().saved);
    next.delete(id);
    set({ saved: next });
    persist(next);
  },

  // Idempotent toggle — used by BookmarkButton via the optimistic helper.
  toggle(postId) {
    if (get().has(postId)) {
      get().remove(postId);
      return false;
    }
    get().add(postId);
    return true;
  },

  // Read-back: trigger a one-time AsyncStorage hydrate.  Components
  // that care about the state should call this on mount.
  hydrate() {
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          set({ hydrated: true });
          return;
        }
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          set({ saved: new Map(Object.entries(obj)), hydrated: true });
        } else {
          set({ hydrated: true });
        }
      } catch (_e) {
        // Corrupt snapshot — drop it, start fresh.
        set({ hydrated: true });
      }
    })();
    return hydratePromise;
  },
}));

const persist = (map) => {
  try {
    const obj = Object.fromEntries(map.entries());
    // Fire-and-forget; failures are visible in the next launch as
    // "this save didn't persist" but in-memory state still reflects
    // the user's intent for THIS session.
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj)).catch(() => {});
  } catch (_e) {
    // JSON.stringify on Map should never fail post-Object.fromEntries.
  }
};

export default useSavedPostsStore;
