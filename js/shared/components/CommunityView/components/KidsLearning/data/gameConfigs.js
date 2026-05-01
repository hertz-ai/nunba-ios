/**
 * Game Configurations - Composable Module Combiner
 *
 * Each category is isolated in its own module for:
 * 1. Clear separation of concerns
 * 2. Lazy loading by category
 * 3. Independent updates (server can push new configs per category)
 * 4. Easy testing in isolation
 *
 * 200+ pre-built games across 6 categories:
 * - English (30 base + 20 extra = 50 games)
 * - Math (30 base + 20 extra = 50 games)
 * - Life Skills (25 base + 15 extra = 40 games)
 * - Science & World (15 games)
 * - Creativity (5 base + 10 extra = 15 games)
 * - Voice/Interactive (15 games: balloon-pop, peekaboo, speech-bubble)
 */

import ENGLISH_GAMES from './configs/englishGames';
import ENGLISH_GAMES_EXTRA from './configs/englishGamesExtra';
import MATH_GAMES from './configs/mathGames';
import MATH_GAMES_EXTRA from './configs/mathGamesExtra';
import LIFE_SKILLS_GAMES from './configs/lifeSkillsGames';
import LIFE_SKILLS_GAMES_EXTRA from './configs/lifeSkillsGamesExtra';
import SCIENCE_CREATIVE_GAMES from './configs/scienceCreativeGames';
import CREATIVITY_GAMES from './configs/creativityGames';
import BALLOON_POP_GAMES from './configs/balloonPopGames';
import PEEKABOO_GAMES from './configs/peekabooGames';
import SPEECH_BUBBLE_GAMES from './configs/speechBubbleGames';

// Combined game configs — dedup by id (extras may contain ids already in base)
const _rawAll = [
  ...ENGLISH_GAMES,
  ...ENGLISH_GAMES_EXTRA,
  ...MATH_GAMES,
  ...MATH_GAMES_EXTRA,
  ...LIFE_SKILLS_GAMES,
  ...LIFE_SKILLS_GAMES_EXTRA,
  ...SCIENCE_CREATIVE_GAMES,
  ...CREATIVITY_GAMES,
  ...BALLOON_POP_GAMES,
  ...PEEKABOO_GAMES,
  ...SPEECH_BUBBLE_GAMES,
];
const _seenIds = new Set();
export const GAME_CONFIGS = _rawAll.filter(g => {
  if (_seenIds.has(g.id)) return false;
  _seenIds.add(g.id);
  return true;
});

// Category-specific exports for lazy loading
export { ENGLISH_GAMES, MATH_GAMES, LIFE_SKILLS_GAMES, SCIENCE_CREATIVE_GAMES, CREATIVITY_GAMES };

// Quick lookup by ID
const _gameMap = {};
GAME_CONFIGS.forEach(g => { _gameMap[g.id] = g; });
export const getGameById = (id) => _gameMap[id] || null;

// Filter by category
export const getGamesByCategory = (category) =>
  GAME_CONFIGS.filter(g => g.category === category);

// Filter by age
export const getGamesForAge = (age) =>
  GAME_CONFIGS.filter(g => age >= g.ageRange[0] && age <= g.ageRange[1]);

// Filter by difficulty
export const getGamesByDifficulty = (difficulty) =>
  GAME_CONFIGS.filter(g => g.difficulty === difficulty);

// Filter by template (useful for testing)
export const getGamesByTemplate = (template) =>
  GAME_CONFIGS.filter(g => g.template === template);

// Search games by title or tags
export const searchGames = (query) => {
  const q = query.toLowerCase();
  return GAME_CONFIGS.filter(g =>
    g.title.toLowerCase().includes(q) ||
    g.tags.some(t => t.toLowerCase().includes(q)) ||
    g.subcategory.toLowerCase().includes(q)
  );
};

// Get recommended games based on 3R intelligence data
export const getRecommendedGames = (intelligenceStore, category, age, limit = 6) => {
  const eligible = GAME_CONFIGS.filter(g =>
    (!category || g.category === category) &&
    age >= g.ageRange[0] && age <= g.ageRange[1]
  );

  if (!intelligenceStore) return eligible.slice(0, limit);

  // Score each game based on 3R data
  return eligible
    .map(game => {
      const concepts = game.learningObjectives || [];
      let score = 0;

      // Boost games with concepts due for retention review
      const dueForReview = intelligenceStore.getConceptsDueForReview?.(game.category) || [];
      concepts.forEach(c => {
        if (dueForReview.some(d => d.includes(c))) score += 3;
      });

      // Boost games covering weak concepts
      const weakConcepts = intelligenceStore.getWeakConcepts?.(game.category) || [];
      concepts.forEach(c => {
        if (weakConcepts.some(w => w.includes(c))) score += 2;
      });

      // Slight boost for unplayed games (registration)
      const summary = intelligenceStore.getThreeRSummary?.(game.category);
      if (summary && summary.registration < 50) score += 1;

      return { ...game, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
};

export default GAME_CONFIGS;
