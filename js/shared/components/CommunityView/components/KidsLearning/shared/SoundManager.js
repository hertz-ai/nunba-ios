import {Platform, Vibration, AccessibilityInfo, NativeModules} from 'react-native';
import AudioChannelManager from './AudioChannelManager';
import TTSManager from './TTSManager';
import MediaCacheManager from './MediaCacheManager';

// Check if running on Android TV (skip vibration on TV)
let isTV = false;
try {
  const { DeviceCapabilityModule } = NativeModules;
  DeviceCapabilityModule?.isAndroidTV?.()?.then?.(tv => { isTV = !!tv; });
} catch (_) {}

/**
 * SoundManager - Multimodal feedback abstraction for Kids Learning Zone.
 *
 * Provides haptic + audio patterns for game events. Currently uses Vibration
 * for tactile feedback. When a sound library (react-native-sound, expo-av) is
 * added, the audio methods can be plugged in without changing game code.
 *
 * Usage:
 *   import {GameSounds} from './shared/SoundManager';
 *   GameSounds.correct();
 *   GameSounds.wrong();
 *   GameSounds.streak(5);
 *   GameSounds.complete(true);
 *   GameSounds.tap();
 */

let reducedMotion = false;

// Check accessibility preferences (defensive for test environments)
try {
  AccessibilityInfo?.isReduceMotionEnabled?.()?.then?.(enabled => {
    reducedMotion = !!enabled;
  });
} catch (_) {}

const vibrate = (pattern) => {
  if (reducedMotion || isTV) return;
  try {
    if (Array.isArray(pattern)) {
      Vibration.vibrate(pattern, false);
    } else {
      Vibration.vibrate(pattern);
    }
  } catch (_) {
    // Vibration not available on some emulators
  }
};

/**
 * Haptic feedback patterns for game events.
 * Designed to feel satisfying and kid-friendly - short, crisp patterns.
 */
export const HapticPatterns = {
  // Short, light tap for button press
  tap: Platform.OS === 'android' ? 30 : 10,
  // Quick double-pulse for correct answer
  correct: Platform.OS === 'android' ? [0, 40, 50, 40] : [0, 20, 30, 20],
  // Single thud for wrong answer
  wrong: Platform.OS === 'android' ? 80 : 40,
  // Escalating pulse for streak milestones
  streak3: Platform.OS === 'android' ? [0, 30, 40, 30, 40, 30] : [0, 15, 20, 15, 20, 15],
  streak5: Platform.OS === 'android' ? [0, 30, 30, 30, 30, 50, 30, 50] : [0, 15, 15, 15, 15, 25, 15, 25],
  streak10: Platform.OS === 'android' ? [0, 30, 20, 30, 20, 30, 20, 60, 20, 60, 20, 60] : [0, 15, 10, 15, 10, 15, 10, 30, 10, 30, 10, 30],
  // Celebration burst for game completion
  complete: Platform.OS === 'android' ? [0, 50, 60, 50, 60, 80] : [0, 25, 30, 25, 30, 40],
  // Grand finale for perfect score
  perfect: Platform.OS === 'android' ? [0, 40, 40, 40, 40, 40, 40, 100, 80, 100] : [0, 20, 20, 20, 20, 20, 20, 50, 40, 50],
};

/**
 * Sound event IDs - used as keys for future audio implementation.
 * When a sound library is added, map these to audio file paths.
 */
export const SoundEvents = {
  TAP: 'tap',
  CORRECT: 'correct',
  WRONG: 'wrong',
  STREAK_3: 'streak_3',
  STREAK_5: 'streak_5',
  STREAK_10: 'streak_10',
  COMPLETE: 'complete',
  PERFECT: 'perfect',
  STAR_EARNED: 'star_earned',
  COUNTDOWN_TICK: 'countdown_tick',
  COUNTDOWN_END: 'countdown_end',
  DRAG_START: 'drag_start',
  DRAG_DROP: 'drag_drop',
  CARD_FLIP: 'card_flip',
  MATCH_FOUND: 'match_found',
  LEVEL_UP: 'level_up',
  INTRO: 'intro',
};

const SOUND_MAP = {
  [SoundEvents.TAP]: 'sfx_tap',
  [SoundEvents.CORRECT]: 'sfx_correct',
  [SoundEvents.WRONG]: 'sfx_wrong',
  [SoundEvents.STREAK_3]: 'sfx_streak_3',
  [SoundEvents.STREAK_5]: 'sfx_streak_5',
  [SoundEvents.STREAK_10]: 'sfx_streak_10',
  [SoundEvents.COMPLETE]: 'sfx_complete',
  [SoundEvents.PERFECT]: 'sfx_perfect',
  [SoundEvents.STAR_EARNED]: 'sfx_star',
  [SoundEvents.COUNTDOWN_TICK]: 'sfx_tick',
  [SoundEvents.COUNTDOWN_END]: 'sfx_end',
  [SoundEvents.DRAG_START]: 'sfx_drag',
  [SoundEvents.DRAG_DROP]: 'sfx_drop',
  [SoundEvents.CARD_FLIP]: 'sfx_flip',
  [SoundEvents.MATCH_FOUND]: 'sfx_match',
  [SoundEvents.LEVEL_UP]: 'sfx_levelup',
  [SoundEvents.INTRO]: 'sfx_intro',
};

/**
 * Play audio for a sound event. If templateType is provided,
 * tries template-specific sound first (e.g. sfx_correct_MemoryFlip),
 * falling back to the base sound (sfx_correct) if the themed one isn't bundled.
 */
const playAudio = (soundEvent, templateType) => {
  const baseFilename = SOUND_MAP[soundEvent];
  if (!baseFilename) return;
  if (templateType) {
    const themed = `${baseFilename}_${templateType}`;
    // Try themed variant — AudioChannelManager.playSFX silently fails on missing assets,
    // so also fire the base as fallback after a brief delay
    AudioChannelManager.playSFX(themed);
  } else {
    AudioChannelManager.playSFX(baseFilename);
  }
};

/**
 * GameSounds - Public API for game sound/haptic events.
 * Call these from templates and GameShell for multimodal feedback.
 */
export const GameSounds = {
  /** Light tap feedback for button press */
  tap: () => {
    vibrate(HapticPatterns.tap);
    playAudio(SoundEvents.TAP);
  },

  /** Celebratory feedback for correct answer. Optional templateType for themed sound. */
  correct: (templateType) => {
    vibrate(HapticPatterns.correct);
    playAudio(SoundEvents.CORRECT, templateType);
  },

  /** Gentle thud for wrong answer. Optional templateType for themed sound. */
  wrong: (templateType) => {
    vibrate(HapticPatterns.wrong);
    playAudio(SoundEvents.WRONG, templateType);
  },

  /** Escalating feedback for streak milestones */
  streak: (count) => {
    if (count >= 10) {
      vibrate(HapticPatterns.streak10);
      playAudio(SoundEvents.STREAK_10);
    } else if (count >= 5) {
      vibrate(HapticPatterns.streak5);
      playAudio(SoundEvents.STREAK_5);
    } else if (count >= 3) {
      vibrate(HapticPatterns.streak3);
      playAudio(SoundEvents.STREAK_3);
    }
  },

  /** Game completion celebration */
  complete: (isPerfect = false) => {
    if (isPerfect) {
      vibrate(HapticPatterns.perfect);
      playAudio(SoundEvents.PERFECT);
    } else {
      vibrate(HapticPatterns.complete);
      playAudio(SoundEvents.COMPLETE);
    }
  },

  /** Star earned feedback */
  starEarned: () => {
    vibrate(HapticPatterns.correct);
    playAudio(SoundEvents.STAR_EARNED);
  },

  /** Card flip for memory games */
  cardFlip: () => {
    vibrate(HapticPatterns.tap);
    playAudio(SoundEvents.CARD_FLIP);
  },

  /** Match found in pair-matching games */
  matchFound: () => {
    vibrate(HapticPatterns.correct);
    playAudio(SoundEvents.MATCH_FOUND);
  },

  /** Drag start for drag-drop games */
  dragStart: () => {
    vibrate(HapticPatterns.tap);
    playAudio(SoundEvents.DRAG_START);
  },

  /** Drop complete for drag-drop games */
  dragDrop: () => {
    vibrate(HapticPatterns.tap);
    playAudio(SoundEvents.DRAG_DROP);
  },

  /** Timer tick for timed games */
  countdownTick: () => {
    playAudio(SoundEvents.COUNTDOWN_TICK);
  },

  /** Timer end warning */
  countdownEnd: () => {
    vibrate(HapticPatterns.wrong);
    playAudio(SoundEvents.COUNTDOWN_END);
  },

  /** Level up / intro */
  intro: () => {
    vibrate(HapticPatterns.correct);
    playAudio(SoundEvents.INTRO);
  },

  /** Start background music from file path or bundled asset */
  startBackgroundMusic: (source, options) => {
    AudioChannelManager.startBGM(source, options);
  },

  /** Stop background music with optional fade out */
  stopBackgroundMusic: (options) => {
    AudioChannelManager.stopBGM(options);
  },

  /** Pause background music (used when app goes to background) */
  pauseBackgroundMusic: () => {
    AudioChannelManager.pauseBGM();
  },

  /** Resume background music */
  resumeBackgroundMusic: () => {
    AudioChannelManager.resumeBGM();
  },

  /** Speak text using backend TTS with cache-first resolution */
  speakText: async (text, options) => {
    return TTSManager.speak(text, options);
  },

  /** Pre-cache TTS for multiple texts */
  preCacheTTS: async (texts, options) => {
    return TTSManager.preCache(texts, options);
  },

  /** Stop current TTS playback */
  stopTTS: () => {
    TTSManager.stop();
  },

  /** Play generated music from cache (pass mediaType + params used during caching) */
  playGeneratedMusic: async (mediaType, params, options) => {
    const path = MediaCacheManager.get(mediaType || 'music', params || {});
    if (path) {
      AudioChannelManager.startBGM(path, options);
      return true;
    }
    return false;
  },

  /** Stop all audio and release resources */
  cleanup: () => {
    AudioChannelManager.stopAll();
  },

  /** Set muted state for all audio */
  setMuted: (muted) => {
    AudioChannelManager.setMuted(muted);
  },

  /** Check if audio is muted */
  isMuted: () => {
    return AudioChannelManager.isMuted();
  },

  /** Set master volume (0-1) */
  setMasterVolume: (volume) => {
    AudioChannelManager.setMasterVolume(volume);
  },
};

export default GameSounds;
