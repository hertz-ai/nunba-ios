/**
 * Game Recommendation Engine — Speech Therapy & Language Learning
 *
 * Analyzes user engagement patterns, speech performance, and learning gaps
 * to recommend optimal voice games. HARTOS agents trigger recommendations
 * when they detect low engagement or specific learning needs.
 *
 * Architecture:
 *   - Local-first: checks kidsIntelligenceStore + kidsLearningStore for on-device data
 *   - PeerLink compute: if local HARTOS available, asks agent for personalized recommendation
 *   - Cloud fallback: HARTOS cloud for complex analysis (multi-language, speech pathology patterns)
 *
 * Integration:
 *   - Fleet commands: agents send `game_recommendation` commands via fleet channel
 *   - Proactive: agents detect inactivity/struggle and push game suggestions
 *   - Reactive: user asks "what should I play?" → agent routes through this engine
 */

import useKidsIntelligenceStore from '../kidsIntelligenceStore';
import useKidsLearningStore from '../kidsLearningStore';
import { computeTarget } from './computePolicy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gameRec:history';
const ENGAGEMENT_THRESHOLD_MS = 3 * 60 * 1000; // 3 min without interaction = low engagement
const SPEECH_GAME_TYPES = [
  'voice_spell', 'sound_charades', 'whisper_shout', 'story_weaver',
  'beat_match', 'voice_paint', 'balloon_pop', 'peekaboo', 'speech_bubble',
];
const TOUCH_GAME_TYPES = [
  'memory_flip', 'drag_to_zone', 'match_pairs', 'word_build',
  'spot_difference', 'counting', 'sorting', 'story_builder',
];

// Speech therapy focus areas
const THERAPY_FOCUS = {
  articulation: ['voice_spell', 'balloon_pop', 'speech_bubble'],     // Pronunciation clarity
  fluency: ['story_weaver', 'beat_match', 'speech_bubble'],          // Smooth speech flow
  voice_control: ['whisper_shout', 'voice_paint', 'sound_charades'], // Volume modulation
  rhythm: ['beat_match', 'sound_charades', 'balloon_pop'],           // Timing and cadence
  comprehension: ['peekaboo', 'story_weaver', 'voice_spell'],        // Understanding + response
};

// Language learning progression
const LANGUAGE_LEVELS = {
  beginner: ['balloon_pop', 'voice_spell', 'peekaboo'],        // Single words, basic sounds
  intermediate: ['speech_bubble', 'story_weaver', 'sound_charades'], // Sentences, context
  advanced: ['story_weaver', 'beat_match', 'voice_paint'],     // Creative, complex
};

/**
 * Analyze engagement and recommend games.
 * Called by HARTOS agent or proactively by the app.
 */
export function getRecommendation(options = {}) {
  const {
    language = 'en',
    ageGroup = null,
    focusArea = null,    // 'articulation' | 'fluency' | 'voice_control' | 'rhythm' | 'comprehension'
    difficulty = null,
    preferVoice = true,  // Prefer voice games for speech therapy
  } = options;

  const intelligence = useKidsIntelligenceStore.getState();
  const learning = useKidsLearningStore.getState();
  const conceptMap = intelligence.conceptMap || {};
  const gameHistory = learning.gameHistory || [];

  // 1. Find weak areas from concept map
  const weakConcepts = Object.entries(conceptMap)
    .filter(([_, data]) => {
      const accuracy = data.correctCount / Math.max(data.totalAttempts, 1);
      return accuracy < 0.6 && data.totalAttempts >= 3;
    })
    .map(([key, data]) => ({
      concept: key,
      accuracy: data.correctCount / Math.max(data.totalAttempts, 1),
      category: key.split(':')[0],
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // 2. Find recently played games (avoid repetition)
  const recentGames = gameHistory.slice(-10).map(g => g.templateType);
  const recentSet = new Set(recentGames);

  // 3. Determine game pool based on focus
  let pool;
  if (focusArea && THERAPY_FOCUS[focusArea]) {
    pool = THERAPY_FOCUS[focusArea];
  } else if (preferVoice) {
    pool = SPEECH_GAME_TYPES;
  } else {
    pool = [...SPEECH_GAME_TYPES, ...TOUCH_GAME_TYPES];
  }

  // 4. Filter out recently played
  let candidates = pool.filter(g => !recentSet.has(g));
  if (candidates.length === 0) candidates = pool; // All played recently, allow repeats

  // 5. Score candidates based on weak areas
  const scored = candidates.map(gameType => {
    let score = 10; // base score

    // Boost if game targets weak concepts
    const weakCategories = weakConcepts.map(w => w.category);
    if (gameType.includes('spell') && weakCategories.includes('english')) score += 5;
    if (gameType.includes('charades') && weakCategories.includes('science')) score += 3;
    if (gameType.includes('beat') && weakCategories.includes('math')) score += 3;

    // Boost voice games for speech therapy goal
    if (SPEECH_GAME_TYPES.includes(gameType) && preferVoice) score += 4;

    // Novelty bonus (not played recently)
    if (!recentSet.has(gameType)) score += 3;

    // Age-appropriate adjustments
    if (ageGroup === '3-6' || ageGroup === 'early') {
      if (['balloon_pop', 'peekaboo', 'sound_charades'].includes(gameType)) score += 3;
      if (['story_weaver', 'voice_paint'].includes(gameType)) score -= 2;
    } else if (ageGroup === '7-10') {
      if (['story_weaver', 'speech_bubble', 'beat_match'].includes(gameType)) score += 3;
    }

    return { gameType, score };
  });

  // 6. Sort by score and return top 3
  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);

  return {
    recommendations: top3.map(r => ({
      gameType: r.gameType,
      score: r.score,
      reason: getRecommendationReason(r.gameType, weakConcepts, focusArea),
    })),
    weakAreas: weakConcepts.slice(0, 5),
    engagementLevel: getEngagementLevel(gameHistory),
    suggestedFocus: focusArea || inferFocusArea(weakConcepts, gameHistory),
  };
}

/**
 * Generate a human-readable reason for the recommendation.
 */
function getRecommendationReason(gameType, weakConcepts, focusArea) {
  const reasons = {
    voice_spell: 'Practice spelling words out loud to improve pronunciation',
    sound_charades: 'Make fun sounds to build voice expressiveness',
    whisper_shout: 'Learn to control your voice volume — whisper and shout!',
    story_weaver: 'Create stories together to build fluency and creativity',
    beat_match: 'Clap along to rhythms to improve speech timing',
    voice_paint: 'Draw with your voice — volume controls the brush!',
    balloon_pop: 'Say words to pop balloons — great for articulation practice',
    peekaboo: 'Find the hiding character using your voice — speak to peek!',
    speech_bubble: 'Catch letters with different voice volumes to spell words',
  };
  if (focusArea) {
    return `${reasons[gameType] || 'Try this fun game!'} (Focus: ${focusArea})`;
  }
  return reasons[gameType] || 'A fun voice-activated game just for you!';
}

/**
 * Determine engagement level from game history.
 */
function getEngagementLevel(gameHistory) {
  if (!gameHistory || gameHistory.length === 0) return 'new_user';
  const now = Date.now();
  const recent = gameHistory.filter(g => now - (g.completedAt || 0) < 24 * 60 * 60 * 1000);
  if (recent.length === 0) return 'inactive';
  if (recent.length < 3) return 'low';
  if (recent.length < 8) return 'medium';
  return 'high';
}

/**
 * Infer which speech therapy focus area needs attention.
 */
function inferFocusArea(weakConcepts, gameHistory) {
  // If user struggles with spelling → articulation
  const weakCategories = weakConcepts.map(w => w.category);
  if (weakCategories.includes('english') || weakCategories.includes('eng')) return 'articulation';
  if (weakCategories.includes('math')) return 'rhythm';
  if (weakCategories.includes('science')) return 'comprehension';
  // Default: voice control (fun for everyone)
  return 'voice_control';
}

/**
 * Handle agent-triggered game recommendation.
 * Called when a HARTOS agent detects low engagement and wants to suggest a game.
 *
 * @param {object} command - Fleet command from agent
 *   { type: 'game_recommendation', language: 'en', focusArea: 'articulation', message: '...' }
 * @returns {object} recommendation result
 */
export function handleAgentGameRecommendation(command) {
  return getRecommendation({
    language: command.language || 'en',
    focusArea: command.focusArea || null,
    ageGroup: command.ageGroup || null,
    preferVoice: command.preferVoice !== false,
  });
}

/**
 * Check if user needs a proactive game suggestion.
 * Call this periodically (e.g., every 30s from App.js or fleet handler).
 */
export function shouldSuggestGame() {
  const learning = useKidsLearningStore.getState();
  const history = learning.gameHistory || [];
  const level = getEngagementLevel(history);
  return level === 'inactive' || level === 'low' || level === 'new_user';
}

/**
 * Persist recommendation history for agent learning.
 */
export async function recordRecommendationOutcome(gameType, accepted, completed, score) {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const history = stored ? JSON.parse(stored) : [];
    history.push({
      gameType,
      accepted,
      completed,
      score,
      timestamp: Date.now(),
    });
    // Keep last 100 entries
    if (history.length > 100) history.splice(0, history.length - 100);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (_) {}
}

export default {
  getRecommendation,
  handleAgentGameRecommendation,
  shouldSuggestGame,
  recordRecommendationOutcome,
  SPEECH_GAME_TYPES,
  THERAPY_FOCUS,
  LANGUAGE_LEVELS,
};
