/**
 * useGuidedSteps — the ONE place a kids game's steps are spoken, sounded and
 * laddered on React Native (design: docs/KIDS_AGENT_GUIDED_GAMES_DESIGN.md).
 *
 * Every host that renders a game template uses it: GameShell (catalogue
 * games) and DynamicTemplateEngine's local mode (server-composed games that
 * name a local template).  Before this the step handling lived in GameShell
 * only, so a server-composed game ran its template with a fixed level and no
 * voice -- and once the templates' own ladders were folded into the shell's,
 * it lost even the "easier after three misses" it used to have.
 *
 * The words and the rules come from shared/gameGuide (pure JS); this hook is
 * the React Native adapter: one utterance (the node's TTS) and one cue (the
 * sound the agent memoized for the game's state, else the game's own) per
 * step.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import GameSounds from './SoundManager';
import {playAgentGameSound} from './agentGameSound';
import {STEP, climb, cueFor, initialLadder} from './gameGuide';

const useGuidedSteps = ({config, gameTheme, isReducedMotion = false}) => {
  // A template that reports its steps is GUIDED from its first step on: the
  // host then plays no cue of its own and FeedbackOverlay is visual only.
  const [guided, setGuided] = useState(false);
  const guidedRef = useRef(false);
  const ladderRef = useRef(initialLadder());
  const [level, setLevel] = useState(ladderRef.current.level);

  // A game closed mid-sentence stops speaking.  GameShell also stops all its
  // audio on unmount; DynamicTemplateEngine's local mode does not.
  useEffect(() => () => {
    if (guidedRef.current) GameSounds.stopTTS();
  }, []);

  const onStep = useCallback((step) => {
    if (!step || !step.kind) return;
    if (!guidedRef.current) {
      guidedRef.current = true;
      setGuided(true);
    }
    let after = ladderRef.current;
    if (step.kind === STEP.RIGHT || step.kind === STEP.WRONG) {
      after = climb(ladderRef.current, step.kind === STEP.RIGHT);
      ladderRef.current = {level: after.level, rightRun: after.rightRun, wrongRun: after.wrongRun};
      if (after.changed) setLevel(after.level);
    }
    const voice = config?.voice ? {voice: config.voice} : undefined;
    if (step.prepare && step.prepare.length) {
      // Lines the game will say later, synthesized now in the same voice.
      Promise.resolve(GameSounds.preCacheTTS(step.prepare, voice))
        .catch((e) => console.warn('[kids] game lines were not prepared:', e && e.message));
    }
    let spoken;
    if (step.say) {
      spoken = GameSounds.speakText(step.say, voice);
      if (spoken && typeof spoken.catch === 'function') {
        // Never silent: the child heard nothing, so say so where it can be
        // found.  The fallback voice (design R3) will hang off this catch.
        spoken.catch((e) => console.warn('[kids] a game step was not spoken:', e && e.message));
      }
    }
    const cue = cueFor(step.kind, after, step.cue);
    if (cue && !isReducedMotion) {
      const played = playAgentGameSound({game_sound: cue}, {
        promptId: config?.promptId || config?.prompt_id,
        gameId: config?.id,
        category: gameTheme?.bgmCategory || config?.category,
        mood: gameTheme?.bgmMood,
        level: after.level,
      });
      // The game's own cue vibrates as it plays; the agent's memoized sound
      // does not, so a guided game kept its touch feedback only when no sound
      // had been composed for it (hartos-3a G1).
      Promise.resolve(played).then((done) => {
        if (done && done.source === 'memo') GameSounds.haptic(cue);
      }).catch((e) => console.warn('[kids] a game step cue failed:', e && e.message));
    }
    // Settles when the line has been heard (playback ended), so a game that
    // listens with the microphone can wait for the agent to finish speaking.
    return spoken;
  }, [config, gameTheme, isReducedMotion]);

  return {onStep, level, guided, guidedRef};
};

export default useGuidedSteps;
