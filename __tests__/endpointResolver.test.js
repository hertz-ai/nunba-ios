jest.mock('react-native', () => ({NativeModules: {PeerLinkModule: {getApiBase: jest.fn()}}}));
jest.mock('@react-native-async-storage/async-storage', () => ({getItem: jest.fn(async () => null)}));
const {NativeModules} = require('react-native');
const resolver = require('../js/shared/services/endpointResolver');
beforeEach(() => {resolver.invalidateCache(); jest.clearAllMocks();});
test('keeps a desktop credential paired with its URL across cache hits', async () => {
 NativeModules.PeerLinkModule.getApiBase.mockResolvedValue({url: 'http://192.168.1.5:5000', source: 'lan', credential: 'device-proof'});
 expect(await resolver.getApiBase()).toEqual({url: 'http://192.168.1.5:5000', source: 'lan', credential: 'device-proof'});
 expect(await resolver.getApiBase()).toEqual({url: 'http://192.168.1.5:5000', source: 'lan', credential: 'device-proof'});
 expect(NativeModules.PeerLinkModule.getApiBase).toHaveBeenCalledTimes(1);
});
