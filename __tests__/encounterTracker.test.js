/**
 * Encounters keeps working away from the Encounters screen.
 *
 * Once Location Sharing is on, tracking resumes by itself when the app starts
 * or comes back to the foreground -- without prompting and without dialogs --
 * and pauses in the background.  Switching Location Sharing off stops it and
 * keeps it off on later launches.  The switch now drives the real watch; it
 * used to only flip the store flag.
 */
import React from 'react';
import {act, create} from 'react-test-renderer';
import {Alert, AppState, PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import store from '../js/shared/encounterStore';
import {encountersApi} from '../js/shared/services/socialApi';
import {getAccessToken} from '../js/shared/services/apiHelpers';
import {
  initEncounterTracker, enableTracking, disableTracking, __resetTrackerForTests,
} from '../js/shared/services/encounterTracker';
import LocationSettingsToggle from '../js/shared/components/CommunityView/components/Encounters/LocationSettingsToggle';

let appStateHandler;
jest.mock('react-native', () => {
  const React = require('react');
  const host = (name) => ({children, ...p}) => React.createElement(name, p, children);
  return {
    Platform: {OS: 'android'}, Alert: {alert: jest.fn()},
    Linking: {sendIntent: jest.fn(async () => {}), openSettings: jest.fn(async () => {})},
    AppState: {currentState: 'active', addEventListener: jest.fn()},
    PermissionsAndroid: {
      PERMISSIONS: {ACCESS_COARSE_LOCATION: 'coarse', ACCESS_FINE_LOCATION: 'fine'},
      RESULTS: {GRANTED: 'granted'}, requestMultiple: jest.fn(), check: jest.fn(),
    },
    View: host('View'), Text: host('Text'), Switch: host('Switch'),
    StyleSheet: {create: (s) => s},
  };
});
jest.mock('react-native-responsive-screen', () => ({widthPercentageToDP: (v) => v, heightPercentageToDP: (v) => v}));
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@react-native-community/geolocation', () => ({
  watchPosition: jest.fn(), clearWatch: jest.fn(), getCurrentPosition: jest.fn(),
}));
jest.mock('../js/shared/deviceCapabilityStore', () => ({getState: () => ({deviceId: 'test'})}));
jest.mock('../js/shared/services/apiHelpers', () => ({getAccessToken: jest.fn(async () => 'account-token')}));
jest.mock('../js/shared/services/socialApi', () => ({encountersApi: {
  locationPing: jest.fn(async () => ({})), nearbyCount: jest.fn(async () => ({})),
  proximityMatches: jest.fn(async () => ({})),
  updateLocationSettings: jest.fn(async () => ({success: true})),
  getLocationSettings: jest.fn(),
}}));

const sharing = (on) =>
  encountersApi.getLocationSettings.mockResolvedValue({success: true, data: {location_sharing_enabled: on}});
const permission = (fine, coarse = fine) =>
  PermissionsAndroid.check.mockImplementation(async (p) => (p === 'fine' ? fine : coarse));
const launch = async () => {
  await act(async () => { initEncounterTracker(); });
  appStateHandler = AppState.addEventListener.mock.calls[0][1];
};
const fix = () => Geolocation.watchPosition.mock.calls.at(-1)[0]({coords: {latitude: 12, longitude: 80}});

beforeEach(() => {
  __resetTrackerForTests();
  jest.useFakeTimers();
  jest.clearAllMocks();
  AppState.addEventListener.mockReturnValue({remove: jest.fn()});
  AppState.currentState = 'active';
  Platform.OS = 'android';
  getAccessToken.mockResolvedValue('account-token');
  Geolocation.watchPosition.mockReturnValue(7);
  store.setState({isTracking: false, lat: null, lon: null, nearbyCount: 0, matches: []});
});
afterEach(() => jest.useRealTimers());

test('launch with sharing on and permission granted resumes silently', async () => {
  sharing(true); permission(true);
  await launch();
  expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
  expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled(); // no prompt at launch
  await act(async () => fix());
  expect(store.getState().isTracking).toBe(true);
  encountersApi.locationPing.mockClear();
  await act(async () => jest.advanceTimersByTime(30000));
  expect(encountersApi.locationPing).toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('launch with sharing on but no permission yet stays quiet', async () => {
  sharing(true); permission(false);
  await launch();
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('launch with sharing off does not track', async () => {
  sharing(false); permission(true);
  await launch();
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
});

test('signed out at launch: resumes on the next foreground once the settings load', async () => {
  encountersApi.getLocationSettings.mockResolvedValue({success: false, error: 'Unauthorized'});
  permission(true);
  await launch();
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  sharing(true);
  await act(async () => appStateHandler('active'));
  expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
});

test('a resume that hits Location off fails quietly, with no dialog', async () => {
  sharing(true); permission(true);
  await launch();
  await act(async () => Geolocation.watchPosition.mock.calls[0][1]({code: 2, message: 'No location provider available.'}));
  expect(store.getState().isTracking).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('background pauses tracking; coming back resumes it', async () => {
  sharing(true); permission(true);
  await launch();
  await act(async () => appStateHandler('background'));
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(7);
  encountersApi.locationPing.mockClear();
  await act(async () => jest.advanceTimersByTime(60000));
  expect(encountersApi.locationPing).not.toHaveBeenCalled();
  await act(async () => appStateHandler('active'));
  expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);
});

test('Enable Location saves sharing on; switching off stops and saves it off', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'granted', fine: 'granted'});
  await act(async () => enableTracking());
  expect(encountersApi.updateLocationSettings).toHaveBeenCalledWith({location_sharing_enabled: true});
  await act(async () => disableTracking());
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(7);
  expect(encountersApi.updateLocationSettings).toHaveBeenLastCalledWith({location_sharing_enabled: false});
});

test('a denied Enable Location does not turn sharing on', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({coarse: 'denied', fine: 'denied'});
  await act(async () => enableTracking());
  expect(encountersApi.updateLocationSettings).not.toHaveBeenCalled();
});

test('the Location Sharing switch stops the real watch, not just the flag', async () => {
  sharing(true); permission(true);
  await launch();
  await act(async () => fix());
  let tree;
  await act(async () => { tree = create(<LocationSettingsToggle />); });
  const sw = tree.root.find((n) => n.type === 'Switch');
  expect(sw.props.value).toBe(true);
  await act(async () => sw.props.onValueChange(false));
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(7);
  expect(store.getState().isTracking).toBe(false);
  encountersApi.locationPing.mockClear();
  await act(async () => jest.advanceTimersByTime(60000));
  expect(encountersApi.locationPing).not.toHaveBeenCalled();
});

test('signed out at launch: no request at all (each 401 would raise "Session expired")', async () => {
  getAccessToken.mockResolvedValue(null);
  sharing(true); permission(true);
  await launch();
  expect(encountersApi.getLocationSettings).not.toHaveBeenCalled();
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
});

test('logging out while tracking stops it at the next tick, with no ping sent', async () => {
  sharing(true); permission(true);
  await launch();
  await act(async () => fix());
  getAccessToken.mockResolvedValue(null);
  encountersApi.locationPing.mockClear();
  encountersApi.proximityMatches.mockClear();
  await act(async () => jest.advanceTimersByTime(30000));
  expect(encountersApi.locationPing).not.toHaveBeenCalled();
  expect(encountersApi.proximityMatches).not.toHaveBeenCalled();
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(7);
  expect(store.getState().isTracking).toBe(false);
  // Signing back in: the next foreground resumes it.
  getAccessToken.mockResolvedValue('account-token');
  await act(async () => appStateHandler('active'));
  expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);
});

test('iOS never resumes silently: watchPosition would raise a system prompt', async () => {
  Platform.OS = 'ios';
  sharing(true);
  await launch();
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
});
