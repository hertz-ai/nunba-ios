/**
 * awesomeGames — shared helpers for the "awesome first" sort across
 * every games surface (KidsHub, GameHub, AllFeatures game tiles,
 * Recipes screen, etc.).
 *
 * "Awesome" = backed by a server-composed unique brief (see
 * services/kidsAssetGen + components/CommunityView/components/
 * KidsLearning/UniqueGameRenderer).  Template-backed legacy games
 * sort after, preserving their existing order.  A pinned "Surprise
 * me" tile gives a visible entry point to the awesome path even when
 * no brief-backed configs have been authored yet on the server.
 *
 * Keeping the predicate centralized prevents drift if we later widen
 * what counts as "awesome" (e.g., LiveKit-multiplayer games, AR
 * games).  Every list surface imports from here.
 */

export const SURPRISE_TILE_ID = '__surprise_awesome__';

/**
 * True for any game config that should sort to the top.
 */
export function isAwesomeGame(game) {
  if (!game) return false;
  if (game.id === SURPRISE_TILE_ID) return true;
  if (game.kind === 'unique-brief') return true;
  if (game.briefBacked === true) return true;
  if (game.isUnique === true) return true;
  if (game.uniqueBrief === true) return true;
  if (game.template === 'unique-brief') return true;
  if (game.brief && typeof game.brief === 'object' && game.brief.id) return true;
  return false;
}

/**
 * Stable sort that pulls awesome games to the front, preserving the
 * original order within each group.  Pure — does not mutate the input.
 */
export function sortAwesomeFirst(list) {
  if (!Array.isArray(list) || list.length <= 1) return Array.isArray(list) ? list : [];
  const awesome = [];
  const rest = [];
  for (const g of list) (isAwesomeGame(g) ? awesome : rest).push(g);
  return awesome.concat(rest);
}

/**
 * Synthetic "Surprise me" tile for the top of every games list.
 * Tapping it routes through KidsGameScreen which detects
 * `briefBacked && requestNewBrief` and composes a fresh brief before
 * mounting UniqueGameRenderer.  Theme/icon/copy are intentionally
 * generic so the renderer's composed character + palette become the
 * "look" of the game once it opens (avoids previewing one fixed art
 * style and re-introducing monotony at the list level).
 *
 * @param {Object} opts
 * @param {string} [opts.ageGroup='4-7']
 * @param {string} [opts.label='Surprise me — a fresh game just for you']
 * @param {string} [opts.audience='kids' | 'all']  // for GameHub tab matching
 */
export function makeSurpriseTile({ ageGroup = '4-7', label, audience = 'all' } = {}) {
  return {
    id: SURPRISE_TILE_ID,
    title: label || 'Surprise me!',
    subtitle: 'A fresh game just for you',
    category: 'all',
    audience,
    icon: 'auto-fix',
    difficulty: 1,
    estimatedMinutes: 3,
    ageRange: [3, 12],
    tags: ['awesome', 'surprise', 'unique'],
    kind: 'unique-brief',
    briefBacked: true,
    requestNewBrief: true,
    ageGroup,
    // The renderer composes everything else (palette, mascot, mechanic,
    // assets, BGM, art style) per launch, so two taps never produce the
    // same experience.
  };
}

export default { isAwesomeGame, sortAwesomeFirst, makeSurpriseTile, SURPRISE_TILE_ID };
