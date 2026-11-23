import React from 'react';
import {act, create} from 'react-test-renderer';
import {Alert, Linking, PermissionsAndroid} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import useLocationPing from '../js/shared/hooks/useLocationPing';
import store from '../js/shared/encounterStore';
import {encountersApi} from '../js/shared/services/socialApi';
import {__resetTrackerForTests} from '../js/shared/services/encounterTracker';

jest.mock('react-native', () => ({
  Platform: {OS: 'android'}, Alert: {alert: jest.fn()},
  AppState: {currentState: 'active', addEventListener: jest.fn(() => ({remove: jest.fn()}))},
  Linking: {sendIntent: jest.fn(async () => {}), openSettings: jest.fn(async () => {})},
  PermissionsAndroid: {
    PERMISSIONS: {ACCESS_COARSE_LOCATION: 'coarse', ACCESS_FINE_LOCATION: 'fine'},
    RESULTS: {GRANTED: 'granted'}, requestMultiple: jest.fn(), check: jest.fn(),
  },
}));
jest.mock('@react-native-community/geolocation', () => ({
  watchPosition: jest.fn(), clearWatch: jest.fn(), getCurrentPosition: jest.fn(),
}));
jest.mock('../js/shared/deviceCapabilityStore', () => ({getState: () => ({deviceId: 'test'})}));
jest.mock('../js/shared/services/apiHelpers', () => ({getAccessToken: jest.fn(async () => 'account-token')}));
jest.mock('../js/shared/services/socialApi', () => ({encountersApi: {
  locationPing: jest.fn(async () => ({})), nearbyCount: jest.fn(async () => ({})),
  proximityMatches: jest.fn(async () => ({})),
  updateLocationSettings: jest.fn(async () => ({success: true})),
  getLocationSettings: jest.fn(async () => ({success: true, data: {location_sharing_enabled: false}})),
}}));
let hook, root;
function Probe() { hook = useLocationPing(); return null; }
beforeEach(async () => {
  __resetTrackerForTests(); jest.useFakeTimers(); jest.clearAllMocks();
  store.setState({isTracking: false, lat: null, lon: null, nearbyCount: 0, matches: []});
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
test('leaving the Encounters screen keeps tracking and pinging', async () => {
  // Tracking used to stop on unmount, so it ran only while Encounters was open.
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'granted', fine: 'granted'});
  await act(async () => hook.startTracking());
  await act(async () => Geolocation.watchPosition.mock.calls[0][0]({coords: {latitude: 12, longitude: 80}}));
  await act(async () => root.unmount());
  encountersApi.locationPing.mockClear();
  await act(async () => jest.advanceTimersByTime(30000));
  expect(encountersApi.locationPing).toHaveBeenCalled();
  expect(Geolocation.clearWatch).not.toHaveBeenCalled();
  expect(store.getState().isTracking).toBe(true);
  await act(async () => { root = create(<Probe />); }); // afterEach unmounts
});
test('switching off while permission is pending cannot start a watch', async () => {
  let resolve;
  PermissionsAndroid.requestMultiple.mockReturnValue(new Promise(r => {resolve = r;}));
  let pending;
  await act(async () => { pending = hook.startTracking(); });
  await act(async () => hook.stopTracking());
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

const grantFine = () =>
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'granted', fine: 'granted'});
const seed = () => Geolocation.getCurrentPosition.mock.calls[0];

test('a phone lying still becomes active from the one-shot first fix', async () => {
  grantFine();
  await act(async () => hook.startTracking());
  // The watch alone may never fire while the phone does not move.
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  const opts = seed()[2];
  expect(opts.timeout).toBeGreaterThan(0);
  expect(opts.maximumAge).toBeGreaterThan(0);
  expect(opts.enableHighAccuracy).toBe(true);
  await act(async () => seed()[0]({coords: {latitude: 28.87, longitude: 76.59}}));
  expect(store.getState().isTracking).toBe(true);
  expect(store.getState().lat).toBe(28.87);
});

test('Location switched off offers to open the Location settings', async () => {
  grantFine();
  await act(async () => hook.startTracking());
  await act(async () =>
    Geolocation.watchPosition.mock.calls[0][1]({code: 2, message: 'No location provider available.'}));
  expect(store.getState().isTracking).toBe(false);
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(7);
  const [title, , buttons] = Alert.alert.mock.calls[0];
  expect(title).toBe('Turn on Location');
  await act(async () => buttons.find(b => b.text === 'Open settings').onPress());
  expect(Linking.sendIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
  // The seed's own error for the same outage must not raise a second dialog.
  await act(async () => seed()[1]({code: 2, message: 'No location provider available.'}));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

test('no first fix in time is a visible error and Enable Location works again', async () => {
  grantFine();
  await act(async () => hook.startTracking());
  await act(async () => seed()[1]({code: 3, message: 'Location request timed out'}));
  expect(Alert.alert).toHaveBeenCalledWith('Location unavailable', expect.stringMatching(/couldn't get your location/i));
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(7);
  expect(store.getState().isTracking).toBe(false);
  // Not a dead button: a second tap starts a fresh attempt.
  await act(async () => hook.startTracking());
  expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);
});

test('a late first-fix error does not stop a watch that already has a fix', async () => {
  grantFine();
  await act(async () => hook.startTracking());
  await act(async () => Geolocation.watchPosition.mock.calls[0][0]({coords: {latitude: 1, longitude: 2}}));
  await act(async () => seed()[1]({code: 3, message: 'timeout'}));
  expect(store.getState().isTracking).toBe(true);
  expect(Geolocation.clearWatch).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('a real nearby-now envelope updates nearbyCount (regression: server wraps as {success, data})', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'granted', fine: 'granted'});
  encountersApi.nearbyCount.mockResolvedValue({success: true, data: {nearby_count: 3}});
  await act(async () => hook.startTracking());
  await act(async () => Geolocation.watchPosition.mock.calls[0][0]({coords: {latitude: 12, longitude: 80}}));
  await act(async () => jest.advanceTimersByTime(30000));
  expect(store.getState().nearbyCount).toBe(3);
});
test('the old flat {count} shape does not update nearbyCount (would silently mask the envelope bug)', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'granted', fine: 'granted'});
  encountersApi.nearbyCount.mockResolvedValue({count: 3});
  await act(async () => hook.startTracking());
  await act(async () => Geolocation.watchPosition.mock.calls[0][0]({coords: {latitude: 12, longitude: 80}}));
  await act(async () => jest.advanceTimersByTime(30000));
  expect(store.getState().nearbyCount).toBe(0);
});
test('a real proximity-matches envelope updates matches (regression: server wraps the list as {success, data})', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'granted', fine: 'granted'});
  encountersApi.proximityMatches.mockResolvedValue({success: true, data: [{id: 'm1'}]});
  await act(async () => hook.startTracking());
  await act(async () => jest.advanceTimersByTime(15000));
  expect(store.getState().matches).toEqual([{id: 'm1'}]);
});
