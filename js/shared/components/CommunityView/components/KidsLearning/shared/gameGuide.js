/**
 * gameGuide — what the agent says at each step of a kids game, and when a
 * game gets easier or harder.  Design: docs/KIDS_AGENT_GUIDED_GAMES_DESIGN.md.
 *
 * PURE JavaScript: no React, no React Native, no I/O.  The same file is meant
 * to serve the web and Nunba game trees unchanged (one canonical design,
 * owner ruling 2026-09-16); only the adapter that SPEAKS and PLAYS lives per
 * platform (RN: GameShell).
 *
 * The bar it serves is the owner's Number Meadow (2026-09-23): the question is
 * spoken, a wrong answer is explained from what the child actually chose, a
 * right answer states the idea, and the answer teaches.
 */

// ── Step kinds ───────────────────────────────────────────────────────────
export const STEP = Object.freeze({
  ASKED: 'asked',
  WRONG: 'wrong',
  RIGHT: 'right',
  // an action that is neither right nor wrong (a card turned over): its own
  // cue, and it never moves the ladder
  TOUCH: 'touch',
});

// ── Level ladder: one rule for every game ────────────────────────────────
// Up after three right in a row, down after three misses in a row.  Level 0
// is the most help a template can give; each template maps a level onto its
// own knobs.  Six templates had their own ladders; this replaces them.
export const LEVEL = Object.freeze({MIN: 0, START: 1, MAX: 3, UP_AFTER: 3, DOWN_AFTER: 3});

export const initialLadder = () => ({level: LEVEL.START, rightRun: 0, wrongRun: 0});

/**
 * The ladder after one answer.  `changed` is 'up', 'down' or null.
 */
export const climb = (ladder, isRight) => {
  const rightRun = isRight ? ladder.rightRun + 1 : 0;
  const wrongRun = isRight ? 0 : ladder.wrongRun + 1;
  if (rightRun >= LEVEL.UP_AFTER && ladder.level < LEVEL.MAX) {
    return {level: ladder.level + 1, rightRun: 0, wrongRun: 0, changed: 'up'};
  }
  if (wrongRun >= LEVEL.DOWN_AFTER && ladder.level > LEVEL.MIN) {
    return {level: ladder.level - 1, rightRun: 0, wrongRun: 0, changed: 'down'};
  }
  return {level: ladder.level, rightRun, wrongRun, changed: null};
};

/**
 * Which game sound a step plays: the state names the agent memoizes sounds
 * under (HARTOS core/game_sound_memo GAME_STATES), so a bound sound and a
 * built-in one answer to the same name.
 */
export const cueFor = (kind, {rightRun = 0, changed = null} = {}, ownCue) => {
  if (kind === STEP.TOUCH) return ownCue || null;
  if (kind === STEP.WRONG) return 'wrong';
  if (kind !== STEP.RIGHT) return null;
  if (changed === 'up') return 'starEarned';
  if (rightRun >= 3) return 'streak';
  // a template's own right-answer sound (match-pairs: matchFound), when it has one
  return ownCue || 'correct';
};

// ── Words ────────────────────────────────────────────────────────────────
const plural = (label, n) => {
  const word = String(label || 'things');
  if (n === 1 && word.endsWith('s')) return word.slice(0, -1);
  return word;
};

const countAloud = (n) => Array.from({length: n}, (_, i) => String(i + 1)).join(', ');

// ── Per-template lines ───────────────────────────────────────────────────
// Each template gets: ask(item) -> line; explainMiss(chosen, item) -> line
// built from what the child did; right(item) -> line that states the idea.

// Counting labels come in three shapes in the catalogue (all read 2026-09-23):
//   a thing to count        "apples", "times you helped today"
//   a clap-the-syllables    "ap-ple (2 claps)" -- the parenthesis is the
//                           ANSWER, so it is never read out
//   a whole question        "Count by 2s: How many pairs?"
const CLAPS = /^(.+?)\s*\((\d+)\s*claps?\)\s*$/i;
const shapeOf = (round) => {
  const label = String(round.label || 'things').trim();
  const clap = label.match(CLAPS);
  if (clap) {
    const syllables = clap[1].trim();
    return {kind: 'claps', word: syllables.replace(/-/g, ''), syllables: syllables.split('-')};
  }
  if (/\?\s*$/.test(label)) return {kind: 'question', question: label};
  return {kind: 'things', what: label};
};

export const counting = {
  // The question printed over the objects.  A clap round's label carries its
  // answer ("ap-ple (2 claps)") and a skip-count label is already a question,
  // so neither can be dropped into "How many ... can you count?".
  title: (round) => {
    const s = shapeOf(round);
    if (s.kind === 'claps') return `How many claps in ${s.word}?`;
    if (s.kind === 'question') return s.question;
    return `How many ${round.label || 'items'} can you count?`;
  },

  ask: (round) => {
    const s = shapeOf(round);
    if (s.kind === 'claps') return `How many claps in ${s.word}? Say it and clap with me.`;
    if (s.kind === 'question') return s.question;
    return `How many ${plural(s.what, 2)} can you see? Touch each one as you count.`;
  },

  explainMiss: (chosen, round) => {
    const want = Number(round.count);
    const got = Number(chosen);
    const s = shapeOf(round);
    if (!Number.isFinite(got)) return "Let's count together, one at a time.";
    const fewer = got > want;
    if (s.kind === 'claps') {
      return `You said ${got}. ${s.word} has ${fewer ? 'fewer' : 'more'} claps than that. Clap it again, slowly.`;
    }
    if (s.kind === 'question') {
      return `You said ${got}. That is ${fewer ? 'more' : 'less'} than there are. Count again, one at a time.`;
    }
    const what = plural(s.what, want);
    return fewer
      ? `You said ${got}. There are fewer ${what} than that. Count again, touching each one once.`
      : `You said ${got}. There are more ${what} than that. Count again, and don't skip any.`;
  },

  // The teaching moment: the objects are counted aloud (the template shows a
  // number on each one while this is said).
  right: (round) => {
    const n = Number(round.count);
    const s = shapeOf(round);
    if (s.kind === 'claps') return `Yes! ${s.syllables.join(', ')}. ${s.word} has ${n} ${n === 1 ? 'clap' : 'claps'}!`;
    if (s.kind === 'question') return `Yes! ${countAloud(n)}. ${n}!`;
    return `Yes! ${countAloud(n)}. ${n} ${plural(s.what, n)}!`;
  },
};

const spell = (word) => String(word || '').toUpperCase().split('').join(', ');

export const wordBuild = {
  ask: (item) => {
    const word = String(item.word || '');
    return item.hint
      ? `Let's spell ${word.toLowerCase()}. ${item.hint}`
      : `Let's spell ${word.toLowerCase()}. Find the first letter, ${word[0] || ''}.`;
  },

  // `chosen` is the letter tapped, `position` where it was tried.
  explainMiss: (chosen, item, position = 0) => {
    const word = String(item.word || '').toUpperCase();
    const wanted = word[position] || '';
    const got = String(chosen || '').toUpperCase();
    if (!got) return `Find the letter ${wanted}.`;
    return `That's ${got}. We need ${wanted} next. Find the letter ${wanted}.`;
  },

  // A letter landed in the right place: say it, and the next one to find.
  letter: (item, position) => {
    const word = String(item.word || '').toUpperCase();
    const next = word[position + 1];
    return next ? `${word[position]}. Now find ${next}.` : `${word[position]}.`;
  },

  // The teaching moment: letters spoken, then the whole word.
  right: (item) => {
    const word = String(item.word || '');
    return `${spell(word)}. ${word.toLowerCase()}! You spelled ${word.toLowerCase()}!`;
  },
};

// A question written as a sum to finish ("3 + 4 = ?") is read as a question,
// and answered as the finished sum.
const SUM_BLANK = /\s*=\s*\?\s*$/;

export const multipleChoice = {
  ask: (q) => {
    const text = String(q.question || '');
    return SUM_BLANK.test(text) ? `What is ${text.replace(SUM_BLANK, '')}?` : text;
  },

  // The config's hint is the WHY; the child's own choice comes first.
  explainMiss: (chosen, q) => {
    const why = q.hint ? ` ${q.hint}.` : '';
    return `You chose ${chosen}.${why} Try another one.`.replace('..', '.');
  },

  right: (q) => {
    const answer = (q.options || [])[q.correctIndex];
    const text = String(q.question || '');
    return SUM_BLANK.test(text)
      ? `Yes! ${text.replace(SUM_BLANK, '')} is ${answer}.`
      : `Yes! ${answer}.`;
  },
};

const lower = (t) => String(t == null ? '' : t).toLowerCase();

export const sequenceOrder = {
  ask: () => 'Put these in order. What comes first?',

  // `position` is the slot being filled.  The nudge says which way the pick
  // is off and asks for the next step; it does not give the answer away.
  explainMiss: (chosen, seq, position = 0) => {
    const items = (seq.items || []).map(String);
    const after = position > 0 ? `What comes after ${lower(items[position - 1])}?` : 'What comes first?';
    const at = items.indexOf(String(chosen), position);
    if (at > position) return `${chosen} comes later. ${after}`;
    return `Not ${lower(chosen)} yet. ${after}`;
  },

  next: (item) => `${item}. What comes next?`,

  // The teaching moment: the whole order, read back.
  right: (seq) => `Yes! ${(seq.items || []).map(String).map((t, i) => (i ? lower(t) : t)).join(', then ')}.`,
};

export const matchPairs = {
  ask: () => 'Find the pairs that go together. Tap one, then its partner.',

  explainMiss: (left, right) => `${left} and ${right} don't go together. What goes with ${left}?`,

  // The pair named together: the teaching moment.
  right: (left, right) => `Yes! ${left} goes with ${right}.`,
};

const either = (names) => {
  const list = names.map((n) => lower(n)).filter(Boolean);
  return list.length <= 1 ? (list[0] || '') : `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
};

export const dragToZone = {
  ask: (zones = []) => `Drag each one to where it belongs: ${either(zones.map((z) => z.label))}.`,

  // Says where it was dropped, not where it goes: the child finds that.
  explainMiss: (item, droppedZone) => `${item} doesn't go in ${lower(droppedZone)}. Where does ${lower(item)} belong?`,

  right: (item, zone) => `Yes! ${item} goes in ${lower(zone)}.`,
};

const BLANK = /_{2,}/;
const withWord = (text, word) => String(text || '').replace(BLANK, String(word));

export const fillBlank = {
  ask: (q) => `${withWord(q.text, 'blank')} Which word fits?`,

  // The child hears their own word in the sentence, then the hint.
  explainMiss: (chosen, q) => {
    const why = q.hint ? ` ${String(q.hint).replace(/[.!]*$/, '')}.` : '';
    return `${withWord(q.text, chosen)} Hmm, that doesn't sound right.${why}`;
  },

  // The whole sentence, read right: the teaching moment.
  right: (q) => `Yes! ${withWord(q.text, q.blank)}`,
};

const tf = (v) => (v ? 'true' : 'false');
const because = (s) => (s.explanation ? ` ${String(s.explanation).replace(/[.!]*$/, '')}.` : '');

export const trueFalse = {
  ask: (s) => `True or false? ${s.text}`,

  // Each statement is answered once, so the miss teaches: what they said,
  // what it is, and why (the config's explanation).
  explainMiss: (chosen, s) => (chosen == null
    ? `Time's up. It's ${tf(s.answer)}.${because(s)}`
    : `You said ${tf(chosen)}. It's ${tf(s.answer)}.${because(s)}`),

  right: (s) => `Yes, it's ${tf(s.answer)}!${because(s)}`,
};

// A 60-second sprint: lines are short, because the next question arrives
// 350 ms after an answer.  The teaching comes when the timer ends.
export const timedRush = {
  ask: (q) => multipleChoice.ask(q),

  explainMiss: (_chosen, q) => {
    const answer = (q.options || [])[q.correctIndex];
    const text = String(q.question || '');
    return SUM_BLANK.test(text) ? `${text.replace(SUM_BLANK, '')} is ${answer}.` : `It's ${answer}.`;
  },

  right: () => 'Yes!',

  // After the timer: the ones to practise, read back (at most three).
  review: (missed = []) => {
    if (!missed.length) return 'Time! You got every one right!';
    const lines = missed.slice(0, 3).map((q) => timedRush.explainMiss(null, q).replace(/\.$/, ''));
    return `Time! Let's practise these: ${lines.join('; ')}.`;
  },
};

// A choice with a consequence.  Every item in the catalogue (13 games, read
// 2026-09-23) carries its own `feedback`: that line is the why, spoken for a
// good choice and a poor one alike.  Money is mentioned only where something
// has a price (five games are choices at $0).
const hasPrices = (scenario) => (scenario.items || []).some((i) => Number(i.price) > 0);

export const simulation = {
  ask: (scenario, money) => {
    const intro = [scenario.title, scenario.goal].filter(Boolean).join('. ');
    return hasPrices(scenario) ? `${intro} You have $${money}.` : intro;
  },

  explainMiss: (item) => item.feedback || `${item.name}. Is that the best choice?`,

  right: (item) => item.feedback || `Yes! ${item.name}.`,

  cantAfford: (item, money) => `${item.name} costs $${item.price}. You have $${money} left.`,
};

// A branching story.  The scene a choice leads to IS the answer's why ("You
// start to walk away, but..."), so a choice says nothing of its own: its cue
// plays and the next scene is read.  The choices are read after the scene, so
// a child who cannot read them yet still hears what they can do.
const unpunct = (t) => String(t || '').replace(/[.!?]*$/, '');

export const storyBuilder = {
  ask: (scene) => {
    const choices = (scene.choices || []).map((c) => unpunct(c.text)).filter(Boolean);
    if (!choices.length) return String(scene.text || '');
    const offered = choices.map((c, i) => (i ? `Or ${c.charAt(0).toLowerCase()}${c.slice(1)}` : c));
    return `${scene.text} ${offered.join('? ')}?`;
  },
};

// Pairs found from memory: the first card turned is read aloud (a child who
// cannot read it yet still knows it); the turn's result names both cards.
export const memoryFlip = {
  ask: () => 'Find the pairs. Turn over two cards. Do they go together?',
  card: (text) => String(text == null ? '' : text),
  explainMiss: (first, second) => `${first} and ${second} don't go together. Remember where they are!`,
  right: (front, match) => matchPairs.right(front, match),
};

// Pictures in a hint ("A fluffy pet" + a cat picture) are for the eye; the
// voice skips them.
const PICTOGRAPHS = /[☀-➿️‍]|[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
const sayable = (t) => String(t || '').replace(PICTOGRAPHS, '').replace(/\s+/g, ' ').trim();

// Letters caught with the voice (the microphone is open).  The game's own
// lines come only while no bubble is on screen, so the agent's voice never
// catches one; a catch is answered by its cue alone.
export const speechBubble = {
  ask: (item, first) => {
    const word = lower(item.word);
    const hint = sayable(item.hint).replace(/[.!]*$/, '');
    const why = hint ? ` ${hint}.` : '';
    return first
      ? `Let's spell ${word}.${why} Say the letters out loud, and your voice catches the bubbles!`
      : `Next word: ${word}.${why}`;
  },

  // The teaching moment: the word spelled, then said whole.
  right: (item) => wordBuild.right(item),
};

// A word said out loud pops its letters.  Like speech-bubble, the game
// listens only after the agent has finished, so the lines are the word's
// introduction and, with the next one, the last word said back.
export const balloonPop = {
  ask: (item, first) => {
    const word = lower(item.word);
    const hint = sayable(item.hint).replace(/[.!]*$/, '');
    const why = hint ? ` ${hint}.` : '';
    return first
      ? `Say ${word}!${why} Keep saying it to pop every balloon!`
      : `Next, say ${word}!${why}`;
  },

  // The teaching moment: the letters that popped, then the word.
  right: (item) => {
    const word = String(item.word || '');
    return `${spell(word)}. ${word.toLowerCase()}! You said ${word.toLowerCase()}!`;
  },
};

// A voice held long and loud makes the mouse peek out; the child taps where
// it is.  The agent speaks only between rounds: while a round is on, its
// voice would make the mouse peek and the child need not speak at all.
// The hiding places are pictures; these are the ones in the catalogue
// (2026-09-23), named so the voice can say where the mouse was.
const SPOT_NAMES = {
  '\u{1F4E6}': 'box', '\u{1F6CB}': 'couch', '\u{1FAB4}': 'plant', '\u{1F5C4}': 'cabinet',
  '\u{1F9FA}': 'basket', '\u{1F334}': 'palm tree', '\u{1FAA8}': 'rock', '\u{1F33A}': 'flower',
  '\u{1F38B}': 'bamboo', '\u{1F319}': 'moon', '⭐': 'star', '\u{1FA90}': 'planet',
  '☄': 'comet', '\u{1F6F8}': 'flying saucer',
};
const spotName = (spot) => SPOT_NAMES[String(spot || '').replace(/️/g, '')] || null;
const behind = (spot) => (spotName(spot) ? `behind the ${spotName(spot)}` : 'there');

export const peekaboo = {
  ask: (foundAt) => (foundAt === undefined
    ? 'The mouse is hiding! Say hello, long and loud, and it will peek out. Then tap where it is!'
    : `Yes! It was ${behind(foundAt)}. Now it's hiding again. Say hello!`),

  right: (spot) => `Yes! It was ${behind(spot)}! You found the mouse!`,

  spotName,
};

// Pieces into numbered slots.  A slot shows only its number, and each piece
// belongs where the puzzle lists it, so nothing on screen says what a slot is
// for: the voice does ("Slot 1: Brain").  Labels are names (Asia, Pacific
// Ocean, Sight), so they are said as they are, never with "the".
const slotFor = (pieces, slot) => (pieces || []).find((p) => p.correctPosition === slot);

export const puzzleAssemble = {
  ask: (puzzle, pieces) => {
    const first = slotFor(pieces, 0);
    const intro = puzzle.title ? `${puzzle.title}. ` : '';
    return `${intro}Put each piece in its place.${first ? ` Slot 1: ${first.label}. Find it!` : ''}`;
  },

  // The first empty slot, and what it is for.
  next: (pieces, filled) => {
    const slot = (pieces || []).map((p) => p.correctPosition).sort((a, b) => a - b)
      .find((s) => !filled.has(s));
    const piece = slotFor(pieces, slot);
    return piece ? `Slot ${slot + 1}: ${piece.label}.` : '';
  },

  explainMiss: (chosen, pieces, slot) => {
    const wanted = slotFor(pieces, slot);
    return wanted
      ? `That's ${chosen.label}. Slot ${slot + 1} is for ${wanted.label}.`
      : `${chosen.label} doesn't go there.`;
  },

  right: (piece, nextLine) => `Yes, ${piece.label}!${nextLine ? ` ${nextLine}` : ''}`,

  // The teaching moment: the whole puzzle, read in order.
  done: (puzzle, pieces) => {
    const inOrder = [...(pieces || [])].sort((a, b) => a.correctPosition - b.correctPosition);
    return `${inOrder.map((p) => p.label).join(', ')}.${puzzle.title ? ` ${puzzle.title}!` : ''}`;
  },
};

// Two scenes; tap what differs in scene B.  Most catalogue rounds (grammar
// mistakes, home hazards, maths mistakes; read 2026-09-23) have one
// difference whose `label` is the lesson ("\"dont\" should be \"doesn't\"",
// "A wet floor is slippery..."); the board never shows it, so the voice says
// it when the difference is found.  Rounds with pictures (altIcon) are a
// real spot-the-difference.
const isPictureRound = (round) => (round.differences || []).some((d) => d.altIcon);

export const spotDifference = {
  ask: (round) => {
    const n = (round.differences || []).length;
    // a quoted sentence is read as the sentence
    const title = unpunct(String(round.title || '').trim().replace(/^["“]+|["”]+$/g, ''));
    if (isPictureRound(round)) {
      return `${title}. Find ${n} ${n === 1 ? 'difference' : 'differences'} in scene B!`;
    }
    return `${title}. What's wrong here? Tap it in scene B.`;
  },

  // A wrong cell is one that is the same in both scenes.
  explainMiss: () => "That one is the same in both. Keep looking!",

  right: (difference) => `Yes! ${unpunct(difference.label)}.`,
};

// A letter, number or shape traced over its guide dots.  A miss is told from
// the child's own line: how much of it stayed on the dots.
const traced = (item) => {
  const v = String(item.value == null ? '' : item.value);
  if (item.type === 'letter') return `the letter ${v.toUpperCase()}`;
  if (item.type === 'number') return `the number ${v}`;
  return `the ${v.toLowerCase()}`;
};

export const tracing = {
  ask: (item) => `Trace ${traced(item)}. Follow the dots with your finger.`,

  // `score` is the share of the line that stayed on the dots (0-100).
  explainMiss: (item, score) => (score >= 25
    ? `Nearly! Most of your line was on the dots. Try ${traced(item)} again, and stay on them all the way.`
    : `Your line went away from the dots. Try ${traced(item)} again, slowly, one dot at a time.`),

  right: (item) => {
    if (item.type === 'shape') {
      const v = String(item.value || '').toLowerCase();
      return `Yes! ${/^[aeiou]/.test(v) ? 'An' : 'A'} ${v}!`;
    }
    const t = traced(item);
    return `Yes! ${t.charAt(0).toUpperCase()}${t.slice(1)}!`;
  },
};

export default {STEP, LEVEL, initialLadder, climb, cueFor, counting, wordBuild, multipleChoice, sequenceOrder, matchPairs, dragToZone, fillBlank, trueFalse, timedRush, simulation, storyBuilder, memoryFlip, speechBubble, balloonPop, peekaboo, puzzleAssemble, spotDifference, tracing};
