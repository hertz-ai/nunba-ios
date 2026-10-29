import { useState, useEffect, useRef, useCallback } from 'react';
import {
  NativeModules,
  DeviceEventEmitter,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { getToken } from '../services/apiHelpers';
import { getApiBaseUrl } from '../services/endpointResolver';

const { SpeechRecognizerModule } = NativeModules;

async function requestMicPermission() {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'This app needs access to your microphone for speech recognition.',
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
 * Determine whether the given language takes the English recognizer path.
 * English variants use the native Android SpeechRecognizer directly; all
 * others go through startLocaleSTT, the recognizer for their own locale.
 */
function shouldUseNativeSTT(language) {
  if (!language) return true;
  const lang = language.toLowerCase().replace('_', '-');
  return lang === 'en' || lang.startsWith('en-');
}

// --- Server STT ---

/**
 * Send audio/text to the HARTOS STT endpoint for non-English languages.
 * If we only have text (from a partial native result routed here), this
 * is a no-op. The primary use-case is POST-ing recorded audio for
 * server-side transcription.
 *
 * @param {string} audioBase64 - Base64-encoded audio data (PCM/WAV)
 * @param {string} language - BCP-47 language tag
 * @returns {Promise<{text: string, confidence: number}>}
 */
async function serverSTT(audioBase64, language) {
  const token = await getToken();
  const apiBase = await getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/v1/stt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      audio: audioBase64,
      language: language || 'auto',
      format: 'base64',
      engine: 'whisper',
    }),
  });

  if (!response.ok) {
    throw new Error(`Server STT error: ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.text || data.transcript || '',
    confidence: data.confidence ?? -1,
  };
}

// --- Hook ---

/**
 * Speech-to-text hook with native Android STT for English and
 * HARTOS server fallback for other languages.
 *
 * @param {Object} [config]
 * @param {string} [config.language='en'] - BCP-47 language code
 * @param {function} [config.onResult] - Callback fired with final transcript text
 * @param {function} [config.onPartialResult] - Callback fired with partial transcript text
 * @param {function} [config.onError] - Callback fired on error string
 *
 * @returns {{
 *   transcript: string,
 *   isListening: boolean,
 *   confidence: number,
 *   startListening: (options?: {language?: string, continuous?: boolean}) => Promise<void>,
 *   stopListening: () => Promise<void>,
 *   resetTranscript: () => void,
 *   error: string|null,
 * }}
 */
export default function useSpeechRecognition(config = {}) {
  const {
    language: defaultLanguage = 'en',
    onResult,
    onPartialResult,
    onError: onErrorCallback,
  } = config;

  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [confidence, setConfidence] = useState(-1);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const listenersRef = useRef([]);
  const activeLanguageRef = useRef(defaultLanguage);
  const onResultRef = useRef(onResult);
  const onPartialResultRef = useRef(onPartialResult);
  const onErrorRef = useRef(onErrorCallback);

  // Keep callback refs fresh
  onResultRef.current = onResult;
  onPartialResultRef.current = onPartialResult;
  onErrorRef.current = onErrorCallback;

  // --- Native event subscriptions ---

  const subscribeNativeEvents = useCallback(() => {
    // Remove any existing listeners first
    listenersRef.current.forEach((sub) => sub.remove());
    listenersRef.current = [];

    const onStart = DeviceEventEmitter.addListener('onSpeechStart', () => {
      if (!mountedRef.current) return;
      setIsListening(true);
      setError(null);
    });

    const onEnd = DeviceEventEmitter.addListener('onSpeechEnd', () => {
      if (!mountedRef.current) return;
      setIsListening(false);
    });

    const onSpeechResult = DeviceEventEmitter.addListener('onSpeechResult', (event) => {
      if (!mountedRef.current) return;
      const text = (event.text || '').trim();
      const conf = event.confidence ?? -1;
      setTranscript(text);
      setConfidence(conf);
      setIsListening(false);
      if (text && onResultRef.current) {
        onResultRef.current(text);
      }
    });

    const onPartial = DeviceEventEmitter.addListener('onSpeechPartialResult', (event) => {
      if (!mountedRef.current) return;
      const text = (event.text || '').trim();
      if (text) {
        setTranscript(text);
        if (onPartialResultRef.current) {
          onPartialResultRef.current(text);
        }
      }
    });

    const onSpeechError = DeviceEventEmitter.addListener('onSpeechError', (event) => {
      if (!mountedRef.current) return;
      const errMsg = event.error || 'Unknown speech error';
      setError(errMsg);
      setIsListening(false);
      if (onErrorRef.current) {
        onErrorRef.current(errMsg);
      }
    });

    // Also listen for legacy SpeechRecognizedEvent from ActivityStarterModule
    const onLegacy = DeviceEventEmitter.addListener('SpeechRecognizedEvent', (event) => {
      if (!mountedRef.current) return;
      const text = (event.SpeechRecognizedText || '').trim();
      if (text) {
        setTranscript(text);
        setConfidence(-1);
        if (onResultRef.current) {
          onResultRef.current(text);
        }
      }
    });

    listenersRef.current = [onStart, onEnd, onSpeechResult, onPartial, onSpeechError, onLegacy];
  }, []);

  const unsubscribeNativeEvents = useCallback(() => {
    listenersRef.current.forEach((sub) => sub.remove());
    listenersRef.current = [];
  }, []);

  // --- Start / Stop ---

  const startListening = useCallback(async (options = {}) => {
    if (!mountedRef.current) return;

    const lang = options.language || defaultLanguage;
    const continuous = options.continuous || false;
    activeLanguageRef.current = lang;

    setError(null);
    setTranscript('');
    setConfidence(-1);

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      const msg = 'Microphone permission denied';
      setError(msg);
      if (onErrorRef.current) onErrorRef.current(msg);
      return;
    }

    const useNative = shouldUseNativeSTT(lang) && SpeechRecognizerModule;

    if (useNative) {
      // Use the dedicated SpeechRecognizerModule (preferred)
      subscribeNativeEvents();
      try {
        await SpeechRecognizerModule.startListening({
          language: lang,
          continuous,
          maxResults: 3,
        });
        if (mountedRef.current) setIsListening(true);
      } catch (e) {
        // Fall back to legacy ActivityStarterModule
        const { ActivityStarterModule } = NativeModules;
        if (ActivityStarterModule && ActivityStarterModule.startSpeechListening) {
          try {
            ActivityStarterModule.startSpeechListening();
            if (mountedRef.current) setIsListening(true);
          } catch (legacyErr) {
            const msg = legacyErr.message || 'Failed to start speech recognition';
            if (mountedRef.current) {
              setError(msg);
              setIsListening(false);
            }
            if (onErrorRef.current) onErrorRef.current(msg);
          }
        } else {
          // No native STT available — the locale recognizer path
          await startLocaleSTT(lang);
        }
      }
    } else if (shouldUseNativeSTT(lang) && !SpeechRecognizerModule) {
      // SpeechRecognizerModule not available, try legacy
      const { ActivityStarterModule } = NativeModules;
      subscribeNativeEvents();
      if (ActivityStarterModule && ActivityStarterModule.startSpeechListening) {
        try {
          ActivityStarterModule.startSpeechListening();
          if (mountedRef.current) setIsListening(true);
        } catch (legacyErr) {
          await startLocaleSTT(lang);
        }
      } else {
        await startLocaleSTT(lang);
      }
    } else {
      // Non-English: the recognizer for that locale
      await startLocaleSTT(lang);
    }
  }, [defaultLanguage, subscribeNativeEvents]);

  /**
   * Hear a language the English path does not take: Android's own
   * SpeechRecognizer for that locale (Android supports many).
   *
   * This used to send a PeerLink 'stt_start' on 'compute' first and wait for
   * an 'stt_result' event.  Nothing answers that frame -- a desktop drops
   * every device frame on 'compute' and no node handles stt_start -- so with
   * a link up the mic showed "listening" and never returned a transcript.
   * A desktop STT, if one is wanted, comes as a mobile-adapter call.
   */
  const startLocaleSTT = useCallback(async (lang) => {
    if (!mountedRef.current) return;

    if (SpeechRecognizerModule) {
      subscribeNativeEvents();
      try {
        await SpeechRecognizerModule.startListening({
          language: lang,
          continuous: false,
          maxResults: 3,
        });
        if (mountedRef.current) setIsListening(true);
      } catch (e) {
        const msg = `Speech recognition unavailable for language: ${lang}`;
        if (mountedRef.current) setError(msg);
        if (onErrorRef.current) onErrorRef.current(msg);
      }
    } else {
      const msg = 'No speech recognition available (native module missing)';
      if (mountedRef.current) setError(msg);
      if (onErrorRef.current) onErrorRef.current(msg);
    }
  }, [subscribeNativeEvents]);

  const stopListening = useCallback(async () => {
    if (!mountedRef.current) return;

    // Stop native recognizer
    if (SpeechRecognizerModule) {
      try {
        await SpeechRecognizerModule.stopListening();
      } catch (_) {}
    }

    // Stop legacy module
    const { ActivityStarterModule } = NativeModules;
    if (ActivityStarterModule && ActivityStarterModule.startSpeechListening) {
      // Legacy module toggles on repeated calls — only call if it was the one listening
      // We don't call it here to avoid toggling; the native side will stop on its own.
    }

    unsubscribeNativeEvents();

    if (mountedRef.current) {
      setIsListening(false);
    }
  }, [unsubscribeNativeEvents]);

  const resetTranscript = useCallback(() => {
    if (!mountedRef.current) return;
    setTranscript('');
    setConfidence(-1);
    setError(null);
  }, []);

  // --- Cleanup on unmount ---

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Remove all event listeners
      listenersRef.current.forEach((sub) => sub.remove());
      listenersRef.current = [];
      // Cancel any active recognition
      if (SpeechRecognizerModule) {
        SpeechRecognizerModule.cancel().catch(() => {});
      }
    };
  }, []);

  return {
    transcript,
    isListening,
    confidence,
    startListening,
    stopListening,
    resetTranscript,
    error,
  };
}
