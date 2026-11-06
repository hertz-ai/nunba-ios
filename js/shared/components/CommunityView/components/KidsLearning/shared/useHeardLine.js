/**
 * useHeardLine — for the games that listen with the microphone (balloon-pop,
 * peekaboo, speech-bubble): say a line, and listen only once it has been
 * heard.
 *
 * The microphone opens with VOICE_RECOGNITION (MicAmplitudeModule), which has
 * no echo cancelling, and these games act on how loud the room is: the
 * agent's voice from the speaker would pop, catch and peek exactly as the
 * child's does.  So the game keeps still while the agent speaks.
 *
 * `onStep` (useGuidedSteps) returns the speech promise, which settles when
 * playback ends.  A host with no voice starts listening at once; a line that
 * never settles is waited for at most LINE_WAIT_MAX_MS.
 */
import {useCallback, useEffect, useRef, useState} from 'react';

export const LINE_WAIT_MAX_MS = 8000;

const useHeardLine = (onStep) => {
  const [heard, setHeard] = useState(false);
  const mountedRef = useRef(true);
  const cancelRef = useRef(null);

  useEffect(() => () => {
    mountedRef.current = false;
    if (cancelRef.current) cancelRef.current();
  }, []);

  // Speak `step` (a guided step with `say`), then listen.
  const sayThenListen = useCallback((step) => {
    if (cancelRef.current) cancelRef.current();
    setHeard(false);
    let done = false;
    let cap = null;
    const go = () => {
      if (done || !mountedRef.current) return;
      done = true;
      clearTimeout(cap);
      setHeard(true);
    };
    cap = setTimeout(go, LINE_WAIT_MAX_MS);
    cancelRef.current = () => {
      done = true;
      clearTimeout(cap);
    };
    const spoken = onStep ? onStep(step) : undefined;
    // Nothing being said is nothing to wait for: listen now, not a tick later.
    if (spoken && typeof spoken.then === 'function') spoken.then(go, go);
    else go();
  }, [onStep]);

  // Stop listening (a round is over) until the next line has been heard.
  const hush = useCallback(() => {
    if (cancelRef.current) cancelRef.current();
    setHeard(false);
  }, []);

  return {heard, sayThenListen, hush};
};

export default useHeardLine;
