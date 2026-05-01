import Sound from 'react-native-sound';

Sound.setCategory('Playback');

let isMuted = false;
let masterVolume = 1.0;

// Channel state
const bgmChannel = {
  sound: null,
  volume: 0.3,
  isPlaying: false,
  isPaused: false,
  fadeInterval: null,
};

const ttsChannel = {
  sound: null,
  volume: 0.7,
  isPlaying: false,
  bgmWasPaused: false,
};

// Max concurrent SFX to avoid resource exhaustion
const MAX_CONCURRENT_SFX = 4;
let activeSfxCount = 0;

const AudioChannelManager = {
  // Play SFX from bundled asset (fire-and-forget)
  playSFX: (filename) => {
    if (isMuted || activeSfxCount >= MAX_CONCURRENT_SFX) return;
    activeSfxCount++;
    const sound = new Sound(filename, Sound.MAIN_BUNDLE, (error) => {
      if (error) {
        activeSfxCount = Math.max(0, activeSfxCount - 1);
        return;
      }
      sound.setVolume(masterVolume);
      sound.play(() => {
        sound.release();
        activeSfxCount = Math.max(0, activeSfxCount - 1);
      });
    });
  },

  // Play SFX from cached file path
  playSFXFromPath: (filePath) => {
    if (isMuted || activeSfxCount >= MAX_CONCURRENT_SFX) return;
    activeSfxCount++;
    const sound = new Sound(filePath, '', (error) => {
      if (error) {
        activeSfxCount = Math.max(0, activeSfxCount - 1);
        return;
      }
      sound.setVolume(masterVolume);
      sound.play(() => {
        sound.release();
        activeSfxCount = Math.max(0, activeSfxCount - 1);
      });
    });
  },

  // Start background music with fade-in
  startBGM: (source, {loop = true, volume = 0.3, fadeInMs = 1000} = {}) => {
    // Stop current BGM if playing
    AudioChannelManager.stopBGM({fadeOutMs: 0});

    const isPath = typeof source === 'string' && (source.startsWith('/') || source.startsWith('file'));
    const basePath = isPath ? '' : Sound.MAIN_BUNDLE;

    const sound = new Sound(source, basePath, (error) => {
      if (error) return;

      bgmChannel.sound = sound;
      bgmChannel.volume = volume;
      bgmChannel.isPlaying = true;
      bgmChannel.isPaused = false;

      if (loop) {
        sound.setNumberOfLoops(-1);
      }

      if (isMuted) {
        sound.setVolume(0);
      } else if (fadeInMs > 0) {
        // Fade in
        sound.setVolume(0);
        const steps = 20;
        const stepMs = fadeInMs / steps;
        const targetVolume = volume * masterVolume;
        let currentStep = 0;

        bgmChannel.fadeInterval = setInterval(() => {
          currentStep++;
          const newVolume = (currentStep / steps) * targetVolume;
          sound.setVolume(Math.min(newVolume, targetVolume));
          if (currentStep >= steps) {
            clearInterval(bgmChannel.fadeInterval);
            bgmChannel.fadeInterval = null;
          }
        }, stepMs);
      } else {
        sound.setVolume(volume * masterVolume);
      }

      sound.play((success) => {
        if (!success && bgmChannel.sound === sound) {
          bgmChannel.isPlaying = false;
        }
      });
    });
  },

  // Stop BGM with fade-out
  stopBGM: ({fadeOutMs = 500} = {}) => {
    if (bgmChannel.fadeInterval) {
      clearInterval(bgmChannel.fadeInterval);
      bgmChannel.fadeInterval = null;
    }

    const sound = bgmChannel.sound;
    if (!sound) return;

    if (fadeOutMs > 0 && bgmChannel.isPlaying) {
      const steps = 20;
      const stepMs = fadeOutMs / steps;
      let currentStep = 0;
      const startVolume = bgmChannel.volume * masterVolume;

      bgmChannel.fadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = startVolume * (1 - currentStep / steps);
        sound.setVolume(Math.max(0, newVolume));
        if (currentStep >= steps) {
          clearInterval(bgmChannel.fadeInterval);
          bgmChannel.fadeInterval = null;
          sound.stop();
          sound.release();
          bgmChannel.sound = null;
          bgmChannel.isPlaying = false;
        }
      }, stepMs);
    } else {
      sound.stop();
      sound.release();
      bgmChannel.sound = null;
      bgmChannel.isPlaying = false;
      bgmChannel.isPaused = false;
    }
  },

  // Pause BGM (used when TTS plays)
  pauseBGM: () => {
    if (bgmChannel.sound && bgmChannel.isPlaying && !bgmChannel.isPaused) {
      bgmChannel.sound.pause();
      bgmChannel.isPaused = true;
    }
  },

  // Resume BGM
  resumeBGM: () => {
    if (bgmChannel.sound && bgmChannel.isPaused) {
      if (!isMuted) {
        bgmChannel.sound.setVolume(bgmChannel.volume * masterVolume);
      }
      bgmChannel.sound.play();
      bgmChannel.isPaused = false;
      bgmChannel.isPlaying = true;
    }
  },

  // Play TTS audio (auto-pauses BGM, resumes after)
  playTTS: (source, {onStart, onEnd} = {}) => {
    return new Promise((resolve) => {
      if (isMuted) {
        resolve(false);
        return;
      }

      // Stop current TTS if playing
      AudioChannelManager.stopTTS();

      // Pause BGM
      const wasBGMPlaying = bgmChannel.isPlaying && !bgmChannel.isPaused;
      if (wasBGMPlaying) {
        AudioChannelManager.pauseBGM();
      }
      ttsChannel.bgmWasPaused = wasBGMPlaying;

      const isPath = typeof source === 'string' && (source.startsWith('/') || source.startsWith('file'));
      const basePath = isPath ? '' : Sound.MAIN_BUNDLE;

      const sound = new Sound(source, basePath, (error) => {
        if (error) {
          if (ttsChannel.bgmWasPaused) AudioChannelManager.resumeBGM();
          resolve(false);
          return;
        }

        ttsChannel.sound = sound;
        ttsChannel.isPlaying = true;
        sound.setVolume(ttsChannel.volume * masterVolume);

        if (onStart) onStart();

        sound.play((success) => {
          sound.release();
          ttsChannel.sound = null;
          ttsChannel.isPlaying = false;

          if (ttsChannel.bgmWasPaused) {
            AudioChannelManager.resumeBGM();
            ttsChannel.bgmWasPaused = false;
          }

          if (onEnd) onEnd();
          resolve(success);
        });
      });
    });
  },

  // Stop TTS
  stopTTS: () => {
    if (ttsChannel.sound) {
      ttsChannel.sound.stop();
      ttsChannel.sound.release();
      ttsChannel.sound = null;
      ttsChannel.isPlaying = false;

      if (ttsChannel.bgmWasPaused) {
        AudioChannelManager.resumeBGM();
        ttsChannel.bgmWasPaused = false;
      }
    }
  },

  // Stop all audio
  stopAll: () => {
    AudioChannelManager.stopBGM({fadeOutMs: 0});
    AudioChannelManager.stopTTS();
    // Active SFX will finish naturally (fire-and-forget)
  },

  // Mute/unmute
  setMuted: (muted) => {
    isMuted = muted;
    if (bgmChannel.sound) {
      bgmChannel.sound.setVolume(muted ? 0 : bgmChannel.volume * masterVolume);
    }
    if (ttsChannel.sound) {
      ttsChannel.sound.setVolume(muted ? 0 : ttsChannel.volume * masterVolume);
    }
  },

  isMuted: () => isMuted,

  // Master volume (0-1)
  setMasterVolume: (volume) => {
    masterVolume = Math.max(0, Math.min(1, volume));
    if (bgmChannel.sound && !isMuted) {
      bgmChannel.sound.setVolume(bgmChannel.volume * masterVolume);
    }
    if (ttsChannel.sound && !isMuted) {
      ttsChannel.sound.setVolume(ttsChannel.volume * masterVolume);
    }
  },

  getMasterVolume: () => masterVolume,

  // Check if any audio is playing
  isPlaying: () => bgmChannel.isPlaying || ttsChannel.isPlaying,
  isBGMPlaying: () => bgmChannel.isPlaying,
  isTTSPlaying: () => ttsChannel.isPlaying,
};

export default AudioChannelManager;
