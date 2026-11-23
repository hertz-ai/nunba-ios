/**
 * A game's music: the one way the app gets it.
 *
 * The node composes it through the single media capability its agents
 * hold (routes/kids_media_routes.py delegates to
 * integrations/service_tools/media_agent.generate_media), so the music a
 * game plays here is the same asset the agent composes for that game in
 * CREATE and binds to it in REUSE.
 *
 * Measured 2026-09-21: nothing in the app asked for a game's music at
 * all, and the only lookup passed a single string key to
 * MediaCacheManager.get, which takes (mediaType, params) — so it could
 * never hit even if something had filled it.  Every game played silence.
 */
import MediaCacheManager from './MediaCacheManager';
import {kidsMediaApi} from '../../../../../services/kidsMediaApi';

/** The cache identity of a game's music. Same shape as the node's prompt. */
export const musicParams = ({category, mood, promptId, gameId, state, level} = {}) => ({
  category: category || 'general',
  mood: mood || 'happy',
  // The state the game is in.  A game's sound is memoized per state, so
  // the cache has to key on it too, or a cheer would be cached as the
  // game's music (HARTOS docs/internal/GAME_SOUND_MEMOIZATION_SPEC.md).
  state: state || 'bgm',
  ...(level ? {level: String(level)} : {}),
  // The agent and the game, when this game is played under an agent: the
  // node then answers with what that agent memoized for this state rather
  // than composing a new one, so a reuse sounds like the review.
  ...(promptId && gameId ? {promptId: String(promptId), gameId: String(gameId)} : {}),
});

/**
 * The local path of this game's music, or null.
 *
 * A cache hit answers at once.  On a miss the node is asked: it answers
 * with the asset when it already has one, or 202 while its capability
 * composes, and the next launch of this game finds it cached.  Never
 * throws: music is decoration, and a game must start without it.
 */
export const resolveGameMusic = async (params) => {
  const key = musicParams(params);
  try {
    const cached = MediaCacheManager.get('music', key);
    if (cached) {
      return cached;
    }
    const answer = await kidsMediaApi.getCachedMusic(key);
    if (answer && answer.url) {
      return await MediaCacheManager.download('music', key, answer.url, {
        headers: answer.headers,
      });
    }
  } catch (_e) {
    // a node that cannot compose leaves the game silent, not broken
  }
  return null;
};

export default {musicParams, resolveGameMusic};
