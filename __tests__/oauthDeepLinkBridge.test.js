/**
 * Regression guard for the 2026-07-15 fix: deepLinkService.js and
 * InAppOAuthService.js (#465) both use the shared redirect_uri
 * `<scheme>://oauth-complete` for every provider (Slack, Discord,
 * Google, Teams, ...), but were built as two independent designs —
 * a client-side PKCE flow and an older server-mediated ("PR O") flow.
 * deepLinkService previously only ever emitted 'onAgentOAuthComplete',
 * which nothing PKCE-side listened for, so every "Connect with X"
 * tap silently hung until the 5-minute timeout.
 *
 * Unlike InAppOAuthService.test.js (source-contract only, mocks
 * DeviceEventEmitter.addListener as a no-op stub — which is exactly
 * why this bug went unnoticed), this file wires a REAL event emitter
 * shared by both modules so the actual cross-module handoff is
 * exercised end-to-end.
 */
jest.mock('react-native', () => {
  const { EventEmitter } = require('events');
  const emitter = new EventEmitter();
  return {
    Linking: {
      openURL: jest.fn().mockResolvedValue(true),
      getInitialURL: jest.fn().mockResolvedValue(null),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    DeviceEventEmitter: {
      addListener: (event, cb) => {
        emitter.on(event, cb);
        return { remove: () => emitter.off(event, cb) };
      },
      emit: (event, payload) => emitter.emit(event, payload),
    },
    Platform: { OS: 'ios' },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    setItem: jest.fn((k, v) => { store.set(k, v); return Promise.resolve(); }),
    getItem: jest.fn((k) => Promise.resolve(store.has(k) ? store.get(k) : null)),
    removeItem: jest.fn((k) => { store.delete(k); return Promise.resolve(); }),
  };
});

jest.mock('../js/shared/services/socialApi', () => ({
  shareApi: {}, referralsApi: {}, campaignsApi: {},
}));

const { DeviceEventEmitter, Linking } = require('react-native');
const deepLinkService = require('../js/shared/services/deepLinkService').default;
const InAppOAuthService = require('../js/shared/services/InAppOAuthService');

describe('OAuth deep-link bridge (deepLinkService <-> InAppOAuthService)', () => {
  test('PKCE redirect (code+state) emits oauth_complete with the shape InAppOAuthService expects', async () => {
    const received = [];
    DeviceEventEmitter.addListener('oauth_complete', (p) => received.push(p));

    await deepLinkService.handleDeepLink('hevolve://oauth-complete?code=ABC123&state=XYZ789');

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ code: 'ABC123', state: 'XYZ789', ok: true });
  });

  test('legacy server-hop redirect (channel_type) emits onAgentOAuthComplete ONLY, not oauth_complete', async () => {
    const oauthComplete = [];
    const agentComplete = [];
    DeviceEventEmitter.addListener('oauth_complete', (p) => oauthComplete.push(p));
    DeviceEventEmitter.addListener('onAgentOAuthComplete', (p) => agentComplete.push(p));

    await deepLinkService.handleDeepLink('hevolve://oauth-complete?channel_type=slack&ok=true&message=Linked');

    expect(agentComplete).toHaveLength(1);
    expect(agentComplete[0]).toMatchObject({ channel_type: 'slack', ok: true });
    expect(oauthComplete).toHaveLength(0);
  });

  test('end-to-end: InAppOAuthService.startOAuth resolves when deepLinkService routes the real provider redirect', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok_123', scope: 'chat:write' }),
    });

    const oauthPromise = InAppOAuthService.startOAuth('slack');

    // startOAuth awaits the PKCE code_challenge (crypto.subtle.digest)
    // before calling Linking.openURL, so give that microtask chain a
    // moment to flush before reading the mock's call args.
    let calledUrl;
    for (let i = 0; i < 50 && !calledUrl; i++) {
      await new Promise((r) => setTimeout(r, 5));
      if (Linking.openURL.mock.calls.length) {
        calledUrl = Linking.openURL.mock.calls[Linking.openURL.mock.calls.length - 1][0];
      }
    }
    expect(calledUrl).toBeTruthy();
    const state = new URL(calledUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    await deepLinkService.handleDeepLink(`hevolve://oauth-complete?code=PROVIDERCODE&state=${state}`);

    const token = await oauthPromise;
    expect(token.access_token).toBe('tok_123');
  });

  test('end-to-end: a mismatched state is ignored, not resolved', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'should_not_be_used' }),
    });

    const oauthPromise = InAppOAuthService.startOAuth('discord');
    // Someone else's callback (different state) must not resolve this one.
    await deepLinkService.handleDeepLink('hevolve://oauth-complete?code=WRONG&state=not-the-real-state');

    let settled = false;
    oauthPromise.then(() => { settled = true; }).catch(() => { settled = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
  });
});
