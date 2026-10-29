/**
 * The agent guiding a game with sound.
 *
 * An agent that plays a game with a child has to be able to sound it:
 * a cheer when they get it right, the game's own music under the turn,
 * a countdown tick while they think.  It does that on the reply it
 * already sends — the `dynamic_data` map the Liquid overlay reads
 * (Nunba routes/chatbot_routes.py _agent_reply) — so the guidance rides
 * the chat path the conversation already takes, with no second channel
 * and no polling.
 *
 * The game's own renderer accepts the same vocabulary over its bridge
 * (DynamicGameRenderer ALLOWED_SOUND_EVENTS), so an agent-led sound and a
 * game-led sound are the same sound.
 */
import GameSounds from './SoundManager';
import {resolveGameMusic} from './gameMusic';

/** What an agent may sound. Anything else is ignored, never played blind. */
export const AGENT_SOUND_EVENTS = new Set([
  'tap',
  'correct',
  'wrong',
  'streak',
  'complete',
  'starEarned',
  'cardFlip',
  'matchFound',
  'dragStart',
  'dragDrop',
  'countdownTick',
  'countdownEnd',
  'intro',
]);

/**
 * Play what the agent asked for in this reply.
 *
 * @param {object} dynamicData the reply's dynamic_data map
 * @param {object} game        {promptId, gameId, category, mood} in play, if any
 * @returns {Promise<object>}  what was done, for the caller to log or test
 */
export const playAgentGameSound = async (dynamicData, game = {}) => {
  const done = {sound: null, music: null, source: null};
  if (!dynamicData) {
    return done;
  }
  try {
    // A memo is keyed on (agent, game, state).  Without an agent and a
    // game there is nothing to look up: asking anyway would send a generic
    // key to the node and could start it composing a sound belonging to no
    // game, on a path that is a miss by definition.  The spec's bar is that
    // hits and misses are exact, so an unidentified game goes straight to
    // the game's own built-in cue.
    const identified = Boolean(game.promptId && game.gameId);

    const event = dynamicData.game_sound;
    if (event && AGENT_SOUND_EVENTS.has(event)) {
      // What the agent memoized for THIS state of THIS game, if anything.
      // The first time a state is reached the node has nothing yet and is
      // composing, so the game's own built-in sound plays and the memo
      // answers from the next time on.
      const memoized = !identified ? null : await resolveGameMusic({
        category: game.category,
        mood: game.mood,
        promptId: game.promptId,
        gameId: game.gameId,
        state: event,
        level: game.level,
      });
      if (memoized) {
        GameSounds.playCue
          ? GameSounds.playCue(memoized)
          : GameSounds.startBackgroundMusic(memoized, {loop: false, volume: 0.6});
        done.sound = event;
        done.source = 'memo';
      } else if (GameSounds[event]) {
        GameSounds[event]();
        done.sound = event;
        done.source = 'builtin';
      }
    }

    // The agent can also call for the game's music, which is the piece
    // bound to that game, never an arbitrary URL from a reply.
    if (dynamicData.game_music && identified) {
      const path = await resolveGameMusic({
        category: game.category,
        mood:
          typeof dynamicData.game_music === 'string'
            ? dynamicData.game_music
            : game.mood,
        promptId: game.promptId,
        gameId: game.gameId,
      });
      if (path) {
        GameSounds.startBackgroundMusic(path, {
          loop: true,
          fadeInMs: 1500,
          volume: 0.2,
        });
        done.music = path;
      }
    } else if (dynamicData.game_music === false) {
      GameSounds.stopBackgroundMusic({fadeOutMs: 500});
      done.music = 'stopped';
    }
  } catch (_e) {
    // guidance is sound, not control flow: a game keeps playing regardless
  }
  return done;
};

export default {AGENT_SOUND_EVENTS, playAgentGameSound};
