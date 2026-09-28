import React from 'react';
import {act, create} from 'react-test-renderer';
import {Alert, PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import useLocationPing from '../js/shared/hooks/useLocationPing';
import store from '../js/shared/encounterStore';
import {encountersApi} from '../js/shared/services/socialApi';

jest.mock('react-native', () => ({
  Platform: {OS: 'android'}, Alert: {alert: jest.fn()},
  PermissionsAndroid: {
    PERMISSIONS: {ACCESS_COARSE_LOCATION: 'coarse', ACCESS_FINE_LOCATION: 'fine'},
    RESULTS: {GRANTED: 'granted'}, requestMultiple: jest.fn(),
  },
}));
jest.mock('@react-native-community/geolocation', () => ({watchPosition: jest.fn(), clearWatch: jest.fn()}));
jest.mock('../js/shared/deviceCapabilityStore', () => ({getState: () => ({deviceId: 'test'})}));
jest.mock('../js/shared/services/socialApi', () => ({encountersApi: {
  locationPing: jest.fn(async () => ({})), nearbyCount: jest.fn(async () => ({})),
  proximityMatches: jest.fn(async () => ({})),
}}));
let hook, root;
function Probe() { hook = useLocationPing(); return null; }
beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks();
  store.setState({isTracking: false, lat: null, lon: null});
  Geolocation.watchPosition.mockReturnValue(7);
  await act(async () => { root = create(<Probe />); });
});
afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });
test('denied permission explains the problem and does not track', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'denied', fine: 'denied'});
  await act(async () => hook.startTracking());
  expect(Alert.alert).toHaveBeenCalledWith('Location permission needed', expect.any(String));
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  expect(store.getState().isTracking).toBe(false);
});
test('approximate permission works, becomes active on a fix, and stops cleanly', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'granted', fine: 'denied'});
  await act(async () => { await hook.startTracking(); await hook.startTracking(); });
  expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
  expect(Geolocation.watchPosition.mock.calls[0][2].enableHighAccuracy).toBe(false);
  expect(store.getState().isTracking).toBe(false);
  await act(async () => Geolocation.watchPosition.mock.calls[0][0]({coords: {latitude: 12, longitude: 80}}));
  expect(store.getState().isTracking).toBe(true);
  await act(async () => hook.stopTracking());
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(7);
  encountersApi.proximityMatches.mockClear();
  await act(async () => jest.advanceTimersByTime(60000));
  expect(encountersApi.proximityMatches).not.toHaveBeenCalled();
});
test('unmount while permission is pending cannot start a watch', async () => {
  let resolve;
  PermissionsAndroid.requestMultiple.mockReturnValue(new Promise(r => {resolve = r;}));
  let pending;
  await act(async () => { pending = hook.startTracking(); });
  await act(async () => root.unmount());
  await act(async () => { resolve({coarse: 'granted', fine: 'granted'}); await pending; });
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
});
test('provider errors stop tracking and show a visible error', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'granted', fine: 'granted'});
  await act(async () => hook.startTracking());
  await act(async () => Geolocation.watchPosition.mock.calls[0][1]({message: 'Location disabled'}));
  expect(store.getState().isTracking).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith('Location unavailable', 'Location disabled');
  encountersApi.proximityMatches.mockClear();
  await act(async () => jest.advanceTimersByTime(60000));
  expect(encountersApi.proximityMatches).not.toHaveBeenCalled();
});

test('iOS uses the native location watch and becomes active only after a fix', async () => {
  Platform.OS = 'ios';
  await act(async () => hook.startTracking());
  expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
  expect(store.getState().isTracking).toBe(false);
  await act(async () => Geolocation.watchPosition.mock.calls[0][0]({coords: {latitude: 12, longitude: 80}}));
  expect(store.getState().isTracking).toBe(true);
  await act(async () => Geolocation.watchPosition.mock.calls[0][1]({message: 'User denied location'}));
  expect(store.getState().isTracking).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith('Location unavailable', 'User denied location');
  Platform.OS = 'android';
});
