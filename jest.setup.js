/**
 * Jest setup for Nunba Companion (iOS).
 *
 * Mocks NativeModules with no-op shims so JS unit tests run on Node
 * without an iOS simulator. Real native module behavior is verified
 * separately by the XCTest target inside the Xcode project.
 */

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    NativeModules: {
      ...RN.NativeModules,
      OnboardingModule: {
        getUser_id: jest.fn((cb) => cb('test-user-id')),
        getAccessToken: jest.fn((cb) => cb('test-access-token')),
        publishToWamp: jest.fn(),
      },
      DeviceCapabilityModule: {
        getDeviceId: jest.fn(() => Promise.resolve('test-device-uuid')),
        getDeviceName: jest.fn(() => Promise.resolve('Test iPhone')),
        getDeviceType: jest.fn(() => Promise.resolve('phone')),
      },
      LocalHartosModule: {
        getLocalStatus: jest.fn(() =>
          Promise.resolve({
            serviceRunning: false,
            modelDownloaded: false,
            activeModel: null,
            modelSizeMb: 0,
          }),
        ),
        checkComputeConditions: jest.fn(() =>
          Promise.resolve({canRun: false, reason: 'Test environment'}),
        ),
      },
      PeerLinkModule: {
        start: jest.fn(),
        send: jest.fn(),
        runAgent: jest.fn(() => Promise.resolve('{}')),
        getStatus: jest.fn(() =>
          Promise.resolve({isConnected: false, isHandshakeComplete: false}),
        ),
        connectToPeer: jest.fn(() => Promise.resolve()),
      },
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));
