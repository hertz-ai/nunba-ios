/**
 * PocketTTSService — Server-side TTS via HARTOS backend.
 *
 * PocketTTS (100M params, MIT license) runs on the backend at 6x real-time on CPU.
 * This client sends text to the HARTOS PocketTTS endpoint and receives audio.
 *
 * Features:
 *   - 8 built-in voices: alba, marius, javert, jean, fantine, cosette, eponine, azelma
 *   - Zero-shot voice cloning from 5+ seconds of audio
 *   - ~200ms latency for first audio chunk
 *   - 24kHz output sample rate
 *
 * Usage:
 *   import PocketTTSService from './PocketTTSService';
 *   const result = await PocketTTSService.synthesize('Hello world', { voice: 'alba' });
 *   // result.url or result.base64
 */

import { getToken } from './apiHelpers';
import { getApiBaseUrl } from './endpointResolver';

const VOICES = ['alba', 'marius', 'javert', 'jean', 'fantine', 'cosette', 'eponine', 'azelma'];

const PocketTTSService = {
  /**
   * Synthesize speech via PocketTTS backend.
   * @param {string} text - Text to synthesize
   * @param {Object} [options]
   * @param {string} [options.voice='alba'] - Voice name
   * @returns {Promise<{url?: string, base64?: string, format?: string, duration?: number, sampleRate: number, voice: string, engine: string}>}
   */
  synthesize: async (text, {voice = 'alba'} = {}) => {
    const token = await getToken();
    const base = await getApiBaseUrl();
    const response = await fetch(`${base}/api/tts/pocket-tts/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text,
        voice,
        engine: 'pocket_tts',
      }),
    });

    if (!response.ok) {
      throw new Error(`PocketTTS server error: ${response.status}`);
    }

    const data = await response.json();
    return {
      ...data,
      sampleRate: data.sample_rate || 24000,
      voice: data.voice || voice,
      engine: 'pocket_tts',
    };
  },

  /**
   * List available voices (built-in + cloned).
   * @returns {Promise<string[]>}
   */
  listVoices: async () => {
    try {
      const token = await getToken();
      const base = await getApiBaseUrl();
      const response = await fetch(`${base}/api/tts/pocket-tts/voices`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (response.ok) {
        const data = await response.json();
        return data.voices || VOICES;
      }
    } catch (_) {}
    return VOICES;
  },

  /** Built-in voice names */
  VOICES,

  /** Default sample rate */
  SAMPLE_RATE: 24000,
};

export default PocketTTSService;
