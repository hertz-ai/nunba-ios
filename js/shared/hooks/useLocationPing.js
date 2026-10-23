import { useEffect, useRef, useCallback } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import useEncounterStore from '../encounterStore';
import useDeviceCapabilityStore from '../deviceCapabilityStore';
import { encountersApi } from '../services/socialApi';

const useLocationPing = () => {
  const isTracking = useEncounterStore((s) => s.isTracking);
  const lat = useEncounterStore((s) => s.lat);
  const lon = useEncounterStore((s) => s.lon);
  const nearbyCount = useEncounterStore((s) => s.nearbyCount);
  const matches = useEncounterStore((s) => s.matches);

  const generationRef = useRef(0);
  const startingRef = useRef(false);
  const watchIdRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const matchIntervalRef = useRef(null);

  const stopTracking = useCallback(() => {
    generationRef.current += 1;
    startingRef.current = false;
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (matchIntervalRef.current) {
      clearInterval(matchIntervalRef.current);
      matchIntervalRef.current = null;
    }
    useEncounterStore.getState().setTracking(false);
  }, []);

  const startTracking = useCallback(async () => {
    if (startingRef.current || watchIdRef.current !== null) return;
    startingRef.current = true;
    const generation = ++generationRef.current;
    let precise = true;
    try {
      if (Platform.OS === 'android') {
        const permissions = PermissionsAndroid.PERMISSIONS;
        const granted = await PermissionsAndroid.requestMultiple([
          permissions.ACCESS_COARSE_LOCATION,
          permissions.ACCESS_FINE_LOCATION,
        ]);
        if (generation !== generationRef.current) return;
        precise = granted[permissions.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
        if (!precise && granted[permissions.ACCESS_COARSE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Location permission needed', 'Allow location access to find people nearby. If Android no longer asks, enable Location in this app’s settings.');
          return;
        }
      }

      watchIdRef.current = Geolocation.watchPosition(
        (position) => {
          if (generation !== generationRef.current) return;
          useEncounterStore.getState().setTracking(true);
          const { latitude, longitude } = position.coords;
          useEncounterStore.getState().setLocation(latitude, longitude);
        },
        (error) => {
          if (generation !== generationRef.current) return;
          stopTracking();
          Alert.alert('Location unavailable', error.message || 'Check that device location is turned on, then try again.');
        },
        {
          enableHighAccuracy: precise,
          distanceFilter: 10,
          interval: 30000,
        },
      );

      if (generation !== generationRef.current) {
        stopTracking();
        return;
      }

      // Ping location and get nearby count every 30 seconds
      const doPing = async () => {
        const state = useEncounterStore.getState();
        if (state.lat !== null && state.lon !== null) {
          try {
            const { deviceId } = useDeviceCapabilityStore.getState();
            await encountersApi.locationPing(state.lat, state.lon, 10, deviceId);
          } catch (e) {
            console.warn('Location ping failed:', e.message);
          }
          try {
            const result = await encountersApi.nearbyCount();
            // Server envelope is {success, data: {nearby_count}} (api_common._ok) —
            // not the flat {count} shape this used to check, so nearbyCount
            // never updated from its initial 0 regardless of real proximity.
            if (result?.success && typeof result.data?.nearby_count === 'number') {
              useEncounterStore.getState().setNearbyCount(result.data.nearby_count);
            }
          } catch (e) {
            console.warn('Nearby count failed:', e.message);
          }
        }
      };

      // Poll proximity matches every 15 seconds
      const doMatchPoll = async () => {
        try {
          const result = await encountersApi.proximityMatches();
          // Server envelope is {success, data: [...]} — ProximityService.get_matches
          // returns the list directly as `data`, not as `data.matches`.
          if (result?.success && Array.isArray(result.data)) {
            useEncounterStore.getState().setMatches(result.data);
          }
        } catch (e) {
          console.warn('Proximity matches poll failed:', e.message);
        }
      };

      // Initial calls
      doPing();
      doMatchPoll();

      pingIntervalRef.current = setInterval(doPing, 30000);
      matchIntervalRef.current = setInterval(doMatchPoll, 15000);
    } catch (err) {
      if (generation !== generationRef.current) return;
      stopTracking();
      Alert.alert('Could not enable location', err.message || 'Please try again.');
    } finally {
      if (generation === generationRef.current) startingRef.current = false;
    }
  }, [stopTracking]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    isTracking,
    lat,
    lon,
    nearbyCount,
    matches,
    startTracking,
    stopTracking,
  };
};

export default useLocationPing;
