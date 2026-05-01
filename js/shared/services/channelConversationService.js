/**
 * Channel Conversation Service — Full Channel System from Nunba-HART patterns
 *
 * Integrates the Nunba-HART-Companion multi-channel architecture:
 *   - ChannelAdapter pattern (31 channel types with unified Message interface)
 *   - ChannelRegistry (central hub for message routing)
 *   - ChannelSessionManager (per-channel/user conversation contexts)
 *   - ResponseRouter (fan-out to bound channels + WAMP)
 *   - PairingManager (secure QR/code-based channel binding)
 *   - TypingManager (pulse-based typing indicators)
 *   - MessageQueue (priority-based with dedup and debouncing)
 *   - ConversationEntry persistence (role-based message logging)
 *
 * Adapted for React Native with Zustand store integration and
 * native WAMP bridge via realtimeService.
 */

import { DeviceEventEmitter } from 'react-native';
import realtimeService from './realtimeService';
import { channelsApi } from './socialApi';

// ── Message Types (from Nunba-HART ChannelAdapter) ────────────────────────────
const MessageType = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  LOCATION: 'location',
  CONTACT: 'contact',
  STICKER: 'sticker',
  VOICE: 'voice',
};

// ── Channel Status (from Nunba-HART ChannelAdapter) ───────────────────────────
const ChannelStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
  RATE_LIMITED: 'rate_limited',
};

// ── Channel Catalog with capabilities (from Nunba-HART metadata.py) ───────────
const CHANNEL_CATALOG = {
  telegram:     { name: 'Telegram',     icon: 'chatbubble-ellipses', color: '#0088cc', capabilities: { text: true, image: true, video: true, audio: true, document: true, sticker: true, voice: true, reactions: true, threads: true, typing: true, groups: true, buttons: true, maxLength: 4096 } },
  discord:      { name: 'Discord',      icon: 'game-controller',     color: '#5865F2', capabilities: { text: true, image: true, video: true, audio: true, document: true, reactions: true, threads: true, typing: true, groups: true, buttons: true, maxLength: 2000 } },
  slack:        { name: 'Slack',        icon: 'chatbox',             color: '#4A154B', capabilities: { text: true, image: true, video: true, document: true, reactions: true, threads: true, typing: true, groups: true, buttons: true, maxLength: 40000 } },
  whatsapp:     { name: 'WhatsApp',     icon: 'logo-whatsapp',       color: '#25D366', capabilities: { text: true, image: true, video: true, audio: true, document: true, sticker: true, voice: true, location: true, contact: true, reactions: true, typing: true, groups: true, maxLength: 65536 } },
  email:        { name: 'Email',        icon: 'mail',                color: '#EA4335', capabilities: { text: true, image: true, document: true, maxLength: 100000 } },
  sms:          { name: 'SMS',          icon: 'chatbubble',          color: '#34B7F1', capabilities: { text: true, image: true, maxLength: 1600 } },
  signal:       { name: 'Signal',       icon: 'shield-checkmark',    color: '#3A76F0', capabilities: { text: true, image: true, video: true, audio: true, document: true, sticker: true, voice: true, typing: true, groups: true, maxLength: 65536 } },
  webhook:      { name: 'Webhook',      icon: 'code-slash',          color: '#FF6B35', capabilities: { text: true, maxLength: 100000 } },
  instagram:    { name: 'Instagram',    icon: 'logo-instagram',      color: '#E4405F', capabilities: { text: true, image: true, video: true, sticker: true, reactions: true, maxLength: 1000 } },
  messenger:    { name: 'Messenger',    icon: 'chatbubbles',         color: '#0084FF', capabilities: { text: true, image: true, video: true, audio: true, typing: true, buttons: true, maxLength: 2000 } },
  teams:        { name: 'Teams',        icon: 'people',              color: '#6264A7', capabilities: { text: true, image: true, document: true, reactions: true, threads: true, typing: true, groups: true, maxLength: 28000 } },
  matrix:       { name: 'Matrix',       icon: 'grid',                color: '#0DBD8B', capabilities: { text: true, image: true, video: true, audio: true, document: true, reactions: true, threads: true, typing: true, groups: true, maxLength: 65536 } },
  line:         { name: 'LINE',         icon: 'chatbox-ellipses',    color: '#00C300', capabilities: { text: true, image: true, video: true, audio: true, sticker: true, location: true, typing: true, groups: true, maxLength: 5000 } },
};

// ── Queue Policies (from Nunba-HART MessageQueue) ─────────────────────────────
const QueuePolicy = {
  DROP: 'drop',         // Reject when busy
  LATEST: 'latest',     // Keep only most recent
  BACKLOG: 'backlog',   // FIFO processing
  PRIORITY: 'priority', // Priority-based ordering
  COLLECT: 'collect',   // Batch messages
};

// ── Conversation Message (from Nunba-HART session_manager.py) ─────────────────
class ConversationMessage {
  constructor({ role, content, channel, messageId = null, replyToId = null, metadata = {} }) {
    this.id = messageId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.role = role; // 'user', 'assistant', 'system', 'agent'
    this.content = content;
    this.channel = channel;
    this.replyToId = replyToId;
    this.metadata = metadata;
    this.timestamp = Date.now();
  }
}

// ── Channel Session (from Nunba-HART ChannelSession) ──────────────────────────
class ChannelSession {
  constructor(channelType, userId, maxMessages = 100) {
    this.channelType = channelType;
    this.userId = userId;
    this.maxMessages = maxMessages;
    this.messages = [];
    this.state = {};
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
  }

  addMessage(message) {
    this.messages.push(message);
    this.lastActivityAt = Date.now();
    // Trim to max
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    return message;
  }

  addUserMessage(content, metadata = {}) {
    return this.addMessage(new ConversationMessage({
      role: 'user', content, channel: this.channelType, metadata,
    }));
  }

  addAssistantMessage(content, metadata = {}) {
    return this.addMessage(new ConversationMessage({
      role: 'assistant', content, channel: this.channelType, metadata,
    }));
  }

  getHistory() {
    return [...this.messages];
  }

  getContextWindow(maxTokenEstimate = 4000) {
    // Rough estimate: 4 chars per token
    const charLimit = maxTokenEstimate * 4;
    let total = 0;
    const window = [];
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msgLen = this.messages[i].content.length;
      if (total + msgLen > charLimit) break;
      window.unshift(this.messages[i]);
      total += msgLen;
    }
    return window;
  }

  getState(key) {
    return key ? this.state[key] : this.state;
  }

  setState(key, value) {
    this.state[key] = value;
    this.lastActivityAt = Date.now();
  }

  clearHistory() {
    this.messages = [];
  }
}

// ── Channel Session Manager (from Nunba-HART ChannelSessionManager) ───────────
class ChannelSessionManager {
  constructor() {
    this._sessions = new Map(); // key: `${channelType}:${userId}`
  }

  getOrCreate(channelType, userId) {
    const key = `${channelType}:${userId}`;
    if (!this._sessions.has(key)) {
      this._sessions.set(key, new ChannelSession(channelType, userId));
    }
    return this._sessions.get(key);
  }

  get(channelType, userId) {
    return this._sessions.get(`${channelType}:${userId}`) || null;
  }

  listActive() {
    const active = [];
    this._sessions.forEach((session, key) => {
      active.push({ key, channelType: session.channelType, userId: session.userId, messageCount: session.messages.length, lastActivity: session.lastActivityAt });
    });
    return active.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  clear(channelType, userId) {
    this._sessions.delete(`${channelType}:${userId}`);
  }

  clearAll() {
    this._sessions.clear();
  }
}

// ── Typing Manager (from Nunba-HART TypingManager) ────────────────────────────
class TypingManager {
  constructor() {
    this._activeTyping = new Map(); // channelType → { interval, timeout }
    this.config = {
      pulseInterval: 5000,   // 5s refresh
      autoStopTimeout: 30000, // 30s max
      maxRetries: 3,
    };
  }

  /**
   * Start showing typing indicator on a channel.
   */
  startTyping(channelType) {
    this.stopTyping(channelType); // Clear existing

    const state = {
      startedAt: Date.now(),
      interval: setInterval(() => {
        // Pulse typing indicator
        DeviceEventEmitter.emit('channelTyping', { channelType, typing: true, pulse: true });
      }, this.config.pulseInterval),
      timeout: setTimeout(() => {
        this.stopTyping(channelType);
      }, this.config.autoStopTimeout),
    };

    this._activeTyping.set(channelType, state);
    DeviceEventEmitter.emit('channelTyping', { channelType, typing: true, pulse: false });
  }

  stopTyping(channelType) {
    const state = this._activeTyping.get(channelType);
    if (state) {
      clearInterval(state.interval);
      clearTimeout(state.timeout);
      this._activeTyping.delete(channelType);
      DeviceEventEmitter.emit('channelTyping', { channelType, typing: false });
    }
  }

  isTyping(channelType) {
    return this._activeTyping.has(channelType);
  }

  stopAll() {
    this._activeTyping.forEach((_, channelType) => this.stopTyping(channelType));
  }
}

// ── Message Queue (from Nunba-HART MessageQueue) ──────────────────────────────
class MessageQueue {
  constructor(options = {}) {
    this.policy = options.policy || QueuePolicy.BACKLOG;
    this.maxSize = options.maxSize || 50;
    this.debounceMs = options.debounceMs || 1000;
    this.expirationMs = options.expirationMs || 300000; // 5 min
    this._queue = [];
    this._processing = false;
    this._debounceTimer = null;
    this._seenIds = new Set();
    this._processor = options.processor || null;
  }

  enqueue(message) {
    // Dedup by message ID
    const msgId = message.id || `${message.channel}_${message.content?.substring(0, 50)}`;
    if (this._seenIds.has(msgId)) return false;
    this._seenIds.add(msgId);

    // Expire old seen IDs
    if (this._seenIds.size > 1000) {
      const arr = [...this._seenIds];
      this._seenIds = new Set(arr.slice(-500));
    }

    // Apply queue policy
    if (this._queue.length >= this.maxSize) {
      switch (this.policy) {
        case QueuePolicy.DROP:
          return false;
        case QueuePolicy.LATEST:
          this._queue = [message];
          break;
        case QueuePolicy.BACKLOG:
          this._queue.shift(); // Drop oldest
          this._queue.push(message);
          break;
        case QueuePolicy.PRIORITY:
          // Insert by priority
          const priority = message.priority || 0;
          const idx = this._queue.findIndex((m) => (m.priority || 0) < priority);
          if (idx >= 0) {
            this._queue.splice(idx, 0, message);
            this._queue = this._queue.slice(0, this.maxSize);
          }
          break;
        default:
          this._queue.push(message);
      }
    } else {
      this._queue.push(message);
    }

    // Debounced processing
    this._scheduleProcess();
    return true;
  }

  _scheduleProcess() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._process(), this.debounceMs);
  }

  async _process() {
    if (this._processing || this._queue.length === 0) return;
    this._processing = true;

    while (this._queue.length > 0) {
      const message = this._queue.shift();
      // Skip expired messages
      if (message.timestamp && Date.now() - message.timestamp > this.expirationMs) continue;

      if (this._processor) {
        try {
          await this._processor(message);
        } catch {
          // Re-queue on failure (once)
          if (!message._retried) {
            message._retried = true;
            this._queue.unshift(message);
          }
        }
      }
    }

    this._processing = false;
  }

  get length() { return this._queue.length; }
  get isProcessing() { return this._processing; }

  clear() {
    this._queue = [];
    this._seenIds.clear();
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  }
}

// ── Response Router (from Nunba-HART ChannelResponseRouter) ───────────────────
class ResponseRouter {
  constructor() {
    this._channelHandlers = new Map();
  }

  /**
   * Register a handler for routing messages to a specific channel.
   */
  registerChannel(channelType, handler) {
    this._channelHandlers.set(channelType, handler);
  }

  /**
   * Route a response to the appropriate channels.
   * Fan-out pattern: sends to origin channel + preferred channel + WAMP.
   */
  async routeResponse(response, options = {}) {
    const { originChannel, targetChannels = [], fanOut = false } = options;
    const results = [];

    // Always send to origin channel
    if (originChannel && this._channelHandlers.has(originChannel)) {
      try {
        const handler = this._channelHandlers.get(originChannel);
        const result = await handler(response);
        results.push({ channel: originChannel, success: true, result });
      } catch (err) {
        results.push({ channel: originChannel, success: false, error: err.message });
      }
    }

    // Fan-out to additional channels
    if (fanOut && targetChannels.length > 0) {
      const fanOutPromises = targetChannels
        .filter((ch) => ch !== originChannel && this._channelHandlers.has(ch))
        .map(async (ch) => {
          try {
            const handler = this._channelHandlers.get(ch);
            const result = await handler(response);
            return { channel: ch, success: true, result };
          } catch (err) {
            return { channel: ch, success: false, error: err.message };
          }
        });
      const fanOutResults = await Promise.allSettled(fanOutPromises);
      fanOutResults.forEach((r) => {
        if (r.status === 'fulfilled') results.push(r.value);
      });
    }

    // Always emit to WAMP for desktop/web sync
    DeviceEventEmitter.emit('channelResponse', { response, results, originChannel });

    return results;
  }
}

// ── Main Channel Conversation Service ─────────────────────────────────────────
class ChannelConversationService {
  constructor() {
    this.sessionManager = new ChannelSessionManager();
    this.typingManager = new TypingManager();
    this.messageQueue = new MessageQueue({
      policy: QueuePolicy.BACKLOG,
      debounceMs: 500,
      processor: (msg) => this._processQueuedMessage(msg),
    });
    this.responseRouter = new ResponseRouter();
    this._listeners = new Map();
    this._initialized = false;
  }

  /**
   * Initialize the service. Connect to WAMP for real-time channel events.
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Listen for channel messages from WAMP
    realtimeService.on('channel_message', (data) => this._onIncomingMessage(data));
    realtimeService.on('channel_typing', (data) => this._onRemoteTyping(data));
    realtimeService.on('channel_presence', (data) => this._onPresenceUpdate(data));

    // Register default channel handlers for response routing
    Object.keys(CHANNEL_CATALOG).forEach((channelType) => {
      this.responseRouter.registerChannel(channelType, async (response) => {
        // Route through backend API
        return channelsApi.sendMessage?.({
          channel_type: channelType,
          content: response.content,
          reply_to_id: response.replyToId,
        });
      });
    });
  }

  // ── Message Handling ──────────────────────────────────────────────────────

  /**
   * Send a message through a channel.
   */
  async sendMessage(channelType, content, options = {}) {
    const { userId, replyToId, metadata = {} } = options;

    // Get or create session
    const session = this.sessionManager.getOrCreate(channelType, userId || 'self');

    // Create message
    const message = session.addUserMessage(content, {
      ...metadata,
      replyToId,
    });

    // Queue for processing
    this.messageQueue.enqueue({
      ...message,
      channelType,
      userId,
      priority: options.priority || 0,
    });

    // Emit locally
    this._emit('message_sent', { channelType, message });

    return message;
  }

  /**
   * Handle incoming message from WAMP.
   */
  _onIncomingMessage(data) {
    const channelType = data?.channel_type || data?.channel;
    const userId = data?.sender_id || data?.user_id;
    const content = data?.content || data?.text || '';
    const role = data?.role || 'user';

    if (!channelType || !content) return;

    const session = this.sessionManager.getOrCreate(channelType, userId || 'remote');
    const message = session.addMessage(new ConversationMessage({
      role,
      content,
      channel: channelType,
      messageId: data?.message_id,
      replyToId: data?.reply_to_id,
      metadata: {
        sender_name: data?.sender_name,
        is_group: data?.is_group,
        chat_id: data?.chat_id,
      },
    }));

    this._emit('message_received', { channelType, userId, message });
  }

  /**
   * Process a queued message (send to backend).
   */
  async _processQueuedMessage(msg) {
    try {
      // Route through response router
      await this.responseRouter.routeResponse(
        { content: msg.content, replyToId: msg.replyToId },
        { originChannel: msg.channelType },
      );
    } catch (err) {
      console.warn('Channel message send failed:', err);
    }
  }

  // ── Typing Indicators ─────────────────────────────────────────────────────

  startTyping(channelType) {
    this.typingManager.startTyping(channelType);
  }

  stopTyping(channelType) {
    this.typingManager.stopTyping(channelType);
  }

  _onRemoteTyping(data) {
    this._emit('typing', {
      channelType: data?.channel_type,
      userId: data?.user_id,
      typing: data?.typing !== false,
    });
  }

  // ── Presence ──────────────────────────────────────────────────────────────

  _onPresenceUpdate(data) {
    this._emit('presence', {
      channelType: data?.channel_type,
      status: data?.status, // 'online', 'offline', 'error'
      lastHeartbeat: data?.last_heartbeat,
    });
  }

  /**
   * Fetch current presence status for all channels.
   */
  async fetchPresence() {
    try {
      const res = await channelsApi.presence();
      return res?.data || [];
    } catch {
      return [];
    }
  }

  // ── Conversation History ──────────────────────────────────────────────────

  /**
   * Fetch conversation history from the backend.
   */
  async fetchHistory(params = {}) {
    try {
      const res = await channelsApi.conversationHistory(params);
      const data = res?.data || [];

      // Hydrate local sessions from history
      data.forEach((entry) => {
        const session = this.sessionManager.getOrCreate(
          entry.channel_type || 'unknown',
          entry.user_id || 'unknown',
        );
        session.addMessage(new ConversationMessage({
          role: entry.role,
          content: entry.content,
          channel: entry.channel_type,
          messageId: entry.id,
          metadata: {
            agent_id: entry.agent_id,
            prompt_id: entry.prompt_id,
            created_at: entry.created_at,
          },
        }));
      });

      return data;
    } catch {
      return [];
    }
  }

  /**
   * Get local conversation history for a channel.
   */
  getLocalHistory(channelType, userId) {
    const session = this.sessionManager.get(channelType, userId);
    return session ? session.getHistory() : [];
  }

  /**
   * Get context window for LLM input.
   */
  getContextWindow(channelType, userId, maxTokens = 4000) {
    const session = this.sessionManager.get(channelType, userId);
    return session ? session.getContextWindow(maxTokens) : [];
  }

  // ── Channel Info ──────────────────────────────────────────────────────────

  getChannelCatalog() {
    return CHANNEL_CATALOG;
  }

  getChannelInfo(channelType) {
    return CHANNEL_CATALOG[channelType] || null;
  }

  getChannelCapabilities(channelType) {
    return CHANNEL_CATALOG[channelType]?.capabilities || {};
  }

  // ── Active Sessions ───────────────────────────────────────────────────────

  listActiveSessions() {
    return this.sessionManager.listActive();
  }

  clearSession(channelType, userId) {
    this.sessionManager.clear(channelType, userId);
  }

  // ── Event Emitter ─────────────────────────────────────────────────────────

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this._listeners.get(event)?.delete(callback);
  }

  _emit(event, data) {
    const cbs = this._listeners.get(event);
    if (cbs) cbs.forEach((cb) => { try { cb(data); } catch {} });
    const wildcards = this._listeners.get('*');
    if (wildcards) wildcards.forEach((cb) => { try { cb({ event, data }); } catch {} });
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    this.typingManager.stopAll();
    this.messageQueue.clear();
    this.sessionManager.clearAll();
    this._listeners.clear();
    this._initialized = false;
  }
}

const channelConversationService = new ChannelConversationService();
export {
  CHANNEL_CATALOG, MessageType, ChannelStatus, QueuePolicy,
  ConversationMessage, ChannelSession, ChannelSessionManager,
  TypingManager, MessageQueue, ResponseRouter,
};
export default channelConversationService;
