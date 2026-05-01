/**
 * useMultiplayerSync — Real-time multiplayer synchronization hook for React Native.
 *
 * Port of the web useMultiplayerSync hook. Manages multiplayer game state using
 * the Nunba backend API + crossbar WAMP real-time events.
 *
 * Transport difference from web:
 *   - Web: gameRealtimeService (WAMP Web Worker) + SSE + REST polling
 *   - RN:  native WAMP via realtimeService.on('game_*', ...) + REST polling fallback
 *
 * The native AutobahnConnectionManager subscribes to WAMP topics and emits
 * typed events through DeviceEventEmitter. realtimeService bridges those into
 * typed listeners (game_move, game_player_joined, game_started, game_completed).
 *
 * Polling fallback: if no WAMP events arrive within 5 seconds while in 'waiting'
 * status, polls GET /games/{id} every 3 seconds until real-time resumes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import realtimeService from '../services/realtimeService';
import { gamesApi } from '../services/socialApi';

const POLL_INTERVAL = 3000;
const WAMP_SILENCE_THRESHOLD = 5000;

/**
 * @param {Object} options
 * @param {string} options.gameConfigId - Catalog ID e.g. 'trivia-general-knowledge-classic'
 * @param {string} options.gameTitle - Display title for the session
 * @param {string} options.gameType - Game template type (quiz, counting, match, etc.)
 * @param {boolean} options.enabled - Whether multiplayer is active
 * @returns {Object} Multiplayer state and action functions
 */
export default function useMultiplayerSync({
  gameConfigId,
  gameTitle = '',
  gameType = 'quiz',
  enabled = false,
} = {}) {
  // ── State ────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [scores, setScores] = useState({});
  const [status, setStatus] = useState('idle'); // idle | creating | waiting | playing | complete
  const [error, setError] = useState(null);

  // Refs to avoid stale closures in polling / event callbacks
  const sessionIdRef = useRef(null);
  const pollTimerRef = useRef(null);
  const lastWampEventRef = useRef(0);

  // Keep sessionIdRef in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // ── Helper: refresh session from API ─────────────────────────
  const refreshSession = useCallback(async (id) => {
    try {
      const res = await gamesApi.get(id);
      const session = res?.data || res;
      if (session) {
        setParticipants(session.participants || []);
        if (session.status === 'active' && !gameStarted) {
          setGameStarted(true);
          setStatus('playing');
        }
        if (session.status === 'completed') {
          setStatus('complete');
        }
      }
    } catch (_) {
      // Polling failure is non-critical
    }
  }, [gameStarted]);

  // ── Actions ──────────────────────────────────────────────────

  /**
   * Create a new multiplayer session. Sets this player as host.
   */
  const createSession = useCallback(
    async (maxPlayers = 4) => {
      if (!enabled) return null;
      setStatus('creating');
      setError(null);

      try {
        const res = await gamesApi.create({
          game_type: gameType,
          game_config_id: gameConfigId,
          title: gameTitle,
          max_players: maxPlayers,
          total_rounds: 10,
          context_type: 'kids_learning',
        });

        const session = res?.data?.data || res?.data || res;
        if (session?.id) {
          setSessionId(session.id);
          setIsHost(true);
          setStatus('waiting');
          setParticipants(session.participants || []);
          return session.id;
        }

        setError('Could not create game session');
        setStatus('idle');
      } catch (err) {
        setError('Could not create game session');
        setStatus('idle');
      }
      return null;
    },
    [enabled, gameType, gameConfigId, gameTitle],
  );

  /**
   * Join an existing session by ID.
   */
  const joinSession = useCallback(
    async (id) => {
      if (!enabled || !id) return false;
      setStatus('creating');
      setError(null);

      try {
        const res = await gamesApi.join(id);
        const session = res?.data?.data || res?.data || res;
        if (session) {
          setSessionId(id);
          setIsHost(false);
          setStatus('waiting');
          setParticipants(session.participants || []);
          return true;
        }

        setError('Could not join game');
        setStatus('idle');
      } catch (err) {
        setError('Could not join game');
        setStatus('idle');
      }
      return false;
    },
    [enabled],
  );

  /**
   * Quick match: auto-join an existing session or create a new one.
   */
  const quickMatch = useCallback(async () => {
    if (!enabled) return null;
    setStatus('creating');
    setError(null);

    try {
      const res = await gamesApi.quickMatch({
        game_type: gameType,
        game_config_id: gameConfigId,
      });

      const session = res?.data?.data || res?.data || res;
      if (session?.id) {
        setSessionId(session.id);
        setIsHost(session.is_host || false);
        setStatus('waiting');
        setParticipants(session.participants || []);
        return session.id;
      }
    } catch (err) {
      // Fallback: create a new session
      return createSession(4);
    }
    return null;
  }, [enabled, gameType, gameConfigId, createSession]);

  /**
   * Mark this player as ready.
   */
  const markReady = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) return;
    try {
      await gamesApi.ready(id);
    } catch (err) {
      setError('Could not mark ready');
    }
  }, []);

  /**
   * Start the game (host only).
   */
  const startGame = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id || !isHost) return;
    try {
      await gamesApi.start(id);
      setGameStarted(true);
      setStatus('playing');
    } catch (err) {
      setError('Could not start game');
    }
  }, [isHost]);

  /**
   * Submit a move (answer, progress update, etc.).
   */
  const submitMove = useCallback(
    async (moveData) => {
      const id = sessionIdRef.current;
      if (!id || status !== 'playing') return;

      const move = { type: 'answer', ...moveData };
      try {
        await gamesApi.move(id, move);
      } catch (err) {
        setError('Could not submit move');
      }
    },
    [status],
  );

  /**
   * Submit a final score at end of game.
   */
  const submitFinalScore = useCallback(async (finalScore) => {
    const id = sessionIdRef.current;
    if (!id) return;

    const moveData = {
      type: 'final_score',
      correct: finalScore.correct,
      total: finalScore.total,
      streak: finalScore.bestStreak || 0,
    };

    try {
      await gamesApi.move(id, moveData);
    } catch (err) {
      // Non-critical — score may already be recorded
    }
  }, []);

  /**
   * Leave the current session and reset all state.
   */
  const leaveSession = useCallback(async () => {
    const id = sessionIdRef.current;
    if (id) {
      try {
        await gamesApi.leave(id);
      } catch (err) {
        // Non-critical
      }
    }

    setSessionId(null);
    setParticipants([]);
    setIsHost(false);
    setGameStarted(false);
    setStatus('idle');
    setScores({});
    setError(null);
  }, []);

  /**
   * Fetch final results for the session.
   */
  const getResults = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) return null;
    try {
      const res = await gamesApi.results(id);
      return res?.data?.data || res?.data || res;
    } catch (err) {
      return null;
    }
  }, []);

  // ── Real-time event handling + polling fallback ──────────────
  useEffect(() => {
    if (!enabled || !sessionId) return;

    const unsubscribers = [];

    // Track WAMP liveness for polling fallback decision
    const markWampAlive = () => {
      lastWampEventRef.current = Date.now();
    };

    // ── Event handlers ──────────────────────────────────────────
    const handlePlayerJoined = (data) => {
      markWampAlive();
      const player = data?.player || data?.data?.player;
      if (!player) {
        // If no player object, refresh the full session
        refreshSession(sessionIdRef.current);
        return;
      }
      setParticipants((prev) => {
        const exists = prev.find((p) => p.id === player.id);
        if (exists) return prev;
        return [...prev, player];
      });
    };

    const handlePlayerLeft = (data) => {
      markWampAlive();
      const playerId = data?.player_id || data?.data?.player_id;
      if (playerId) {
        setParticipants((prev) => prev.filter((p) => p.id !== playerId));
      }
    };

    const handleGameStarted = () => {
      markWampAlive();
      setGameStarted(true);
      setStatus('playing');
    };

    const handleGameMove = (data) => {
      markWampAlive();
      const move = data?.move || data;
      const playerId = data?.player_id || data?.data?.player_id;

      if (move?.type === 'answer' || move?.type === 'final_score') {
        setScores((prev) => ({
          ...prev,
          [playerId]: {
            correct:
              move.correct ??
              (prev[playerId]?.correct || 0) + (move.isCorrect ? 1 : 0),
            total: move.total ?? (prev[playerId]?.total || 0) + 1,
            streak: move.streak || 0,
          },
        }));
      }
    };

    const handleGameCompleted = () => {
      markWampAlive();
      setStatus('complete');
    };

    // ── Subscribe to native WAMP events via realtimeService ─────
    unsubscribers.push(realtimeService.on('game_player_joined', handlePlayerJoined));
    unsubscribers.push(realtimeService.on('game_player_left', handlePlayerLeft));
    unsubscribers.push(realtimeService.on('game_started', handleGameStarted));
    unsubscribers.push(realtimeService.on('game_move', handleGameMove));
    unsubscribers.push(realtimeService.on('game_completed', handleGameCompleted));

    // ── Polling fallback ────────────────────────────────────────
    // Start polling if no WAMP events received within the silence threshold.
    // Only polls while in 'waiting' status (lobby). During 'playing', moves
    // are the source of truth and polling would be wasteful.
    let pollStartTimer = null;

    const startPolling = () => {
      if (pollTimerRef.current) return; // Already polling
      pollTimerRef.current = setInterval(() => {
        const id = sessionIdRef.current;
        if (id) {
          refreshSession(id);
        }
      }, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    // After WAMP_SILENCE_THRESHOLD ms of no WAMP events while waiting,
    // kick off polling as a fallback.
    pollStartTimer = setTimeout(() => {
      // Only start polling if still in waiting and no WAMP event has arrived
      const elapsed = Date.now() - lastWampEventRef.current;
      if (elapsed >= WAMP_SILENCE_THRESHOLD) {
        startPolling();
      }
    }, WAMP_SILENCE_THRESHOLD);

    // ── Cleanup ─────────────────────────────────────────────────
    return () => {
      // Unsubscribe all WAMP listeners
      unsubscribers.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });

      // Clear polling
      stopPolling();
      if (pollStartTimer) clearTimeout(pollStartTimer);
    };
  }, [enabled, sessionId, refreshSession]);

  // ── Return ────────────────────────────────────────────────────
  return {
    // State
    sessionId,
    participants,
    isHost,
    gameStarted,
    scores,
    status,
    error,

    // Actions
    createSession,
    joinSession,
    quickMatch,
    markReady,
    startGame,
    submitMove,
    submitFinalScore,
    leaveSession,
    getResults,

    // Computed
    participantCount: participants.length,
    isMultiplayer: !!sessionId,
    canStart: isHost && participants.length >= 2 && !gameStarted,
  };
}
