jest.mock('react-native', () => ({
  NativeModules: {OnboardingModule: {
    getAccessToken: jest.fn(cb => cb('hevolve-test-token')),
    getUser_id: jest.fn(cb => cb('123')),
    getStudentNameAndEmail: jest.fn(cb => cb('Demo', 'demo@example.test', '')),
    setHartosToken: jest.fn(async () => {}),
  }},
  DeviceEventEmitter: {addListener: jest.fn(), emit: jest.fn()},
}));
jest.mock('axios', () => ({create: () => ({post: jest.fn()})}));
jest.mock('../js/shared/services/endpointResolver', () => ({
  __esModule: true, default: {getApiBaseUrl: jest.fn(async () => 'https://azurekong.hertzai.com')},
}));
jest.mock('../js/shared/services/apiCache', () => ({wrap: jest.fn(), bust: jest.fn()}));
const {NativeModules} = require('react-native');
const resolver = require('../js/shared/services/endpointResolver').default;
const {linkHevolveAccount} = require('../js/shared/services/signupApi');
const {ensureFreshHartosToken} = require('../js/shared/services/socialApi');
const account = {email: 'demo@example.test', hevolveUserId: 123};
beforeEach(() => {
  jest.clearAllMocks();
  resolver.getApiBaseUrl.mockResolvedValue('https://azurekong.hertzai.com');
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
