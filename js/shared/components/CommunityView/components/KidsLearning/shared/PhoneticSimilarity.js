/**
 * PhoneticSimilarity — kid-tolerant compare for the repeat-tts and
 * sing-summon mechanics inside UniqueGameRenderer.
 *
 * Normalizes punctuation/whitespace, applies a small kid-mispronunciation
 * rewrite table ("wabbit"→"rabbit", "wery"→"very"), then scores with a
 * Levenshtein-based ratio.  Returns 0..1; >= 0.7 is "close enough" for
 * the Speech Companion's no-shame UX (per goal_seeding.py:1479,
 * banned words: "Wrong", "almost", "not quite").
 */

const KID_REWRITES = [
  [/\bwabbit\b/gi, 'rabbit'],
  [/\bwed\b/gi, 'red'],
  [/\bwery\b/gi, 'very'],
  [/\bwight\b/gi, 'right'],
  [/\btheam\b/gi, 'team'],
  [/\bfwog\b/gi, 'frog'],
  [/\bfwiend\b/gi, 'friend'],
  [/\btwee\b/gi, 'tree'],
  [/\bblue\b/gi, 'blue'],
  [/\bplease\b/gi, 'please'],
  [/\bbanan(a|er)\b/gi, 'banana'],
];

export function normalize(text) {
  if (typeof text !== 'string') return '';
  let t = text.toLowerCase().trim();
  for (const [re, sub] of KID_REWRITES) t = t.replace(re, sub);
  t = t.replace(/[\p{P}\p{S}]/gu, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = cur[j];
  }
  return prev[b.length];
}

/**
 * Return a 0..1 similarity score between a target phrase and a
 * heard-from-STT phrase.  1.0 = exact (after normalize), 0 = unrelated.
 */
export function similarity(target, heard) {
  const a = normalize(target);
  const b = normalize(heard);
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const charScore = 1 - dist / maxLen;
  const targetTokens = new Set(a.split(' '));
  const heardTokens = new Set(b.split(' '));
  // For single-word targets the token-set test is meaningless (one
  // typo'd character would yank the score down to 0.5 even though the
  // child clearly got it).  The repeat-tts mechanic shows individual
  // word prompts almost exclusively, so fall back to char-only score
  // when the target is one token.
  if (targetTokens.size <= 1) return Math.max(0, Math.min(1, charScore));
  let hit = 0;
  for (const tok of targetTokens) if (heardTokens.has(tok)) hit += 1;
  const tokenScore = hit / targetTokens.size;
  return Math.max(0, Math.min(1, 0.6 * charScore + 0.4 * tokenScore));
}

/**
 * Per the Speech Companion invariants, the UI should NEVER tell the
 * child "wrong" or "almost".  Map every similarity score to a positive
 * encouragement label.
 */
export function encouragement(score) {
  if (score >= 0.9) return 'Yes! You got it!';
  if (score >= 0.7) return 'Nice try — let\'s keep going!';
  if (score >= 0.4) return 'Cool! Tell me one more time?';
  return 'Your turn — give it another go!';
}

export default { normalize, similarity, encouragement };
