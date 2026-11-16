// Review of nunba-ios #2 (2026-10-27): which credential each host gets, which
// 401 re-logs the user in, and what happens when the selected desktop is gone.
jest.mock('react-native', () => ({
  NativeModules: {OnboardingModule: {
    getAccessToken: jest.fn(cb => cb('hevolve-test-token')),
    getUser_id: jest.fn(cb => cb('123')),
    getHartosToken: jest.fn(cb => cb('cloud-social-token')),
    getStudentNameAndEmail: jest.fn(cb => cb('Demo', 'demo@example.test', '')),
    setHartosToken: jest.fn(async () => {}),
  }},
  DeviceEventEmitter: {addListener: jest.fn(), emit: jest.fn()},
}));
jest.mock('axios', () => ({create: () => ({post: jest.fn()})}));
jest.mock('@react-native-async-storage/async-storage', () => ({getItem: jest.fn(async () => null)}));
jest.mock('../js/shared/services/endpointResolver', () => ({
  __esModule: true,
  default: {getApiBaseUrl: jest.fn(), getApiBase: jest.fn(), invalidateCache: jest.fn()},
}));
jest.mock('../js/shared/services/apiCache', () => ({wrap: jest.fn((key, value, ttl, fn) => fn()), bust: jest.fn(), bustAll: jest.fn()}));

const {NativeModules, DeviceEventEmitter} = require('react-native');
const resolver = require('../js/shared/services/endpointResolver').default;
const {codingApi, providerApi, goalsApi, bleEncounterApi, encountersApi} = require('../js/shared/services/socialApi');

const CLOUD = 'https://azurekong.hertzai.com';
const DESKTOP = 'http://192.168.1.5:5000';
const useCloud = () => {
  resolver.getApiBaseUrl.mockResolvedValue(CLOUD);
  resolver.getApiBase.mockResolvedValue({url: CLOUD, source: 'cloud'});
};
const useDesktop = () => {
  resolver.getApiBaseUrl.mockResolvedValue(DESKTOP);
  resolver.getApiBase.mockResolvedValue({url: DESKTOP, source: 'lan', credential: 'device-proof'});
};
const ok = {ok: true, status: 200, json: async () => ({success: true, data: []})};
const status = code => ({ok: false, status: code, json: async () => ({success: false})});
const emitted = name => DeviceEventEmitter.emit.mock.calls.filter(([n]) => n === name);
const bearerOf = call => call[1].headers.Authorization;

beforeEach(() => {
  jest.clearAllMocks();
  useCloud();
  global.fetch = jest.fn(async () => ok);
});

describe('legacy HTTPS families get the account token instead of throwing', () => {
  test.each([
    ['coding', () => codingApi.goals(), 'https://mailer.hertzai.com/api/coding/goals'],
    ['provider management', () => providerApi.list(), 'https://mailer.hertzai.com/api/admin/providers'],
    ['goals', () => goalsApi.list(), 'https://mailer.hertzai.com/api/goals'],
  ])('%s', async (_name, call, url) => {
    await call();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(url);
    expect(bearerOf(fetch.mock.calls[0])).toBe('Bearer hevolve-test-token');
    expect(NativeModules.OnboardingModule.getHartosToken).not.toHaveBeenCalled();
  });

  test('while a desktop is selected, the desktop credential stays on the desktop', async () => {
    useDesktop();
    await codingApi.goals();
    expect(bearerOf(fetch.mock.calls[0])).toBe('Bearer hevolve-test-token');
    await bleEncounterApi.getDiscoverable();
    expect(fetch.mock.calls[1][0]).toBe(`${DESKTOP}/api/social/encounter/discoverable`);
    expect(bearerOf(fetch.mock.calls[1])).toBe('Bearer device-proof');
  });
});

describe('only a cloud 401 asks the user to sign in again', () => {
  // Desktop first: SessionExpired is debounced for 10 s once emitted.
  test('a desktop 401 (phone not allowed yet) does not start a re-login', async () => {
    useDesktop();
    fetch.mockResolvedValue(status(401));
    await bleEncounterApi.getDiscoverable();
    expect(emitted('ApiError')).toHaveLength(1);
    expect(emitted('SessionExpired')).toHaveLength(0);
  });

  test('a cloud 401 that survives the token refresh starts a re-login', async () => {
    fetch.mockResolvedValue(status(401));
    await bleEncounterApi.getDiscoverable();
    expect(emitted('SessionExpired')).toHaveLength(1);
  });
});

describe('a desktop that drops off the network', () => {
  const offline = Object.assign(new TypeError('Network request failed'));

  test('a read forgets the desktop and is replayed once against the fresh choice', async () => {
    useDesktop();
    fetch.mockRejectedValueOnce(offline).mockResolvedValueOnce(ok);
    resolver.invalidateCache.mockImplementation(useCloud);
    await bleEncounterApi.getDiscoverable();
    expect(resolver.invalidateCache).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.map(c => c[0])).toEqual([
      `${DESKTOP}/api/social/encounter/discoverable`,
      `${CLOUD}/api/social/encounter/discoverable`,
    ]);
    expect(bearerOf(fetch.mock.calls[1])).toBe('Bearer cloud-social-token');
  });

  test('a write is not replayed, so it can never land twice', async () => {
    useDesktop();
    fetch.mockRejectedValueOnce(offline);
    await expect(encountersApi.locationPing(1, 2, 3, 'dev')).rejects.toThrow('Network request failed');
    expect(resolver.invalidateCache).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
