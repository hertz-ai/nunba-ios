/**
 * kidsAssetGen — unique-brief composer for the no-monotony kid-games path.
 *
 * Architecture (see memory: kids-unique-brief-architecture):
 *
 *   1. Catalog: seed bundled at assets/kids/catalog.json (~80 entries,
 *      18 categories, 7 art_styles).
 *
 *   2. Compose: briefs are composed on-device from that catalog.  The
 *      server compose/catalog paths this used to call (media/games/compose,
 *      media/assets/catalog) were never implemented on any node — 404 on
 *      local Nunba, "no Route matched" on central — so every call already
 *      fell through to this composer.  Sprites come from Nunba's existing
 *      image route (/api/media/asset?type=image).
 *
 *   3. Novelty guard: client refuses to render a brief whose
 *      (mechanic, palette_id, art_style, character_id) tuple appears
 *      in the last 50 played briefs; re-rolls once before falling back
 *      to a locally-composed brief from the bundled catalog.
 *
 * No template, no shared layout, no palette reuse within window 50 —
 * every game is structurally different by construction.
 */

import { getApiBaseUrl } from './endpointResolver';
import CATALOG from '../assets/kids/catalog.json';

// Nunba's existing kids media route (routes/kids_media_routes.py).
const ASSET_PATH = 'api/media/asset';
const NOVELTY_WINDOW = 50;

// Kid art styles -> the three styles that route renders.  Anything else it
// silently turns into cartoon; say so here instead of relying on that.
const SERVER_IMAGE_STYLE = Object.freeze({ photo: 'realistic', painterly: 'watercolor' });

export const ART_STYLES = Object.freeze([
  'photo', 'vector', 'pixel', 'minecraft', 'clay', 'origami', 'painterly',
]);

export const briefSignature = (brief) => {
  if (!brief) return '';
  const palId = brief.palette?.id || (brief.palette?.colors || []).slice(0, 2).join('_');
  const charId = brief.character?.id || brief.character?.name || '';
  return [brief.mechanic, brief.art_style, palId, charId].join('|');
};

const _pickN = (arr, n, rng = Math.random) => {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const pool = arr.slice();
  const out = [];
  while (out.length < Math.min(n, pool.length)) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
};

const _seededRng = (seed) => {
  let s = (typeof seed === 'string' ? seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : seed) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

/**
 * The kids asset catalog.  No node serves one, so the bundled seed is it.
 */
export async function getCatalog() {
  return CATALOG;
}

/**
 * Render-time URL for an asset in a specific style, from Nunba's image route.
 * That route is keyed by prompt text, so the asset is addressed by NAME (an
 * id like "apple_1" would be drawn literally).  It answers 503
 * {fallback:'emoji'} when it can't generate, and the renderer already falls
 * back to the asset's emoji on a failed image.
 *
 * @param {object|string} asset  catalog asset (uses .name, then .id) or a name
 * @param {string} style         one of ART_STYLES
 */
export async function spriteUrl(asset, style) {
  try {
    const prompt = typeof asset === 'string' ? asset : (asset && (asset.name || asset.id)) || '';
    if (!prompt) return null;
    const base = await getApiBaseUrl();
    const serverStyle = SERVER_IMAGE_STYLE[style] || 'cartoon';
    return `${base}/${ASSET_PATH}?type=image&prompt=${encodeURIComponent(prompt)}&style=${serverStyle}`;
  } catch (_) {
    return null;
  }
}

/**
 * Locally compose a brief from the catalog as an offline-safe fallback
 * for when no server (local Nunba or central) is reachable. Output
 * shape is identical to the server response so the renderer doesn't
 * care which path produced it.
 */
function _composeLocally(catalog, { ageGroup = '4-7', recentSignatures = [], theme, seed }) {
  const rng = _seededRng(seed || `${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
  const ageOk = (m) => !Array.isArray(m.ages) || m.ages.includes(ageGroup) || m.ages.some(a => a === ageGroup);

  const seenSet = new Set(recentSignatures);
  let attempt = 0;
  let brief = null;
  while (attempt < 8) {
    attempt += 1;
    const mechanic = _pickN(catalog.mechanics.filter(ageOk), 1, rng)[0] || catalog.mechanics[0];
    const palette = _pickN(catalog.palettes, 1, rng)[0];
    const art_style = ART_STYLES[Math.floor(rng() * ART_STYLES.length)];
    const character = _pickN(catalog.characters, 1, rng)[0];
    const category = (() => {
      if (theme) return catalog.categories.find(c => c.id === theme) || catalog.categories[Math.floor(rng() * catalog.categories.length)];
      return catalog.categories[Math.floor(rng() * catalog.categories.length)];
    })();

    const eligibleAssets = catalog.assets.filter(a => a.category === category.id && a.art_styles.includes(art_style));
    const assets = _pickN(
      eligibleAssets.length >= 6 ? eligibleAssets : catalog.assets.filter(a => a.category === category.id),
      Math.min(8, Math.max(6, eligibleAssets.length || 6)),
      rng,
    );

    brief = {
      id: `brief_${Date.now().toString(36)}_${Math.floor(rng() * 1e6).toString(36)}`,
      source: 'local-fallback',
      theme: category.name,
      category: category.id,
      mechanic: mechanic.id,
      mechanic_name: mechanic.name,
      art_style,
      palette: { id: palette.id, colors: palette.colors },
      character: { id: character.id, name: character.name, emoji: character.emoji, vibe: character.vibe },
      bgm: { mood: character.vibe || 'happy', duration: 60 },
      assets: assets.map(a => ({
        id: a.id, name: a.name, emoji: a.emoji,
        art_style: a.art_styles.includes(art_style) ? art_style : a.art_styles[0],
        palette: a.palette || [],
        tags: a.tags || [],
      })),
      objective: `Help ${character.name} with the ${category.name.toLowerCase()}`,
      instructions_tts: `${character.name} says: let's play with ${category.name.toLowerCase()}!`,
      stage: { timer_sec: null, win_condition: 'all_correct' },
      reward: { animation: 'firework', sfx: 'jingle', tts: 'You did it!' },
    };
    if (!seenSet.has(briefSignature(brief))) return brief;
  }
  return brief;
}

/**
 * Compose a unique game brief from the bundled catalog, honouring the
 * novelty window.  Composed on-device: the server compose it used to try
 * first (media/games/compose) was never implemented on any node, so that
 * round trip always failed before landing here anyway.
 *
 * @param {Object} opts
 * @param {string} [opts.ageGroup='4-7']
 * @param {string[]} [opts.recentSignatures=[]]  // from kidsLearningStore
 * @param {string}  [opts.theme]                 // category id hint
 * @param {string}  [opts.seed]                  // for deterministic testing
 * @returns {Promise<{brief:object, source:'local'}>}
 */
export async function composeUniqueBrief(opts = {}) {
  const { ageGroup = '4-7', recentSignatures = [], theme, seed } = opts;
  const catalog = await getCatalog();
  const brief = _composeLocally(catalog, {
    ageGroup, recentSignatures: recentSignatures.slice(-NOVELTY_WINDOW), theme, seed,
  });
  return { brief, source: 'local' };
}

export default {
  ART_STYLES,
  briefSignature,
  getCatalog,
  spriteUrl,
  composeUniqueBrief,
};
