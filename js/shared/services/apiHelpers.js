/**
 * Shared auth utilities — single source for NativeModule auth calls.
 *
 * Three auth patterns exist in this app:
 *   1. getAccessToken() — OAuth/session token (socialApi, chatApi, deviceApi)
 *   2. getUserId()      — user ID as bearer (kidsLearningApi, kidsMediaApi, vaultApi)
 *   3. getToken()       — tries accessToken first, falls back to userId (PocketTTS, STT)
 */

import { NativeModules } from 'react-native';
import endpointResolver from './endpointResolver';

const { OnboardingModule } = NativeModules;

/**
 * How long to wait for a native callback before giving up on it.
 *
 * These calls are a local IPC hop, so anything beyond a couple of seconds
 * means the native side is not going to answer at all.
 */
export const NATIVE_CALLBACK_TIMEOUT_MS = 4000;

/**
 * Promisify an OnboardingModule callback so it ALWAYS settles.
 *
 * The previous shape rejected only on a SYNCHRONOUS throw, which meant a
 * native side that accepted the call and then never invoked the callback left
 * the promise pending forever. An expired or absent session does exactly that,
 * and because every social request awaits getAuthHeaders() -> getAccessToken(),
 * one silent callback hung the entire social surface: measured on device, the
 * Games hub sat on a spinner for more than six minutes instead of falling back
 * to the local catalogue, because setLoading(false) was never reached.
 *
 * Resolves null rather than rejecting, so callers degrade to an
 * unauthenticated request instead of having to grow a catch block each.
 */
const fromNativeCallback = (label, invoke) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      try {
        // eslint-disable-next-line no-console
        console.warn(
          `[apiHelpers] ${label} did not call back within ` +
          `${NATIVE_CALLBACK_TIMEOUT_MS}ms — continuing without it`,
        );
      } catch (_) {}
      finish(null);
    }, NATIVE_CALLBACK_TIMEOUT_MS);
    try {
      invoke(finish);
    } catch (err) {
      try {
        // eslint-disable-next-line no-console
        console.warn(`[apiHelpers] ${label} threw:`, (err && err.message) || err);
      } catch (_) {}
      finish(null);
    }
  });

/** Get current user ID via OnboardingModule callback. Resolves null if absent. */
export const getUserId = () =>
  fromNativeCallback('getUser_id', (cb) => OnboardingModule.getUser_id(cb));

/** Get OAuth/session access token. Resolves null if absent. */
export const getAccessToken = () =>
  fromNativeCallback('getAccessToken', (cb) => OnboardingModule.getAccessToken(cb));

/** Verified account email for the HARTOS login exchange. */
export const getAccountEmail = () =>
  fromNativeCallback('getAccountEmail', (cb) => OnboardingModule.getAccountEmail(cb));

/**
 * Best-effort token: tries accessToken first, falls back to userId.
 * Never rejects and never hangs — resolves null if both fail.
 */
export const getToken = async () => {
  const token = await getAccessToken();
  if (token != null) return token;
  return getUserId();
};

/**
 * Build headers, omitting Authorization when there is no credential.
 *
 * Sending literal "Bearer null" made an unauthenticated request look like a
 * malformed authenticated one, which the server rejects with a confusing error
 * instead of the plain 401 the client knows how to fall back from.
 */
const authHeaders = (credential) => {
  const headers = { 'Content-Type': 'application/json' };
  if (credential != null && credential !== '') {
    headers.Authorization = `Bearer ${credential}`;
  }
  return headers;
};

/**
 * The credential for where the next call lands (#111).
 *
 * The endpoint resolver returns, with the url it picked, the bearer that
 * node can verify: the account token for the cloud, a token this phone
 * signed with its own PeerLink key for a LAN desktop (whose owner allows
 * the phone once).  When the resolver has no say (override, fallback),
 * the account token is sent as it always was.
 */
export const getCredential = async () => {
  // Both at once: the account token's native callback (and its timeout)
  // starts now, as it did before the resolver had a say.
  const [resolved, accessToken] = await Promise.all([
    endpointResolver.getApiBase().catch(() => null),
    getAccessToken(),
  ]);
  return (resolved && resolved.credential) || accessToken;
};

/** Headers with the call's credential (for socialApi, chatApi, deviceApi pattern). */
export const getAuthHeaders = async () => authHeaders(await getCredential());

/** Headers with user ID (for kidsLearningApi, kidsMediaApi, vaultApi pattern). */
export const getUserAuthHeaders = async () => authHeaders(await getUserId());
