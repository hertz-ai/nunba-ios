import React from 'react';
import {act, create} from 'react-test-renderer';
jest.mock('react-native', () => ({
 NativeModules: {PeerLinkModule: {setDesktopEndpoint: jest.fn()}},
 ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity', View: 'View',
 StyleSheet: {create: x => x},
}));
jest.mock('react-native-responsive-screen', () => ({widthPercentageToDP: () => 10, heightPercentageToDP: () => 10}));
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('../js/shared/services/socialApi', () => ({consentApi: {list: jest.fn(async () => ({success: true, data: {consents: []}})), grant: jest.fn(), revoke: jest.fn()}}));
jest.mock('../js/shared/services/endpointResolver', () => ({__esModule: true, default: {invalidateCache: jest.fn()}}));
jest.mock('../js/shared/services/apiCache', () => ({__esModule: true, default: {bustAll: jest.fn()}}));
const {NativeModules} = require('react-native');
const resolver = require('../js/shared/services/endpointResolver').default;
const {consentApi} = require('../js/shared/services/socialApi');
const Screen = require('../js/shared/components/CommunityView/screens/PrivacySettingsScreen').default;
let root;
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {if (root) await act(async () => root.unmount());});
test('explicit desktop selection resets routing but never grants device access', async () => {
 NativeModules.PeerLinkModule.setDesktopEndpoint.mockResolvedValue(true);
 await act(async () => {root = create(<Screen />);});
 await act(async () => root.root.findByType('TextInput').props.onChangeText('http://172.20.10.13:5000'));
 await act(async () => root.root.findByProps({accessibilityLabel: 'Connect to desktop'}).props.onPress());
 expect(NativeModules.PeerLinkModule.setDesktopEndpoint).toHaveBeenCalledWith('http://172.20.10.13:5000');
 expect(resolver.invalidateCache).toHaveBeenCalledTimes(1);
 expect(consentApi.grant).not.toHaveBeenCalled();
 expect(JSON.stringify(root.toJSON())).toContain('Allow this iPhone on the desktop');
});
test('a failed desktop health check leaves routing unchanged and shows the error', async () => {
 NativeModules.PeerLinkModule.setDesktopEndpoint.mockRejectedValue(new Error('Desktop unreachable'));
 await act(async () => {root = create(<Screen />);});
 await act(async () => root.root.findByProps({accessibilityLabel: 'Connect to desktop'}).props.onPress());
 expect(resolver.invalidateCache).not.toHaveBeenCalled();
 expect(JSON.stringify(root.toJSON())).toContain('Desktop unreachable');
});
test('slow consent history does not leave Connect stuck busy', async () => {
 let finish;
 NativeModules.PeerLinkModule.setDesktopEndpoint.mockResolvedValue(true);
 consentApi.list.mockResolvedValueOnce({success: true, data: {consents: []}});
 await act(async () => {root = create(<Screen />);});
 consentApi.list.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
 await act(async () => root.root.findByProps({accessibilityLabel: 'Desktop address'}).props.onChangeText('http://172.20.10.13:5000'));
 await act(async () => root.root.findByProps({accessibilityLabel: 'Connect to desktop'}).props.onPress());
 expect(root.root.findByProps({accessibilityLabel: 'Connect to desktop'}).props.disabled).toBe(false);
 expect(JSON.stringify(root.toJSON())).toContain('Desktop selected');
 await act(async () => finish({success: true, data: {consents: []}}));
});
