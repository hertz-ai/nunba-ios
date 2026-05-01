import { useState, useEffect, useRef, useCallback } from 'react';
import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';

const { MicAmplitudeModule } = NativeModules;

const emitter = MicAmplitudeModule
  ? new NativeEventEmitter(MicAmplitudeModule)
  : null;

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
 * @returns {{ amplitude: number, decibels: number, isListening: boolean, startListening: () => Promise<void>, stopListening: () => Promise<void> }}
 */
export default function useMicAmplitude(sensitivity = 1.0) {
  const [amplitude, setAmplitude] = useState(0);
  const [decibels, setDecibels] = useState(-160);
  const [isListening, setIsListening] = useState(false);
  const subscriptionRef = useRef(null);
  const mountedRef = useRef(true);
  const sensitivityRef = useRef(sensitivity);

  sensitivityRef.current = sensitivity;

  const startListening = useCallback(async () => {
    if (!MicAmplitudeModule || !emitter) return;

    const hasPermission = await requestMicPermission();
    if (!hasPermission) return;

    // Subscribe before starting so we don't miss early events
    if (!subscriptionRef.current) {
      subscriptionRef.current = emitter.addListener('onAmplitude', (event) => {
        if (!mountedRef.current) return;
        const scaled = Math.min(event.amplitude * sensitivityRef.current, 1.0);
        setAmplitude(scaled);
        setDecibels(event.decibels);
      });
    }

    try {
      await MicAmplitudeModule.startListening();
      if (mountedRef.current) setIsListening(true);
    } catch (e) {
      console.warn('MicAmplitude startListening failed:', e.message);
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    }
  }, []);

  const stopListening = useCallback(async () => {
    if (!MicAmplitudeModule) return;

    try {
      await MicAmplitudeModule.stopListening();
    } catch (e) {
      console.warn('MicAmplitude stopListening failed:', e.message);
    }

    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }

    if (mountedRef.current) {
      setIsListening(false);
      setAmplitude(0);
      setDecibels(-160);
    }
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

  return { amplitude, decibels, isListening, startListening, stopListening };
}
