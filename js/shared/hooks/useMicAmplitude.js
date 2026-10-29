import { useState, useEffect, useRef, useCallback } from 'react';
import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';

const { MicAmplitudeModule } = NativeModules;

const emitter = MicAmplitudeModule
  ? new NativeEventEmitter(MicAmplitudeModule)
  : null;

// Lifecycle states surfaced to consumers so the UI can render the right
// affordance (retry button on denial, fallback on unsupported, spinner on
// starting, the actual gameplay when listening).  Without this, voice
// templates would render "Starting mic..." forever on any failure path
// because the hook used to swallow all three (#408).
export const MIC_STATUS = Object.freeze({
  IDLE: 'idle',
  REQUESTING_PERMISSION: 'requesting_permission',
  DENIED: 'denied',
  UNSUPPORTED: 'unsupported',
  STARTING: 'starting',
  LISTENING: 'listening',
  ERROR: 'error',
});

async function checkExistingPermission() {
  if (Platform.OS !== 'android') return false;
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
  } catch {
    return false;
  }
}

async function requestMicPermission() {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'This game needs access to your microphone for voice activities.',
        buttonPositive: 'OK',
        buttonNegative: 'Cancel',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Hook that streams real-time microphone amplitude values.
 *
 * @param {number} [sensitivity=1.0] - Multiplier applied to the raw amplitude (clamped to 0-1).
 * @returns {{
 *   amplitude: number,
 *   decibels: number,
 *   isListening: boolean,
 *   status: string,          // one of MIC_STATUS.*
 *   error: string | null,    // human-readable error when status is denied/unsupported/error
 *   startListening: () => Promise<void>,
 *   stopListening: () => Promise<void>,
 * }}
 */
export default function useMicAmplitude(sensitivity = 1.0) {
  const [amplitude, setAmplitude] = useState(0);
  const [decibels, setDecibels] = useState(-160);
  const [isListening, setIsListening] = useState(false);
  // Initial status: 'unsupported' on iOS / when native module missing so
  // consumers can render a fallback immediately without an extra round-trip.
  const initialStatus = MicAmplitudeModule && Platform.OS === 'android'
    ? MIC_STATUS.IDLE
    : MIC_STATUS.UNSUPPORTED;
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState(
    initialStatus === MIC_STATUS.UNSUPPORTED
      ? 'Microphone access is only available on Android in this build.'
      : null,
  );
  const subscriptionRef = useRef(null);
  const mountedRef = useRef(true);
  const sensitivityRef = useRef(sensitivity);

  sensitivityRef.current = sensitivity;

  const safeSetStatus = useCallback((next, err = null) => {
    if (!mountedRef.current) return;
    setStatus(next);
    setError(err);
  }, []);

  const startListening = useCallback(async () => {
    if (!MicAmplitudeModule || !emitter) {
      safeSetStatus(
        MIC_STATUS.UNSUPPORTED,
        'MicAmplitude native module is not linked. Rebuild the app.',
      );
      return;
    }

    // Avoid re-prompting if a permission grant is already cached.
    const alreadyGranted = await checkExistingPermission();
    let hasPermission = alreadyGranted;

    if (!hasPermission) {
      safeSetStatus(MIC_STATUS.REQUESTING_PERMISSION);
      hasPermission = await requestMicPermission();
    }

    if (!hasPermission) {
      safeSetStatus(
        MIC_STATUS.DENIED,
        'Microphone permission was not granted. Tap to try again, or enable it in Settings.',
      );
      return;
    }

    safeSetStatus(MIC_STATUS.STARTING);

    // Subscribe before starting so we don't miss early events.
    if (!subscriptionRef.current) {
      subscriptionRef.current = emitter.addListener('onAmplitude', (event) => {
        if (!mountedRef.current) return;
        const scaled = Math.min(event.amplitude * sensitivityRef.current, 1.0);
        setAmplitude(scaled);
        setDecibels(event.decibels);
      });
    }

    // 2026-06-18 v2: Promise.race + setTimeout-inside-Promise-constructor
    // didn't fire on Hermes 96 / RN 0.68 (verified on Xiaomi: status
    // stayed STARTING for >10s after MicAmplitudeModule.startListening
    // hung).  Use a flat setTimeout that directly sets state from
    // outside the await — much simpler and reliably wakes the JS thread.
    const TIMEOUT_MS = 5000;
    let timeoutFired = false;
    const timeoutId = setTimeout(() => {
      timeoutFired = true;
      console.warn('MicAmplitude: startListening timed out after', TIMEOUT_MS, 'ms');
      if (!mountedRef.current) return;
      if (subscriptionRef.current) {
        try { subscriptionRef.current.remove(); } catch (_) {}
        subscriptionRef.current = null;
      }
      try { MicAmplitudeModule.stopListening?.()?.catch?.(() => {}); } catch (_) {}
      safeSetStatus(
        MIC_STATUS.ERROR,
        'Mic init timed out — another app may be holding the microphone.',
      );
    }, TIMEOUT_MS);

    try {
      await MicAmplitudeModule.startListening();
      clearTimeout(timeoutId);
      if (timeoutFired || !mountedRef.current) return;
      setIsListening(true);
      safeSetStatus(MIC_STATUS.LISTENING);
    } catch (e) {
      clearTimeout(timeoutId);
      if (timeoutFired) return;
      const message = (e && e.message) ? String(e.message) : String(e);
      console.warn('MicAmplitude startListening failed:', message);
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      const next = (e && e.code === 'PERMISSION_DENIED')
        ? MIC_STATUS.DENIED
        : MIC_STATUS.ERROR;
      safeSetStatus(next, message || 'Could not start microphone.');
    }
  }, [safeSetStatus]);

  const stopListening = useCallback(async () => {
    if (!MicAmplitudeModule) return;

    try {
      await MicAmplitudeModule.stopListening();
    } catch (e) {
      console.warn('MicAmplitude stopListening failed:', e && e.message);
    }

    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }

    if (!mountedRef.current) return;
    setIsListening(false);
    setAmplitude(0);
    setDecibels(-160);
    // Don't clobber a denied/error status from a later stopListening call.
    setStatus((prev) =>
      prev === MIC_STATUS.LISTENING || prev === MIC_STATUS.STARTING
        ? MIC_STATUS.IDLE
        : prev,
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clean up on unmount
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (MicAmplitudeModule) {
        MicAmplitudeModule.stopListening().catch(() => {});
      }
    };
  }, []);

  return {
    amplitude,
    decibels,
    isListening,
    status,
    error,
    startListening,
    stopListening,
  };
}
