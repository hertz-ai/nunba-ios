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
 * Determine whether the given language should use native (on-device) STT.
 * English variants use the native Android SpeechRecognizer; all others
 * fall back to the HARTOS server STT endpoint via PeerLink/fetch.
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
          // No native STT available — try server
          await startServerSTT(lang);
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
          await startServerSTT(lang);
        }
      } else {
        await startServerSTT(lang);
      }
    } else {
      // Non-English — always use server STT
      await startServerSTT(lang);
    }
  }, [defaultLanguage, subscribeNativeEvents]);

  /**
   * Start server-side STT by sending a "listen" request.
   * Since we cannot stream raw audio from JS easily, this uses a
   * request-based approach: the native MicAmplitudeModule captures
   * audio and we send it to the server endpoint.
   *
   * For now, this triggers native recording via the legacy module and
   * routes the result through the server STT endpoint. If native
   * recording is unavailable, we set an appropriate error.
   */
  const startServerSTT = useCallback(async (lang) => {
    if (!mountedRef.current) return;

    // Try using PeerLink for server compute
    try {
      const { sendOnChannel } = require('../services/peerLinkService');
      subscribeNativeEvents();

      // Request server-side STT session via PeerLink compute channel
      const sent = await sendOnChannel('compute', {
        type: 'stt_start',
        language: lang,
        engine: 'whisper',
      });

      if (sent) {
        if (mountedRef.current) setIsListening(true);

        // Listen for PeerLink STT responses
        const peerSub = DeviceEventEmitter.addListener('onPeerLinkEvent', (event) => {
          if (!mountedRef.current) return;
          if (event.type === 'stt_result') {
            const text = (event.text || '').trim();
            const conf = event.confidence ?? -1;
            setTranscript(text);
            setConfidence(conf);
            if (event.isFinal) {
              setIsListening(false);
              if (text && onResultRef.current) onResultRef.current(text);
            } else if (onPartialResultRef.current) {
              onPartialResultRef.current(text);
            }
          }
        });
        listenersRef.current.push(peerSub);
        return;
      }
    } catch (_) {
      // PeerLink not available, fall through to direct API
    }

    // Direct server STT — we need audio data.
    // Use native SpeechRecognizer even for non-English (Android supports many locales)
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
        const msg = `Server STT unavailable for language: ${lang}`;
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

    // Stop PeerLink STT session
    try {
      const { sendOnChannel } = require('../services/peerLinkService');
      await sendOnChannel('compute', { type: 'stt_stop' });
    } catch (_) {}

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
