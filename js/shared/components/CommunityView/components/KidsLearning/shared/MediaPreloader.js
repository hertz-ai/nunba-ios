import {kidsMediaApi} from '../../../../../services/kidsMediaApi';
import MediaCacheManager from './MediaCacheManager';
import TTSManager from './TTSManager';

/**
 * MediaPreloader - Pre-generation orchestrator for Kids Learning Zone.
 *
 * Triggers pre-caching of media (TTS, music, video) in advance so that
 * content is ready when the user enters a game. All operations are
 * fire-and-forget — failures are silently ignored.
 */
const MediaPreloader = {
  /**
   * Pre-load media for upcoming games (called from KidsHub when online).
   * Priority: TTS (fast/small) > Music > Video
   */
  preloadForUpcomingGames: async (games, ageGroup) => {
    if (!Array.isArray(games) || games.length === 0) return;

    const ttsPromises = [];
    const musicPromises = [];

    for (const game of games) {
      // Pre-cache TTS for game intro
      if (game.title) {
        const introText = `Let's play ${game.title}!`;
        ttsPromises.push(
          TTSManager.preCache([introText]).catch(() => {}),
        );
      }

      // Pre-cache category BGM
      const musicParams = {
        category: game.category || 'general',
        mood: 'happy',
        duration: 60,
      };
      musicPromises.push(
        (async () => {
          try {
            if (MediaCacheManager.has('music', musicParams)) return;

            const result = await kidsMediaApi.getCachedMusic(musicParams);

            if (result?.url) {
              await MediaCacheManager.download('music', musicParams, result.url);
            }
          } catch (_) {
            // Silent fail - pre-loading is best-effort
          }
        })(),
      );
    }

    // TTS first (fast), then music (larger)
    await Promise.allSettled(ttsPromises);
    await Promise.allSettled(musicPromises);
  },

  /**
   * Pre-load media for a specific game about to be played.
   */
  preloadForGame: async (gameConfig) => {
    if (!gameConfig) return;

    const promises = [];

    // Intro TTS
    if (gameConfig.title) {
      promises.push(
        TTSManager.preCache([`Let's play ${gameConfig.title}!`]).catch(() => {}),
      );
    }

    // Category BGM
    const musicParams = {
      category: gameConfig.category || 'general',
      mood: 'happy',
      duration: 60,
    };
    promises.push(
      (async () => {
        try {
          if (MediaCacheManager.has('music', musicParams)) return;
          const result = await kidsMediaApi.getCachedMusic(musicParams);
          if (result?.url) {
            await MediaCacheManager.download('music', musicParams, result.url);
          }
        } catch (_) {}
      })(),
    );

    // Story scene TTS pre-cache
    if (gameConfig.template === 'story-builder' && gameConfig.content?.story?.scenes) {
      const sceneTexts = Object.values(gameConfig.content.story.scenes)
        .map(s => s.text)
        .filter(Boolean);
      if (sceneTexts.length > 0) {
        promises.push(TTSManager.preCache(sceneTexts).catch(() => {}));
      }
    }

    // Request server-side pre-generation
    promises.push(
      kidsMediaApi.requestPregeneration({
        gameIds: [gameConfig.id],
        mediaTypes: ['tts', 'music'],
      }).catch(() => {}),
    );

    await Promise.allSettled(promises);
  },

  /**
   * Check what pre-loaded media is available for a game.
   */
  getPreloadStatus: async (gameConfig) => {
    if (!gameConfig) return {sfxReady: true, bgmReady: false, ttsReady: false};

    const musicParams = {
      category: gameConfig.category || 'general',
      mood: 'happy',
      duration: 60,
    };
    let bgmReady = false;
    try {
      bgmReady = MediaCacheManager.has('music', musicParams);
    } catch (_) {}

    return {
      sfxReady: true, // Bundled SFX always available
      bgmReady,
      ttsReady: false, // Would need to check each text
    };
  },
};

export default MediaPreloader;
