import { getUserAuthHeaders } from './apiHelpers';
import { getApiBaseUrl } from './endpointResolver';

const post = async (path, body) => {
  const headers = await getUserAuthHeaders();
  const base = await getApiBaseUrl();
  const response = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${path}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from ${path}`);
  }
};

const get = async (path) => {
  const headers = await getUserAuthHeaders();
  const base = await getApiBaseUrl();
  const response = await fetch(`${base}/${path}`, {
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${path}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from ${path}`);
  }
};

// ── Polling Utility ──

/**
 * Polls a job endpoint until it reaches 'complete' or 'failed' status.
 *
 * @param {Function} pollFn - Async function that accepts a jobId and returns status object.
 * @param {string} jobId - The job identifier to poll.
 * @param {Object} options
 * @param {number} [options.intervalMs=3000] - Milliseconds between poll attempts.
 * @param {number} [options.maxAttempts=60] - Maximum number of poll attempts before timeout.
 * @param {Function} [options.onProgress] - Optional callback receiving progress (0-1).
 * @returns {Promise<Object>} The completed result object.
 */
export const pollUntilDone = async (pollFn, jobId, {
  intervalMs = 3000,
  maxAttempts = 60,
  onProgress,
} = {}) => {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await pollFn(jobId);
    if (result.status === 'complete') return result;
    if (result.status === 'failed') throw new Error(result.error || 'Media generation failed');
    if (onProgress) onProgress(result.progress || 0);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Media generation timeout');
};

// ── Kids Media API ──

export const kidsMediaApi = {
  // ── TTS Endpoints ──

  // Submit a TTS job for processing
  submitTTS: ({text, voice, engine, speed, language}) => {
    return post('media/tts/submit', {text, voice, engine, speed, language});
  },

  // Poll TTS job status by jobId
  pollTTS: (jobId) => {
    return get(`media/tts/status/${jobId}`);
  },

  // Quick inline TTS for short texts (returns base64 audio)
  quickTTS: ({text, voice, engine}) => {
    return post('media/tts/quick', {text, voice, engine});
  },

  // ── Music Composition (ACE Step 1.5) ──

  // Submit a music composition job
  submitMusic: ({prompt, duration, genre, mood, tempo, instruments}) => {
    return post('media/music/submit', {prompt, duration, genre, mood, tempo, instruments});
  },

  // Poll music composition job status by jobId
  pollMusic: (jobId) => {
    return get(`media/music/status/${jobId}`);
  },

  // Get cached/pre-generated music by category, mood, and duration
  getCachedMusic: ({category, mood, duration}) => {
    return post('media/music/cached', {category, mood, duration});
  },

  // ── Video Generation (LTX2) ──

  // Submit a video generation job
  submitVideo: ({prompt, duration, style, resolution}) => {
    return post('media/video/submit', {prompt, duration, style, resolution});
  },

  // Poll video generation job status by jobId
  pollVideo: (jobId) => {
    return get(`media/video/status/${jobId}`);
  },

  // ── Pre-generation ──

  // Request pre-generation of media assets for upcoming games
  requestPregeneration: ({gameIds, mediaTypes}) => {
    return post('media/pregenerate', {gameIds, mediaTypes});
  },

  // Get available pre-generated media for a specific game
  getAvailableMedia: (gameId) => {
    return get(`media/available/${gameId}`);
  },

  // ── Job Management ──

  // Cancel an active media generation job
  cancelJob: (jobId) => {
    return post('media/jobs/cancel', {jobId});
  },

  // Get all active media generation jobs for the current user
  getActiveJobs: () => {
    return get('media/jobs/active');
  },
};
