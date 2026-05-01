import AsyncStorage from '@react-native-async-storage/async-storage';
import {kidsMediaApi, pollUntilDone} from '../../../../../services/kidsMediaApi';
import MediaCacheManager from './MediaCacheManager';
import AudioChannelManager from './AudioChannelManager';

/**
 * TTSManager - Cache-first Text-to-Speech manager for Kids Learning Zone.
 *
 * Uses PocketTTS (server-side, HARTOS backend) for synthesis.
 *
 * Resolution order:
 *   1. MediaCacheManager disk cache (file URI)
 *   2. AsyncStorage inline cache for short clips (< 100 chars)
 *   3. Server API (quickTTS for short text, submitTTS + poll for long text)
 *
 * Results are cached for offline use. Never throws - returns boolean.
 *
 * Usage:
 *   import TTSManager from './shared/TTSManager';
 *   const spoke = await TTSManager.speak('Hello world', { voice: 'alba' });
 *   await TTSManager.preCache(['Line one', 'Line two'], { voice: 'alba' });
 *   TTSManager.stop();
 */

// ── Cache Key helpers ──

const SHORT_TEXT_THRESHOLD = 100;
const ASYNC_STORAGE_PREFIX = 'tts_inline_';

// Build the params object used as MediaCacheManager key
const buildTTSParams = (text, voice, engine) => ({
  text,
  voice: voice || 'alba',
  engine: engine || 'pocket_tts',
});

// Build AsyncStorage key for inline short-clip cache
const getInlineKey = (text, voice, engine) => {
  return ASYNC_STORAGE_PREFIX + MediaCacheManager.generateCacheKey('tts', buildTTSParams(text, voice, engine));
};

// ── Internal State ──

let _speaking = false;
let _cancelled = false;

// ── TTSManager ──

const TTSManager = {
  /**
   * Speak text using TTS with cache-first resolution.
   * Never throws - returns true if audio was played, false otherwise.
   *
   * @param {string} text - The text to speak.
   * @param {Object} [options]
   * @param {string} [options.voice] - Voice identifier.
   * @param {string} [options.engine] - TTS engine (default: 'pocket_tts').
   * @param {Function} [options.onStart] - Called when playback starts.
   * @param {Function} [options.onEnd] - Called when playback ends.
   * @param {Function} [options.onError] - Called on error (informational only).
   * @returns {Promise<boolean>} true if audio was spoken, false otherwise.
   */
  speak: async (text, {voice, engine, onStart, onEnd, onError} = {}) => {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return false;
    }

    _cancelled = false;

    const params = buildTTSParams(text, voice, engine);
    const inlineKey = getInlineKey(text, voice, engine);
    const isShort = text.length < SHORT_TEXT_THRESHOLD;

    try {
      // ── Step 1: Check MediaCacheManager disk cache ──
      let audioUri = null;
      try {
        audioUri = MediaCacheManager.get('tts', params);
      } catch (_) {
        // Cache miss or unavailable - continue
      }

      if (audioUri && !_cancelled) {
        return await _playAudio(audioUri, {onStart, onEnd, onError});
      }

      // ── Step 2: Check AsyncStorage inline cache (short clips only) ──
      if (isShort && !_cancelled) {
        try {
          const cachedBase64 = await AsyncStorage.getItem(inlineKey);
          if (cachedBase64) {
            // Store to disk cache for faster future access
            try {
              const diskUri = await MediaCacheManager.storeBase64('tts', params, cachedBase64, '.mp3');
              if (diskUri && !_cancelled) {
                return await _playAudio(diskUri, {onStart, onEnd, onError});
              }
            } catch (_) {
              // Disk store failed, but we still have base64 - try inline playback
            }
          }
        } catch (_) {
          // AsyncStorage unavailable - continue to server
        }
      }

      if (_cancelled) return false;

      // ── Step 3: PocketTTS server API ──
      let audioData = null;

      if (isShort) {
        // Quick TTS for short text - returns inline base64
        const response = await kidsMediaApi.quickTTS({text, voice, engine});
        audioData = response;
      } else {
        // Submit + poll for longer text
        const submitResult = await kidsMediaApi.submitTTS({
          text,
          voice,
          engine,
          speed: undefined,
          language: undefined,
        });

        if (!submitResult.jobId) {
          if (onError) onError(new Error('No jobId returned from TTS submit'));
          return false;
        }

        audioData = await pollUntilDone(kidsMediaApi.pollTTS, submitResult.jobId, {
          intervalMs: 2000,
          maxAttempts: 30,
        });
      }

      if (_cancelled || !audioData) return false;

      // ── Cache the result for offline use ──
      let playableUri = audioData.url || audioData.uri || null;

      if (audioData.base64) {
        // Cache inline base64 to AsyncStorage for short clips
        if (isShort) {
          try {
            await AsyncStorage.setItem(inlineKey, audioData.base64);
          } catch (_) {
            // Non-critical - continue without inline caching
          }
        }

        // Store to disk cache via MediaCacheManager
        try {
          playableUri = await MediaCacheManager.storeBase64(
            'tts',
            params,
            audioData.base64,
            audioData.format ? `.${audioData.format}` : '.mp3',
          );
        } catch (_) {
          // Disk cache failed - try to play from URL if available
        }
      } else if (playableUri) {
        // Cache remote URL to disk
        try {
          await MediaCacheManager.download('tts', params, playableUri);
          const diskUri = MediaCacheManager.get('tts', params);
          if (diskUri) playableUri = diskUri;
        } catch (_) {
          // Cache failed - use remote URL directly
        }
      }

      if (!playableUri || _cancelled) {
        if (onError) onError(new Error('No playable audio URI available'));
        return false;
      }

      return await _playAudio(playableUri, {onStart, onEnd, onError});
    } catch (err) {
      if (onError) onError(err);
      return false;
    }
  },

  /**
   * Pre-cache TTS audio for multiple texts in parallel.
   * Useful for pre-loading narration for upcoming game screens.
   *
   * @param {string[]} texts - Array of texts to pre-cache.
   * @param {Object} [options]
   * @param {string} [options.voice] - Voice identifier.
   * @param {string} [options.engine] - TTS engine.
   * @returns {Promise<void>}
   */
  preCache: async (texts, {voice, engine} = {}) => {
    if (!Array.isArray(texts) || texts.length === 0) return;

    const tasks = texts.map(async (text) => {
      if (!text || typeof text !== 'string' || text.trim().length === 0) return;

      const params = buildTTSParams(text, voice, engine);
      const inlineKey = getInlineKey(text, voice, engine);

      // Skip if already cached on disk
      try {
        if (MediaCacheManager.has('tts', params)) return;
      } catch (_) {
        // Continue to fetch
      }

      const isShort = text.length < SHORT_TEXT_THRESHOLD;

      // Also skip if already in AsyncStorage (short clips)
      if (isShort) {
        try {
          const cached = await AsyncStorage.getItem(inlineKey);
          if (cached) return;
        } catch (_) {
          // Continue to fetch
        }
      }

      try {
        let audioData = null;

        if (isShort) {
          audioData = await kidsMediaApi.quickTTS({text, voice, engine});
        } else {
          const submitResult = await kidsMediaApi.submitTTS({
            text,
            voice,
            engine,
            speed: undefined,
            language: undefined,
          });
          if (!submitResult.jobId) return;
          audioData = await pollUntilDone(kidsMediaApi.pollTTS, submitResult.jobId, {
            intervalMs: 2000,
            maxAttempts: 30,
          });
        }

        if (!audioData) return;

        // Cache base64 data
        if (audioData.base64) {
          if (isShort) {
            try {
              await AsyncStorage.setItem(inlineKey, audioData.base64);
            } catch (_) {}
          }
          try {
            await MediaCacheManager.storeBase64('tts', params, audioData.base64, audioData.format ? `.${audioData.format}` : '.mp3');
          } catch (_) {}
        } else if (audioData.url || audioData.uri) {
          try {
            await MediaCacheManager.download('tts', params, audioData.url || audioData.uri);
          } catch (_) {}
        }
      } catch (_) {
        // Silently skip failed pre-cache items
      }
    });

    await Promise.allSettled(tasks);
  },

  /**
   * Stop current TTS playback.
   */
  stop: () => {
    _cancelled = true;
    _speaking = false;
    try {
      AudioChannelManager.stopTTS();
    } catch (_) {
      // AudioChannelManager may not be initialized
    }
  },

  /**
   * Check if TTS is currently speaking.
   *
   * @returns {boolean}
   */
  isSpeaking: () => {
    return _speaking;
  },
};

// ── Internal Helpers ──

/**
 * Play audio through AudioChannelManager and manage speaking state.
 * @returns {Promise<boolean>} true if playback completed, false otherwise.
 */
const _playAudio = async (uri, {onStart, onEnd, onError} = {}) => {
  try {
    _speaking = true;

    const success = await AudioChannelManager.playTTS(uri, {
      onStart: () => {
        if (onStart) onStart();
      },
      onEnd: () => {
        _speaking = false;
        if (onEnd) onEnd();
      },
    });

    if (!success) _speaking = false;
    return success;
  } catch (err) {
    _speaking = false;
    if (onError) onError(err);
    return false;
  }
};

export default TTSManager;
