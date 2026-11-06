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
  // Nunba's existing TTS routes (routes/chatbot_routes.py /api/social/tts/*)
  // replace the media/tts/* paths, which no server ever implemented (404 on
  // local Nunba, "no Route matched" on central).  Those routes answer
  // {success, data:{...}}; it is unwrapped here so callers keep their contract.

  // Submit a TTS job for processing -> {jobId}
  submitTTS: async ({text, voice, speed, language}) => {
    const r = await post('api/social/tts/submit', {text, voice, speed, language});
    return {...r, jobId: r && r.data && r.data.taskId};
  },

  // Poll TTS job status -> {status:'pending'|'complete'|'failed', base64, format}
  pollTTS: async (jobId) => {
    const r = await get(`api/social/tts/status/${jobId}`);
    const d = (r && r.data) || {};
    const status = d.status === 'done' ? 'complete' : (d.status === 'failed' ? 'failed' : 'pending');
    return {...d, status};
  },

  // Quick inline TTS for short texts -> {base64, format}.  retry_after is set
  // (with no audio) while the engine is still warming up.
  quickTTS: async ({text, voice}) => {
    const r = await post('api/social/tts/quick', {text, voice});
    const d = (r && r.data) || {};
    return {...d, audio_base64: d.base64, success: r && r.success, retry_after: r && r.retry_after};
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

  // Cached music by category + mood, from Nunba's existing media route
  // (routes/kids_media_routes.py /api/media/asset).  A cache hit there streams
  // the audio; a miss starts generation and answers 202.  HEAD asks which
  // without downloading, and only a hit is handed back as a URL to cache.
  // An agent binds a game's music once, in CREATE, and every later run of
  // that agent must play the same piece — the one its reviewer approved.
  // Naming the agent and the game lets the node answer from that binding
  // instead of composing something new (kids_media_routes._bound_game_media).
  getCachedMusic: async ({category, mood, promptId, gameId, state, level}) => {
    const headers = await getUserAuthHeaders();
    const base = await getApiBaseUrl();
    const prompt = `${category || 'general'} ${mood || 'happy'} kids background music`;
    // The state the game is in, so the node answers with what its agent
    // memoized for that state rather than the game's music every time
    // (HARTOS docs/internal/GAME_SOUND_MEMOIZATION_SPEC.md §4).
    const bound =
      promptId && gameId
        ? `&prompt_id=${encodeURIComponent(promptId)}&game_id=${encodeURIComponent(gameId)}` +
          `&state=${encodeURIComponent(state || 'bgm')}` +
          (level ? `&level=${encodeURIComponent(level)}` : '')
        : '';
    const url = `${base}/api/media/asset?type=music&prompt=${encodeURIComponent(prompt)}${bound}`;
    // A binding answers as JSON, so it is a GET; a cached or composing
    // asset only needs its status, which the same GET reports.
    const response = await fetch(url, {method: bound ? 'GET' : 'HEAD', headers});
    // The download that follows needs the same credential this request
    // carried: a desktop refuses another machine without one
    // (HARTOS security/middleware.py, bundled desktop).  It goes only to
    // the node this request was made to, never to another host.
    const onNode = (u) => typeof u === 'string' && u.startsWith(base);
    const fromNode = (u) => (typeof u === 'string' && u.startsWith('/') ? `${base}${u}` : u);
    if (response.status !== 200) {
      return {pending: response.status === 202};
    }
    if (bound) {
      try {
        const body = await response.json();
        if (body && body.url) {
          // `matched` says which key answered: mine, level or game.  It is
          // carried so a caller can log a hit as a hit.  A node keeps a
          // composition and names it by its own path (HARTOS 6759fbfa6),
          // so a relative url is resolved against the node that answered.
          const boundUrl = fromNode(body.url);
          return {
            url: boundUrl,
            bound: true,
            matched: body.matched,
            ...(onNode(boundUrl) ? {headers} : {}),
          };
        }
      } catch (_e) {
        // not a binding answer — the asset itself is streaming back
      }
      // A cue -- any state but bgm -- exists only through a binding.  A
      // node that streams an asset here is answering from its generic
      // music cache: the prompt above is the same string for a cue as for
      // bgm, so the file coming back IS the background music.  Handing it
      // up would play it as the chime and cache it under the cue's key for
      // good (MEASURED 2026-09-22 against the live route).  A missing cue
      // is the game's own built-in sound, never the wrong one.
      if (state && state !== 'bgm') {
        return {};
      }
    }
    return {url, headers};
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

  // No node pre-generates by game id (media/pregenerate was never
  // implemented).  getCachedMusic's HEAD already starts generation for a
  // game's music, so there is nothing further to request.
  requestPregeneration: async () => ({skipped: true}),

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
