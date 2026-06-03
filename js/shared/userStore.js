/**
 * userStore — Zustand store for the currently-authenticated user.
 *
 * Mirrors the Nunba web SocialContext (`landing-page/src/contexts/
 * SocialContext.js`) but written as a Zustand store because this RN
 * codebase already uses Zustand for every other piece of cross-screen
 * state (encounterStore, notificationStore, gamificationStore, etc.).
 *
 * Responsibilities:
 *   - Fetch `GET /auth/me` on init, cache the response.
 *   - Derive `accessTier` from `currentUser.role` matching the server
 *     vocabulary in HARTOS `integrations/social/auth.py`:
 *       central > regional > flat > guest > anonymous
 *   - Expose role-derived booleans (`isAuthenticated`, `canAdmin`,
 *     `canModerate`, etc.) so components don't re-derive everywhere.
 *
 * Why this exists:
 *   Nothing in this repo previously cached the current user's role.
 *   Every component that needed it had to inline-fetch `/auth/me` or
 *   hardcode an assumption.  In particular, `MarketingFunnelCard`
 *   rendered for all users instead of admins/owners only — which
 *   matches what the user reported on-device 2026-05-28.
 *
 * Init order:
 *   CommunityView.js's mount-time useEffect calls
 *     useUserStore.getState().init()
 *   alongside the existing notificationStore.init(), so the store is
 *   populated before any role-gated render happens.
 */
import { create } from 'zustand';
import { authApi } from './services/socialApi';

const ROLE_LEVELS = {
  anonymous: 0,
  guest: 1,
  flat: 2,
  regional: 3,
  central: 4,
};

// Hevolve instance owners.  In single-user / self-hosted HARTOS
// deployments (flat tier) the developer who runs the install IS the
// platform admin — HARTOS may not yet have the `is_admin` flag set on
// the User row, but the client treats a known-owner email as central
// tier so admin-only widgets render on first login.
//
// Add an email here only if that account should always have admin
// permissions on every device it logs in from.
const OWNER_EMAILS = new Set([
  'bsathish.in@gmail.com',
]);

function isOwnerEmail(currentUser) {
  const email = currentUser && (currentUser.email || currentUser.user_email);
  return !!email && OWNER_EMAILS.has(String(email).toLowerCase());
}

function deriveAccessTier(currentUser, isGuestSession) {
  if (isOwnerEmail(currentUser)) return 'central';
  if (currentUser?.role) return currentUser.role;
  if (currentUser && !currentUser._pending) return 'flat';
  if (isGuestSession) return 'guest';
  return 'anonymous';
}

function deriveDerived(currentUser, isGuestSession) {
  const accessTier = deriveAccessTier(currentUser, isGuestSession);
  const level = ROLE_LEVELS[accessTier] || 0;
  // Server User has explicit `is_admin` / `is_moderator` booleans;
  // mirror them client-side when present, fall back to tier-derived
  // permissions when absent (e.g. JWT-decoded skeleton user without
  // `/auth/me` round-trip having landed yet).
  const owner = isOwnerEmail(currentUser);
  const isAdmin =
    owner ||
    !!(currentUser && currentUser.is_admin) ||
    level >= ROLE_LEVELS.central;
  const isModerator =
    owner ||
    !!(currentUser && currentUser.is_moderator) ||
    level >= ROLE_LEVELS.regional;
  return {
    accessTier,
    isAuthenticated: level >= ROLE_LEVELS.flat,
    isGuest: accessTier === 'guest',
    isAnonymous: accessTier === 'anonymous',
    canWrite: level >= ROLE_LEVELS.flat,
    canModerate: isModerator,
    canAdmin: isAdmin,
    isAdmin,
    isModerator,
  };
}

const useUserStore = create((set, get) => ({
  // Raw state
  currentUser: null,
  isGuestSession: false,
  loading: true,
  authError: null,
  // Derived (kept in state for cheap selector reads — recomputed on every
  // setCurrentUser call so consumers can subscribe to a single slice).
  ...deriveDerived(null, false),

  // ── Actions ──

  /** Call on app mount.  Idempotent — safe to call multiple times. */
  init: async () => {
    if (get()._initStarted) return;
    set({ _initStarted: true, loading: true, authError: null });
    try {
      const res = await authApi.me();
      // socialApi `get` returns the raw parsed body; HARTOS `_ok()`
      // wraps in `{success, data:{...}}` so unwrap both shapes safely.
      const user = res?.data || res || null;
      set({
        currentUser: user,
        loading: false,
        ...deriveDerived(user, get().isGuestSession),
      });
    } catch (err) {
      set({
        currentUser: null,
        loading: false,
        authError: err && err.message ? err.message : 'auth/me failed',
        ...deriveDerived(null, get().isGuestSession),
      });
    }
  },

  /** Refetch /auth/me — used after profile edits or token rotation. */
  refresh: async () => {
    set({ _initStarted: false });
    await get().init();
  },

  /** Direct setter used by login/logout flows that already know the user. */
  setCurrentUser: (user) =>
    set({
      currentUser: user,
      ...deriveDerived(user, get().isGuestSession),
    }),

  /** Flag the current session as guest-mode (no full account). */
  setGuestSession: (isGuestSession) =>
    set({
      isGuestSession,
      ...deriveDerived(get().currentUser, isGuestSession),
    }),

  /** Wipe on logout. */
  reset: () =>
    set({
      currentUser: null,
      isGuestSession: false,
      authError: null,
      _initStarted: false,
      loading: false,
      ...deriveDerived(null, false),
    }),
}));

export default useUserStore;
export { ROLE_LEVELS, deriveAccessTier };
