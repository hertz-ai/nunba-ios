/**
 * Encounters location tracking, app-wide.
 *
 * The watch, the 30 s location ping and the 15 s match poll used to live in
 * useLocationPing's refs, and the hook stopped them on unmount -- so tracking
 * ran only while the Encounters screen was open (and enableFreeze() in
 * index.js skips effects on off-screen routes as well).  Leaving the screen,
 * or relaunching the app, meant tapping Enable Location again.
 *
 * Now it lives here, once per JS runtime.  MainApplication creates the React
 * context at app start, and BottomNavigationActivity keeps the host resumed on
 * every bottom tab, so tracking keeps running on all of them.  Whether the
 * person has turned it on is the account's location_sharing_enabled
 * (/encounters/location-settings), the same flag the Location Sharing switch
 * already saved; on launch and whenever the app comes back to the foreground
 * it resumes silently if that flag is on and location permission was already
 * granted.  It never prompts or shows a dialog unless the person asked
 * (Enable Location / the switch), and it pauses while the app is in the
 * background -- tracking there would need background-location permission and
 * a foreground service.
 *
 * It also needs a signed-in account.  Signed out, it makes no request at all:
 * every social call would answer 401, and each 401 raises the global "Session
 * expired" banner -- every 30 s from the ping.  A logout stops it at the next
 * tick; the next foreground after signing in resumes it.
 */
import { Alert, AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import useEncounterStore from '../encounterStore';
import useDeviceCapabilityStore from '../deviceCapabilityStore';
import { encountersApi } from './socialApi';
import { getAccessToken } from './apiHelpers';

// GeolocationError codes (@react-native-community/geolocation).
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;
const FIRST_FIX_TIMEOUT_MS = 15000;
const FIRST_FIX_MAX_AGE_MS = 60000;
const PING_INTERVAL_MS = 30000;
const MATCH_POLL_INTERVAL_MS = 15000;

const tracker = {
  generation: 0,
  starting: false,
  watchId: null,
  pingInterval: null,
  matchInterval: null,
  enabled: false, // the person turned location sharing on (account flag)
  appStateSub: null,
};

// Android reports a switched-off Location as POSITION_UNAVAILABLE
// ("No location provider available.").  That is something the user can fix,
// so say so and take them to the switch instead of echoing the raw text.
const showLocationError = (error) => {
  const message = (error && error.message) || '';
  const locationOff =
    Platform.OS === 'android' &&
    ((error && error.code === POSITION_UNAVAILABLE) || /no location provider/i.test(message));
  if (locationOff) {
    Alert.alert(
      'Turn on Location',
      "Your phone's Location is off. Turn it on to find people nearby, then tap Enable Location again.",
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Open settings',
          onPress: () =>
            Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings()),
        },
      ],
    );
    return;
  }
  if (error && error.code === TIMEOUT) {
    Alert.alert(
      'Location unavailable',
      "Couldn't get your location yet. Check that Location is on, move near a window, and try again.",
    );
    return;
  }
  Alert.alert('Location unavailable', message || 'Check that device location is turned on, then try again.');
};

const signedIn = async () => {
  const token = await getAccessToken();
  return !!token && token !== 'null';
};

// Stop the watch and the timers.  Does not change whether sharing is enabled.
const halt = () => {
  tracker.generation += 1;
  tracker.starting = false;
  if (tracker.watchId !== null) {
    Geolocation.clearWatch(tracker.watchId);
    tracker.watchId = null;
  }
  if (tracker.pingInterval) {
    clearInterval(tracker.pingInterval);
    tracker.pingInterval = null;
  }
  if (tracker.matchInterval) {
    clearInterval(tracker.matchInterval);
    tracker.matchInterval = null;
  }
  useEncounterStore.getState().setTracking(false);
};

// Location permission: ask only when the person asked for tracking; a silent
// resume only checks what was already granted.  Returns {ok, precise}.
const locationPermission = async (interactive) => {
  if (Platform.OS !== 'android') {
    // iOS has no prompt-free check here: watchPosition itself asks.  Resume
    // silently only where it cannot surprise anyone with a system prompt.
    return { ok: interactive, precise: true };
  }
  const { PERMISSIONS, RESULTS } = PermissionsAndroid;
  if (!interactive) {
    const fine = await PermissionsAndroid.check(PERMISSIONS.ACCESS_FINE_LOCATION);
    const coarse = fine || (await PermissionsAndroid.check(PERMISSIONS.ACCESS_COARSE_LOCATION));
    return { ok: coarse, precise: fine };
  }
  const granted = await PermissionsAndroid.requestMultiple([
    PERMISSIONS.ACCESS_COARSE_LOCATION,
    PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  const precise = granted[PERMISSIONS.ACCESS_FINE_LOCATION] === RESULTS.GRANTED;
  return { ok: precise || granted[PERMISSIONS.ACCESS_COARSE_LOCATION] === RESULTS.GRANTED, precise };
};

// Start the watch and the timers.  interactive: the person asked, so prompts
// and error dialogs are allowed; a silent resume fails quietly and leaves the
// Enable Location button on the Encounters screen.  Returns whether location
// permission was available.
const run = async ({ interactive }) => {
  if (tracker.starting || tracker.watchId !== null) return true;
  tracker.starting = true;
  const generation = ++tracker.generation;
  const fail = (error) => {
    if (generation !== tracker.generation) return;
    halt();
    if (interactive) showLocationError(error);
  };
  try {
    const { ok, precise } = await locationPermission(interactive);
    if (generation !== tracker.generation) return ok;
    if (!ok) {
      if (interactive) {
        Alert.alert('Location permission needed', 'Allow location access to find people nearby. If Android no longer asks, enable Location in this app’s settings.');
      }
      return false;
    }

    const onFix = (position) => {
      if (generation !== tracker.generation) return;
      useEncounterStore.getState().setTracking(true);
      const { latitude, longitude } = position.coords;
      useEncounterStore.getState().setLocation(latitude, longitude);
    };

    tracker.watchId = Geolocation.watchPosition(onFix, fail, {
      enableHighAccuracy: precise,
      distanceFilter: 10,
      interval: 30000,
    });

    if (generation !== tracker.generation) {
      halt();
      return true;
    }

    // The watch only reports a *new* fix, and Android holds back fixes
    // closer than distanceFilter to the last one -- a phone lying still
    // (indoors, on a desk) can wait indefinitely, leaving "Location Sharing
    // is Off" on screen while every further tap is a silent no-op.  Seed the
    // first position with a one-shot read that may use a fresh cached fix,
    // and bound it so a missing fix becomes a visible, retryable error.
    Geolocation.getCurrentPosition(
      onFix,
      (error) => {
        if (useEncounterStore.getState().isTracking) return; // the watch already has a fix
        fail(error);
      },
      {
        enableHighAccuracy: precise,
        timeout: FIRST_FIX_TIMEOUT_MS,
        maximumAge: FIRST_FIX_MAX_AGE_MS,
      },
    );

    const doPing = async () => {
      if (!(await signedIn())) {
        halt(); // signed out since the last tick: resume after the next sign-in
        return;
      }
      const state = useEncounterStore.getState();
      if (state.lat !== null && state.lon !== null) {
        try {
          const { deviceId } = useDeviceCapabilityStore.getState();
          await encountersApi.locationPing(state.lat, state.lon, 10, deviceId);
        } catch (e) {
          console.warn('Location ping failed:', e.message);
        }
        try {
          // HARTOS answers {success, data: {nearby_count}} (api_common._ok),
          // not the flat {count} this used to read, so nearbyCount never
          // moved off 0 regardless of real proximity.
          const result = await encountersApi.nearbyCount();
          if (result?.success && typeof result.data?.nearby_count === 'number') {
            useEncounterStore.getState().setNearbyCount(result.data.nearby_count);
          }
        } catch (e) {
          console.warn('Nearby count failed:', e.message);
        }
      }
    };

    const doMatchPoll = async () => {
      if (!(await signedIn())) {
        halt();
        return;
      }
      try {
        // HARTOS answers {success, data: [...matches]} (api_common._ok): the
        // list is `data` itself, not `data.matches`. Reading a `matches` key
        // left the list empty even when the server had matched two phones.
        const result = await encountersApi.proximityMatches();
        if (result?.success && Array.isArray(result.data)) {
          useEncounterStore.getState().setMatches(result.data);
        }
      } catch (e) {
        console.warn('Proximity matches poll failed:', e.message);
      }
    };

    doPing();
    doMatchPoll();
    tracker.pingInterval = setInterval(doPing, PING_INTERVAL_MS);
    tracker.matchInterval = setInterval(doMatchPoll, MATCH_POLL_INTERVAL_MS);
    return true;
  } catch (err) {
    if (generation === tracker.generation) {
      halt();
      if (interactive) Alert.alert('Could not enable location', err.message || 'Please try again.');
    }
    return false;
  } finally {
    if (generation === tracker.generation) tracker.starting = false;
  }
};

// Save the account's location-sharing choice.  socialApi returns the error
// envelope instead of throwing, so both shapes are handled.
const saveSharing = async (enabled) => {
  try {
    const result = await encountersApi.updateLocationSettings({ location_sharing_enabled: enabled });
    if (result && result.success === false) {
      console.warn('Failed to update location settings:', result.error);
    }
  } catch (e) {
    console.warn('Failed to update location settings:', e.message);
  }
};

/** The person tapped Enable Location or switched Location Sharing on. */
export const enableTracking = async () => {
  const permitted = await run({ interactive: true });
  if (!permitted) return;
  if (!tracker.enabled) {
    tracker.enabled = true;
    await saveSharing(true);
  }
};

/** The person switched Location Sharing off: stop, and stay off on later launches. */
export const disableTracking = async () => {
  tracker.enabled = false;
  halt();
  await saveSharing(false);
};

/**
 * Resume without asking if the account has location sharing on.  Safe to call
 * any time: it does nothing while tracking runs or when sharing is off.
 */
export const resumeIfEnabled = async () => {
  if (tracker.watchId !== null || tracker.starting) return;
  if (!(await signedIn())) return; // no account yet: try on the next foreground
  try {
    const result = await encountersApi.getLocationSettings();
    if (!(result?.success && result.data)) return; // signed out or offline: try on the next foreground
    tracker.enabled = result.data.location_sharing_enabled === true;
  } catch (e) {
    return;
  }
  if (tracker.enabled && AppState.currentState !== 'background') {
    await run({ interactive: false });
  }
};

/** Called once from index.js, when the JS runtime starts with the app. */
export const initEncounterTracker = () => {
  if (tracker.appStateSub) return;
  tracker.appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      resumeIfEnabled();
    } else if (next === 'background') {
      halt(); // no background-location permission; resume on return
    }
  });
  resumeIfEnabled();
};

// Tests only: forget module state between cases.
export const __resetTrackerForTests = () => {
  halt();
  if (tracker.appStateSub) tracker.appStateSub.remove();
  tracker.appStateSub = null;
  tracker.enabled = false;
  tracker.generation = 0;
};
