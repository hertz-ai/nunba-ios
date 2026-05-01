/**
 * TTS Capability Probe for React Native.
 *
 * Returns PocketTTS (server-side) as the TTS engine.
 * PocketTTS runs on the HARTOS backend — 100M params, 6x real-time on CPU,
 * 8 built-in voices, zero-shot voice cloning from 5s audio.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'tts_capability_v2';

/**
 * @typedef {Object} TTSCapability
 * @property {'pocket_tts'} engine - Selected TTS engine
 * @property {number} sampleRate - Output sample rate
 * @property {string} reason - Selection reason
 */

/**
 * Probe device capabilities and select best TTS engine.
 * @returns {Promise<TTSCapability>}
 */
export async function probeTTSCapability() {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  const result = {
    engine: 'pocket_tts',
    sampleRate: 24000,
    reason: 'PocketTTS server-side inference (HARTOS backend)',
  };

  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result));
  } catch (_) {}

  console.log(`[TTS Probe] Selected: ${result.engine} (${result.reason})`);
  return result;
}

/**
 * Clear cached probe result (for testing or re-detection).
 */
export async function clearTTSCapabilityCache() {
  try { await AsyncStorage.removeItem(CACHE_KEY); } catch (_) {}
}

export default probeTTSCapability;
