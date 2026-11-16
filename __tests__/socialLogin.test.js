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
jest.mock('../js/shared/services/endpointResolver', () => ({
  __esModule: true, default: {getApiBaseUrl: jest.fn(async () => 'https://azurekong.hertzai.com'), getApiBase: jest.fn(async () => ({url: 'https://azurekong.hertzai.com', source: 'cloud'}))},
}));
jest.mock('../js/shared/services/apiCache', () => ({wrap: jest.fn((key, value, ttl, fn) => fn()), bust: jest.fn()}));
const {NativeModules} = require('react-native');
const resolver = require('../js/shared/services/endpointResolver').default;
const {linkHevolveAccount} = require('../js/shared/services/signupApi');
const {ensureFreshHartosToken, bleEncounterApi} = require('../js/shared/services/socialApi');
const account = {email: 'demo@example.test', hevolveUserId: 123};
beforeEach(() => {
  jest.clearAllMocks();
  resolver.getApiBaseUrl.mockResolvedValue('https://azurekong.hertzai.com');
  resolver.getApiBase.mockResolvedValue({url: 'https://azurekong.hertzai.com', source: 'cloud'});
  NativeModules.OnboardingModule.getAccessToken.mockImplementation(cb => cb('hevolve-test-token'));
  global.fetch = jest.fn(async () => ({ok: true, status: 200, json: async () => ({success: true, data: {token: 'social-test-token'}})}));
});
test('link supplies Bearer and omits email-shaped phone', async () => {
  await linkHevolveAccount({...account, phoneNumber: account.email});
  expect(fetch).toHaveBeenCalledWith('https://azurekong.hertzai.com/api/social/auth/link-hevolve', expect.objectContaining({headers: expect.objectContaining({Authorization: 'Bearer hevolve-test-token'})}));
  expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('phone_number');
});
test('missing login cannot exchange identity', async () => {
  NativeModules.OnboardingModule.getAccessToken.mockImplementation(cb => cb(''));
  await expect(linkHevolveAccount(account)).rejects.toThrow('Sign in again');
  expect(fetch).not.toHaveBeenCalled();
});
test.each(['http://azurekong.hertzai.com:6777', 'http://192.168.1.2:6777', 'https://azurekong.hertzai.com.evil.test'])('does not send credential to %s', async base => {
  resolver.getApiBaseUrl.mockResolvedValue(base);
  await expect(linkHevolveAccount(account)).rejects.toThrow('configured HTTPS cloud');
  expect(fetch).not.toHaveBeenCalled();
});
test('server rejection is not treated as a saved login', async () => {
  fetch.mockResolvedValue({ok: false, status: 401, json: async () => ({success: false, error: 'Unauthorized'})});
  await expect(linkHevolveAccount(account)).rejects.toThrow('Unauthorized');
});
test('concurrent refresh reuses the current login and writes social Keychain only once', async () => {
  const result = await Promise.all([ensureFreshHartosToken(), ensureFreshHartosToken()]);
  expect(result).toEqual(['social-test-token', 'social-test-token']);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(NativeModules.OnboardingModule.setHartosToken).toHaveBeenCalledTimes(1);
});
test('account switch during exchange cannot install stale social token', async () => {
  NativeModules.OnboardingModule.getAccessToken.mockImplementationOnce(cb => cb('old')).mockImplementation(cb => cb('new'));
  expect(await ensureFreshHartosToken()).toBeNull();
  expect(NativeModules.OnboardingModule.setHartosToken).not.toHaveBeenCalled();
});

test('LAN encounters use only the credential paired with that endpoint', async () => {
 resolver.getApiBaseUrl.mockResolvedValue('http://192.168.1.5:5000');
 resolver.getApiBase.mockResolvedValue({url: 'http://192.168.1.5:5000', source: 'lan', credential: 'device-proof'});
 await bleEncounterApi.getDiscoverable();
 expect(fetch).toHaveBeenCalledWith('http://192.168.1.5:5000/api/social/encounter/discoverable', expect.objectContaining({headers: expect.objectContaining({Authorization: 'Bearer device-proof'})}));
 expect(NativeModules.OnboardingModule.getHartosToken).not.toHaveBeenCalled();
});
test('a LAN URL without a device credential cannot receive a cloud token', async () => {
 resolver.getApiBaseUrl.mockResolvedValue('http://192.168.1.5:5000');
 resolver.getApiBase.mockResolvedValue({url: 'http://192.168.1.5:5000', source: 'lan'});
 await expect(bleEncounterApi.getDiscoverable()).rejects.toThrow();
 expect(fetch).not.toHaveBeenCalled();
});

test.each([["retained-token", null, false], ["retained-token", "", false], ["", "123", false], ["valid-token", "123", true]])('a complete restored session requires token and account ID', (token, id, expected) => {
 expect(require('../js/shared/services/signupApi').isCompleteSession(token, id)).toBe(expected);
});
