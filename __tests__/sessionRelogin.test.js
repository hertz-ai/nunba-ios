import React from 'react';
import {act, create} from 'react-test-renderer';
jest.mock('react-native', () => ({
 NativeModules: {OnboardingModule: {getStudentNameAndEmail: cb => cb('', '', '')}},
 DeviceEventEmitter: {emit: jest.fn()}, Alert: {alert: jest.fn()},
 View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity', ActivityIndicator: 'ActivityIndicator',
 StyleSheet: {create: x => x},
}));
jest.mock('react-native-responsive-screen', () => ({widthPercentageToDP: () => 10, heightPercentageToDP: () => 10}));
jest.mock('i18next', () => ({t: x => x}));
jest.mock('../js/shared/services/signupApi', () => ({sendLoginOtp: jest.fn(), verifyOtp: jest.fn(), isVerifySuccess: jest.fn(), linkHevolveAccount: jest.fn()}));
const {sendLoginOtp} = require('../js/shared/services/signupApi');
const Screen = require('../js/shared/components/SignUp/OtpVerification').default;
let root;
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {if (root) await act(async () => root.unmount());});
test('missing saved identity lets the user request a fresh login code', async () => {
 sendLoginOtp.mockResolvedValue({success: true});
 await act(async () => {root = create(<Screen route={{params: {mode: 'relogin'}}} navigation={{}} />);});
 await act(async () => root.root.findByProps({accessibilityLabel: 'Login email or phone'}).props.onChangeText('person@example.test'));
 await act(async () => root.root.findByProps({accessibilityLabel: 'Send login code'}).props.onPress());
 expect(sendLoginOtp).toHaveBeenCalledWith('person@example.test');
 expect(JSON.stringify(root.toJSON())).toContain('Enter the 4-digit code sent to');
 expect(JSON.stringify(root.toJSON())).toContain('person@example.test');
});
test('failed code request keeps the login form available with an error', async () => {
 sendLoginOtp.mockRejectedValue(new Error('offline'));
 await act(async () => {root = create(<Screen route={{params: {mode: 'relogin'}}} navigation={{}} />);});
 await act(async () => root.root.findByProps({accessibilityLabel: 'Login email or phone'}).props.onChangeText('person@example.test'));
 await act(async () => root.root.findByProps({accessibilityLabel: 'Send login code'}).props.onPress());
 expect(JSON.stringify(root.toJSON())).toContain('Could not send a code');
 expect(root.root.findByProps({accessibilityLabel: 'Send login code'}).props.disabled).toBe(false);
});
