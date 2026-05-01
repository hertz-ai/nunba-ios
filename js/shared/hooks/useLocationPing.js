import { useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import useEncounterStore from '../encounterStore';
import useDeviceCapabilityStore from '../deviceCapabilityStore';
import { encountersApi } from '../services/socialApi';

const useLocationPing = () => {
  const isTracking = useEncounterStore((s) => s.isTracking);
  const lat = useEncounterStore((s) => s.lat);
  const lon = useEncounterStore((s) => s.lon);
  const nearbyCount = useEncounterStore((s) => s.nearbyCount);
  const matches = useEncounterStore((s) => s.matches);

  const watchIdRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const matchIntervalRef = useRef(null);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
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
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message:
              'This app needs access to your location to find people nearby.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('Location permission denied');
          return;
        }
      }

      useEncounterStore.getState().setTracking(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          useEncounterStore.getState().setLocation(latitude, longitude);
        },
        (error) => {
          console.warn('Geolocation watchPosition error:', error.message);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 30000,
        },
      );

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
            if (result && typeof result.count === 'number') {
              useEncounterStore.getState().setNearbyCount(result.count);
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
          if (result && Array.isArray(result.matches)) {
            useEncounterStore.getState().setMatches(result.matches);
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
      console.warn('startTracking error:', err);
    }
  }, []);

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
