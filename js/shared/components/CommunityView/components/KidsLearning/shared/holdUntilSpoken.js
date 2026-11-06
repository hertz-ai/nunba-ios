// How long a guided answer stays on screen: long enough to see it, and no
// longer than a spoken line takes (a line that never settles is not waited on).
export const ANSWER_HOLD_MIN_MS = 1800;
export const ANSWER_HOLD_MAX_MS = 7000;

/**
 * Run `then` once the guide has finished saying the answer's line.
 *
 * `spoken` is what the shell's onStep returned (a promise that settles when
 * the line has been said, or nothing).  The answer is held at least
 * ANSWER_HOLD_MIN_MS and at most ANSWER_HOLD_MAX_MS, so a line that fails or
 * never settles cannot stall the game.  `isMounted` guards the late call.
 */
export default function holdUntilSpoken(spoken, then, isMounted = () => true) {
  const started = Date.now();
  let moved = false;
  const next = () => {
    if (moved) return;
    moved = true;
    const wait = Math.max(0, ANSWER_HOLD_MIN_MS - (Date.now() - started));
    setTimeout(() => { if (isMounted()) then(); }, wait);
  };
  if (spoken && typeof spoken.then === 'function') {
    spoken.then(next, next);
    setTimeout(next, ANSWER_HOLD_MAX_MS);
  } else {
    next();   // nothing is being said: hold only long enough to see the answer
  }
}
