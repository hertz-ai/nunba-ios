/**
 * optimistic — apply UI change before network, rollback on failure.
 *
 * The pattern every like / follow / join / bookmark handler reinvents:
 *   1. Apply the UI flip immediately (user sees response < 100 ms).
 *   2. Fire the network request.
 *   3. On success: optional celebratory haptic.
 *   4. On failure: undo the UI flip + show a toast.
 *
 * Caller supplies:
 *   - apply()          → sync UI change (setState or store mutate)
 *   - request()        → returns a Promise (resolve = ok, reject = fail)
 *   - rollback()       → sync UI revert (called only on rejection)
 *   - errorToast?      → optional friendly message shown via global toast
 *   - successHaptic?   → 'light' | 'medium' | 'success' | 'warning' | null
 *
 * Returns a Promise that resolves to {ok: boolean, error?: Error}.
 * The Promise NEVER rejects — failure is communicated via the resolved
 * shape so callers don't need try/catch wrappers around every use.
 *
 * Plan ref: Part X.3.2 (sunny-gliding-eich.md).
 */
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticWarning,
} from './haptics';

const HAPTICS = {
  light: hapticLight,
  medium: hapticMedium,
  success: hapticSuccess,
  warning: hapticWarning,
};

let _globalToast = null;

/**
 * Wire the toast presenter once at app boot.  Keeping the helper
 * agnostic to which toast library is in use means we don't introduce
 * a hard dependency on react-native-toast-message / Snackbar / etc.
 */
export function setOptimisticToast(presenter) {
  _globalToast = typeof presenter === 'function' ? presenter : null;
}

export async function optimistic({
  apply,
  request,
  rollback,
  errorToast,
  successHaptic = null,
}) {
  if (
    typeof apply !== 'function' ||
    typeof request !== 'function' ||
    typeof rollback !== 'function'
  ) {
    return {
      ok: false,
      error: new Error(
        'optimistic: apply / request / rollback must be functions',
      ),
    };
  }
  apply();
  try {
    await request();
    if (successHaptic && HAPTICS[successHaptic]) {
      HAPTICS[successHaptic]();
    }
    return { ok: true };
  } catch (error) {
    rollback();
    if (HAPTICS.warning) HAPTICS.warning();
    if (errorToast && _globalToast) {
      try {
        _globalToast(errorToast);
      } catch (_e) {
        // Toast presenter must never break the helper.
      }
    }
    return { ok: false, error };
  }
}

export default optimistic;
