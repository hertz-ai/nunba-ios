/**
 * Real-time Event Service for React Native
 *
 * Bridges the native AutobahnConnectionManager (WAMP/crossbar) to JS-land.
 * The native side manages the WAMP connection and subscribes to topics:
 *   - com.hertzai.hevolve.social.{userId} → emits "onSocialEvent" (notifications, votes, achievements)
 *   - com.hertzai.community.feed  → emits "AddPostKey" (feed posts)
 *   - com.hertzai.hevolve.fleet.{deviceId} → emits "fleetCommand" (TTS, agent consent, game)
 *   - Session connect → emits "onSessionConnect"
 *
 * This service listens to those DeviceEventEmitter events and re-dispatches
 * them to typed listeners, matching the web realtimeService API surface.
 */

import { DeviceEventEmitter, AppState } from 'react-native';

class RealtimeService {
  constructor() {
    this._listeners = new Map();
    this._connected = false;
    this._subscriptions = [];
    this._initialized = false;
  }

  /**
   * Start listening to native WAMP bridge events.
   * Call once from MainScreen or App.js after the native side is ready.
   */
  connect() {
    if (this._initialized) return;
    this._initialized = true;

    // Native WAMP session connected
    this._subscriptions.push(
      DeviceEventEmitter.addListener('onSessionConnect', (event) => {
        this._connected = true;
        this._emit('connected', { connected: true, sessionId: event?.sessionID });
      })
    );

    // Social events (notifications, votes, achievements from com.hertzai.hevolve.social.{userId})
    this._subscriptions.push(
      DeviceEventEmitter.addListener('onSocialEvent', (event) => {
        try {
          const data = typeof event?.data === 'string'
            ? JSON.parse(event.data)
            : (event?.data || event);

          const eventType = data?.type || data?.event_type || 'message';
          this._emit(eventType, data);

          // Also dispatch sub-type for notification events
          if (eventType === 'notification') {
            const subType = data?.data?.type || data?.data?.event_type;
            if (subType && subType !== 'notification') {
              this._emit(subType, data?.data || data);
            }
          }
        } catch (_) {}
      })
    );

    // Community feed events (posts from WAMP)
    this._subscriptions.push(
      DeviceEventEmitter.addListener('AddPostKey', (event) => {
        try {
          const data = typeof event?.AddPostKey === 'string'
            ? JSON.parse(event.AddPostKey)
            : (event?.AddPostKey || event);

          // Dispatch as typed event based on payload
          const eventType = data?.type || data?.event_type || 'new_post';
          this._emit(eventType, data);

          // Also emit as generic 'message' for wildcard listeners
          this._emit('message', data);
        } catch (_) {}
      })
    );

    // Direct game session events (from per-session WAMP topic com.hertzai.hevolve.game.{sessionId})
    this._subscriptions.push(
      DeviceEventEmitter.addListener('onGameEvent', (event) => {
        try {
          const data = typeof event?.data === 'string'
            ? JSON.parse(event.data)
            : (event?.data || event);

          const sessionId = event?.sessionId || data?.session_id;
          const gameEventType = data?.type || data?.event_type || 'game_event';

          // Emit as typed game event
          this._emit(gameEventType, { ...data, session_id: sessionId });

          // Also emit generic 'game_event' for useMultiplayerSync
          if (gameEventType !== 'game_event') {
            this._emit('game_event', { ...data, session_id: sessionId, type: gameEventType });
          }
        } catch (_) {}
      })
    );

    // Chat responses (from WAMP com.hertzai.hevolve.chat.{userId})
    // Used by LiquidOverlay for draft-replacement UX: the 0.8B draft
    // model responds instantly, then the expert response arrives here
    // and replaces the draft bubble via speculation_id matching.
    this._subscriptions.push(
      DeviceEventEmitter.addListener('onChatResponse', (event) => {
        try {
          const data = typeof event?.data === 'string'
            ? JSON.parse(event.data)
            : (event?.data || event);

          this._emit('chat_response', data);

          // Also emit as generic 'message' for wildcard listeners
          this._emit('message', data);
        } catch (_) {}
      })
    );

    // Fleet commands (includes game events, TTS, agent consent)
    this._subscriptions.push(
      DeviceEventEmitter.addListener('fleetCommand', (event) => {
        try {
          const data = typeof event?.data === 'string'
            ? JSON.parse(event.data)
            : (event?.data || event);

          const cmdType = data?.cmd_type || data?.type || 'fleet_command';

          // Game events dispatched as game-specific types
          if (cmdType === 'game_event' || cmdType === 'game_move') {
            const gameType = data?.params?.type || data?.type || cmdType;
            this._emit(gameType, data?.params || data);
          }

          // Notification events
          if (cmdType === 'notification' || data?.notification) {
            this._emit('notification', data?.params || data?.notification || data);
          }

          // Always emit the raw command
          this._emit(cmdType, data);
        } catch (_) {}
      })
    );

    // Handle app state changes
    this._subscriptions.push(
      AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active' && !this._connected) {
          this._emit('reconnecting', {});
        }
      })
    );
  }

  disconnect() {
    this._connected = false;
    this._initialized = false;
    this._subscriptions.forEach((sub) => {
      if (sub && typeof sub.remove === 'function') sub.remove();
    });
    this._subscriptions = [];
    this._emit('disconnected', { connected: false });
  }

  get connected() {
    return this._connected;
  }

  /**
   * Register an event listener.
   * @param {string} eventType - Event name or '*' for all events
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  on(eventType, callback) {
    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, new Set());
    }
    this._listeners.get(eventType).add(callback);
    return () => this.off(eventType, callback);
  }

  off(eventType, callback) {
    this._listeners.get(eventType)?.delete(callback);
  }

  _emit(eventType, data) {
    const cbs = this._listeners.get(eventType);
    if (cbs) cbs.forEach((cb) => { try { cb(data); } catch (_) {} });
    // Wildcard listeners
    const wildcardCbs = this._listeners.get('*');
    if (wildcardCbs) wildcardCbs.forEach((cb) => { try { cb({ type: eventType, data }); } catch (_) {} });
  }
}

const realtimeService = new RealtimeService();
export default realtimeService;
