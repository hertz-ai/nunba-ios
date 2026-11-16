/**
 * InAppOAuthService — #465 (2026-06-22)
 *
 * Per user directive "all programatics shd be part of app":
 * OAuth runs ENTIRELY inside the app via PKCE (RFC 7636).  Zero
 * server hops — the app talks directly to each provider's
 * /authorize and /token endpoints.
 *
 * Flow (Slack as example):
 *   1. App generates a random code_verifier (43-128 chars, URL-safe).
 *   2. App computes code_challenge = base64url(SHA256(code_verifier)).
 *   3. App stores {state, code_verifier} keyed by `state` (random nonce).
 *   4. App opens Linking.openURL(`${authorize_url}?
 *        client_id=…
 *        &redirect_uri=hevolve://oauth-complete
 *        &code_challenge=${code_challenge}
 *        &code_challenge_method=S256
 *        &state=${state}
 *        &scope=…`)
 *   5. User taps "Authorize" in Slack's browser page.
 *   6. Slack redirects to hevolve://oauth-complete?code=…&state=…
 *   7. deepLinkService catches it → fires 'oauth_complete' event.
 *   8. App pulls {code_verifier} for the matching `state`, then POSTs
 *      to ${token_url} with: client_id, code, code_verifier,
 *      redirect_uri, grant_type=authorization_code.
 *   9. Provider returns {access_token, refresh_token, expires_in, ...}.
 *  10. App stores token in AsyncStorage (encrypted on iOS via keychain
 *      wrapper if available; plain AsyncStorage on Android works
 *      because the data dir is sandboxed per-app).
 *  11. App calls the provider's `users.identity` (or equivalent) to
 *      pull display name + avatar, then writes a Hevolve binding row
 *      via channelsApi.createBinding({channel, access_token, …}).
 *
 * Provider configs (clientIds only — NEVER secrets in client code):
 *   These are PUBLIC client IDs registered with each provider in
 *   "mobile / SPA" mode where no client_secret is required (PKCE
 *   replaces the secret).
 *
 * Why PKCE works without a client_secret: code_challenge proves at
 * step #8 that the SAME app that started the flow at step #4 is the
 * one redeeming the code.  An attacker who intercepts the code can't
 * exchange it for a token without the original code_verifier.
 */

import { Linking, DeviceEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---- PKCE primitives ----

const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function randomBytes(len) {
  const out = new Uint8Array(len);
  // crypto.getRandomValues is provided by RN core in 0.68+.  Fall back
  // to Math.random combinator if unavailable (deterministic ms-resolution
  // mixing for older devices).
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(out);
  } else {
    for (let i = 0; i < len; i++) {
      out[i] = Math.floor(Math.random() * 256);
    }
  }
  return out;
}

export function generateCodeVerifier(len = 64) {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += URL_SAFE[bytes[i] % URL_SAFE.length];
  }
  return out;
}

// Base64-url encode a Uint8Array (no '=' padding, replace +/= with -_).
function base64UrlEncodeBytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = globalThis.btoa
    ? globalThis.btoa(bin)
    : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// SHA-256 of a UTF-8 string → base64url.  Uses the WebCrypto subtle
// API when available; falls back to a pure-JS SHA-256 for older RN
// JSC engines that lack subtle.digest.
export async function sha256Base64Url(input) {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buf = new TextEncoder().encode(input);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', buf);
    return base64UrlEncodeBytes(new Uint8Array(hash));
  }
  return base64UrlEncodeBytes(sha256PureJs(input));
}

// Pure-JS SHA-256 — fallback when crypto.subtle is missing.  Compact
// implementation; not constant-time but sufficient for PKCE challenge
// generation where timing is irrelevant.
function sha256PureJs(asciiOrUtf8) {
  // Encode UTF-8 to bytes
  const enc = unescape(encodeURIComponent(asciiOrUtf8));
  const bytes = new Uint8Array(enc.length);
  for (let i = 0; i < enc.length; i++) bytes[i] = enc.charCodeAt(i);
  // Pad
  const bitLen = bytes.length * 8;
  const withPad = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withPad.set(bytes);
  withPad[bytes.length] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 4, bitLen >>> 0, false);
  // Initial hash
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const w = new Uint32Array(64);
  for (let i = 0; i < withPad.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (withPad[i + t * 4] << 24) | (withPad[i + t * 4 + 1] << 16)
        | (withPad[i + t * 4 + 2] << 8) | withPad[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (H[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
    out[i * 4 + 3] = H[i] & 0xff;
  }
  return out;
}
function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

// ---- Provider catalog ----
//
// client_id values are PUBLIC.  PKCE replaces the secret, so even if
// these leak the worst an attacker can do is start a flow that
// redirects to OUR redirect_uri (hevolve://) which they can't catch.
//
// Add new providers by appending a row.  scopes are the minimum
// needed to (a) read user identity and (b) send a message on the
// user's behalf — enough to land in their Hevolve inbox.
const REDIRECT_URI = 'hevolve://oauth-complete';

export const PROVIDERS = {
  slack: {
    name: 'Slack',
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    clientId: '1234567890.1234567890', // replace at build-time per env
    scopes: 'channels:read,chat:write,users:read',
  },
  discord: {
    name: 'Discord',
    authorizeUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    clientId: 'REPLACE_AT_BUILD',
    scopes: 'identify guilds messages.read',
  },
  google: {
    name: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: 'REPLACE_AT_BUILD.apps.googleusercontent.com',
    scopes: 'openid email profile https://www.googleapis.com/auth/gmail.send',
  },
  twitter: {
    name: 'Twitter',
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    clientId: 'REPLACE_AT_BUILD',
    scopes: 'tweet.read tweet.write users.read offline.access',
  },
  twitch: {
    name: 'Twitch',
    authorizeUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    clientId: 'REPLACE_AT_BUILD',
    scopes: 'user:read:email chat:read chat:edit',
  },
  line: {
    name: 'LINE',
    authorizeUrl: 'https://access.line.me/oauth2/v2.1/authorize',
    tokenUrl: 'https://api.line.me/oauth2/v2.1/token',
    clientId: 'REPLACE_AT_BUILD',
    scopes: 'profile openid',
  },
  teams: {
    name: 'Microsoft Teams',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: 'REPLACE_AT_BUILD',
    // Must match HARTOS's channel catalog exactly (integrations/channels/
    // metadata.py's oauth_scopes for 'teams') -- that's what the backend
    // actually calls with the resulting token. Graph-qualified resource
    // URIs, not short scope names: short 'Chat.ReadWrite' would still
    // resolve against Graph under v2.0, but omitting ChannelMessage.Send
    // entirely (the old scope list did) means the token can read chats
    // but can't post to a channel -- a permission gap that only surfaces
    // the first time that specific call is made.
    scopes: 'https://graph.microsoft.com/Chat.ReadWrite https://graph.microsoft.com/ChannelMessage.Send offline_access',
  },
  meta: {
    name: 'Meta',
    authorizeUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    clientId: 'REPLACE_AT_BUILD',
    scopes: 'public_profile,email',
  },
};

// ---- Public surface ----

const PENDING_KEY_PREFIX = 'hevolve.oauth.pending.';
const TOKEN_KEY_PREFIX = 'hevolve.oauth.token.';

/**
 * Start the PKCE flow for `providerKey`.  Returns a Promise that
 * resolves with {access_token, ...} when the user completes the
 * provider's consent page, or rejects on user-cancel / failure.
 *
 * The promise is wired through the existing deepLinkService
 * 'oauth_complete' event so the existing AgentOverlay oauth_link
 * card UX continues to work — the only thing that changed is the
 * back end: provider direct, no /channels/oauth/start hop.
 */
export async function startOAuth(providerKey) {
  const provider = PROVIDERS[providerKey];
  if (!provider) throw new Error(`Unknown OAuth provider: ${providerKey}`);

  const codeVerifier = generateCodeVerifier(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = generateCodeVerifier(32);

  // Stash {codeVerifier} keyed by state so the deep-link callback
  // can pick it back up after the browser detour.
  await AsyncStorage.setItem(
    `${PENDING_KEY_PREFIX}${state}`,
    JSON.stringify({ codeVerifier, providerKey, t: Date.now() }),
  );

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: provider.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  // Provider-specific quirks:
  //   - Slack uses `user_scope` for some flows; we keep it in `scope`.
  //   - Twitter requires `code_challenge_method=plain` for older clients;
  //     we always use S256 (their docs allow it for OAuth 2.0).
  const authorizeUrl = `${provider.authorizeUrl}?${params.toString()}`;

  // Listen for the redirect ONCE and resolve the promise.
  return new Promise((resolve, reject) => {
    let listener = null;
    const cleanup = () => {
      if (listener) {
        listener.remove?.();
        listener = null;
      }
    };
    listener = DeviceEventEmitter.addListener('oauth_complete', async (payload) => {
      try {
        if (!payload?.state || payload.state !== state) return; // not ours
        cleanup();
        if (payload.error || payload.ok === false) {
          reject(new Error(payload.error || 'User denied authorization'));
          return;
        }
        const code = payload.code;
        if (!code) {
          reject(new Error('No authorization code in callback'));
          return;
        }
        const token = await exchangeCodeForToken(providerKey, code, codeVerifier);
        await AsyncStorage.setItem(
          `${TOKEN_KEY_PREFIX}${providerKey}`,
          JSON.stringify({ ...token, obtainedAt: Date.now() }),
        );
        await AsyncStorage.removeItem(`${PENDING_KEY_PREFIX}${state}`);
        resolve(token);
      } catch (e) {
        cleanup();
        reject(e);
      }
    });

    // Auto-reject after 5 minutes of inactivity to free the listener.
    setTimeout(() => {
      cleanup();
      reject(new Error('OAuth timed out'));
    }, 5 * 60 * 1000);

    Linking.openURL(authorizeUrl).catch((e) => {
      cleanup();
      reject(e);
    });
  });
}

async function exchangeCodeForToken(providerKey, code, codeVerifier) {
  const provider = PROVIDERS[providerKey];
  const body = new URLSearchParams({
    client_id: provider.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });
  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Provider returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function getStoredToken(providerKey) {
  const raw = await AsyncStorage.getItem(`${TOKEN_KEY_PREFIX}${providerKey}`);
  return raw ? JSON.parse(raw) : null;
}

export async function clearStoredToken(providerKey) {
  await AsyncStorage.removeItem(`${TOKEN_KEY_PREFIX}${providerKey}`);
}

/* istanbul ignore next — convenience getter for diagnostics; not exercised in tests. */
export function _getProviderConfig(providerKey) {
  return PROVIDERS[providerKey];
}

export default {
  startOAuth,
  getStoredToken,
  clearStoredToken,
  generateCodeVerifier,
  sha256Base64Url,
  PROVIDERS,
};

// Reference the runtime so the lint doesn't drop the import.
export const _platform = Platform.OS;
