/**
 * Report a failed call to the API base: the one copy, used by socialApi and
 * deviceApi (both talk to the same /api/social host family).
 *
 * Surface server errors so screens don't silently render empty.  HARTOS
 * returning 500 on /communities or /posts was previously invisible to the
 * user -- the screen just looked blank.  Emit a DeviceEvent so the global
 * ApiErrorBanner can toast the user, AND on 5xx invalidate the endpoint
 * resolver cache so the very next request re-probes the priority chain
 * (local PeerLink peer -> LAN peer -> regional -> cloud).  Without that, a
 * sick central kept getting hit for the full 30 s cache TTL even when a
 * local Nunba node was reachable.
 *
 * A background call (a 30 s poll, an ack, the start-up device link) passes
 * `quiet: true`: nobody is looking at a screen it fills, so it raises no
 * banner, but a 5xx or transport failure still fails over to the next peer.
 *
 * Moved here from socialApi.js (2026-10-27) when deviceApi grew its own
 * non-JSON warning that neither raised the banner nor failed over.
 */
import { DeviceEventEmitter } from 'react-native';
import endpointResolver from './endpointResolver';

export const emitApiError = (path, status, method, { quiet = false } = {}) => {
  if (!quiet) {
    try {
      DeviceEventEmitter.emit('ApiError', { path, status, method });
    } catch (_) {}
  }
  // 5xx and 0 (network) are server-side / transport faults — fall over
  // to the next peer in the priority chain.  4xx (auth, validation) is
  // the caller's responsibility — keep the current endpoint since
  // retrying a different peer won't help.
  if (status >= 500 || status === 0) {
    try { endpointResolver.invalidateCache(); } catch (_) {}
  }
};

// HARTOS answers 503 "<flag> feature flag is off" for a dark-launched
// feature (integrations/social/feature_flags.py).  That is a switched-off
// feature, not a server fault: the screen shows its own message, and another
// peer has the same flag, so neither the global "Something's off on our end"
// banner nor a peer failover applies.  Found on two phones: Start Chat raised
// the banner on top of its own "Couldn't start chat" alert.
export const isFeatureOff = (status, json) =>
  status === 503 && typeof json?.error === 'string' && / feature flag is off$/.test(json.error);

export const reportFailure = (path, response, json, method, opts) => {
  if (!response.ok && !isFeatureOff(response.status, json)) {
    emitApiError(path, response.status, method, opts);
  }
};

export default { emitApiError, isFeatureOff, reportFailure };
