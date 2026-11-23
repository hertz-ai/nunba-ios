/**
 * API failure → user-facing copy.  Pure, zero imports.
 *
 * Kept free of react-native imports on purpose: ApiErrorBanner cannot be
 * loaded in unit tests (the RN entrypoint is not transformed by this
 * project's jest config), so the decision logic lives here where it can be
 * tested directly instead of asserted against source text.
 *
 * Single source of truth for TRANSPORT_ERROR_STATUS, shared by
 * services/socialApi.js (which synthesizes it) and
 * components/shared/ApiErrorBanner.js (which renders it).
 */

/**
 * Synthesized status for a CONNECT-level failure — DNS, refused, timeout.
 * The device never reached a server, so this is NOT a server-side 5xx.
 * 599 rather than 0 because `new Response(body, {status: 0})` throws.
 */
export const TRANSPORT_ERROR_STATUS = 599;

/**
 * Map an HTTP-ish status to the banner copy.
 *
 * Transport failures are called out BEFORE the >= 500 branch.  Until
 * 2026-09-02 they fell through to it, so a dead LAN peer on the device
 * itself was reported to the user as "Something's off on our end" — the
 * app blaming the server for a client-side peer-resolution bug.
 */
export const messageFor = (status) => {
  if (status === TRANSPORT_ERROR_STATUS || status === 0) {
    return 'Network glitch. Pull to refresh.';
  }
  if (status >= 500) return "Something's off on our end. Pull to refresh.";
  if (status === 401 || status === 403) return 'Session expired — sign in again.';
  if (status === 404) return "Couldn't find what you asked for.";
  if (status >= 400) return 'Bad request — try again in a moment.';
  return 'Network glitch. Pull to refresh.';
};

export default { TRANSPORT_ERROR_STATUS, messageFor };
