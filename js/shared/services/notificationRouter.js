/**
 * Notification Router — Multi-Channel Delivery + Marketing Flywheel Integration
 *
 * Central routing hub that connects:
 *   - Marketing notifications (from marketingNotificationService)
 *   - Channel conversations (from channelConversationService)
 *   - Deep links (from deepLinkService)
 *   - Native push (FCM via MyFirebaseMessagingService)
 *   - WAMP real-time (via realtimeService)
 *
 * Delivery modes (from Nunba-HART ResponseRouter patterns):
 *   - 'push'      → Native FCM push notification
 *   - 'preferred'  → User's preferred channel (WhatsApp, Telegram, etc.)
 *   - 'origin'     → Same channel the event originated from
 *   - 'all'        → Fan-out to all bound channels + push
 *   - 'silent'     → In-app badge only, no external delivery
 */

import { DeviceEventEmitter, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import realtimeService from './realtimeService';
import { channelsApi, notificationsApi } from './socialApi';
import deepLinkService from './deepLinkService';
import { NOTIFICATION_CATEGORIES } from './marketingNotificationService';
import { CHANNEL_CATALOG } from './channelConversationService';

// ── Delivery Modes ────────────────────────────────────────────────────────────
const DeliveryMode = {
  PUSH: 'push',
  PREFERRED: 'preferred',
  ORIGIN: 'origin',
  ALL: 'all',
  SILENT: 'silent',
};

// ── Priority Levels ───────────────────────────────────────────────────────────
const Priority = {
  CRITICAL: 'critical', // Always deliver immediately (e.g., security alerts)
  HIGH: 'high',         // Deliver immediately, all channels
  MEDIUM: 'medium',     // Deliver via preferred channel
  LOW: 'low',           // Batch/digest or silent
};

// ── Quiet Hours ───────────────────────────────────────────────────────────────
const DEFAULT_QUIET_HOURS = {
  enabled: false,
  start: '22:00',
  end: '07:00',
  allowCritical: true,
};

// ── Storage Keys ──────────────────────────────────────────────────────────────
const STORAGE = {
  ROUTING_PREFS: 'hevolve_routing_prefs',
  QUIET_HOURS: 'hevolve_quiet_hours',
  DELIVERY_LOG: 'hevolve_delivery_log',
  BADGE_COUNT: 'hevolve_badge_count',
};

// ── Notification Router ───────────────────────────────────────────────────────
class NotificationRouter {
  constructor() {
    this._initialized = false;
    this._preferredChannel = null;
    this._boundChannels = [];
    this._listeners = new Map();
    this._badgeCount = 0;
    this._quietHours = { ...DEFAULT_QUIET_HOURS };
    this._categoryOverrides = new Map(); // category → delivery mode override
    this._deliveryLog = []; // Recent deliveries for dedup
  }

  /**
   * Initialize the router. Call once after auth.
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    // Load preferences
    await this._loadPreferences();

    // Fetch current channel bindings
    await this._refreshBindings();

    // Listen for marketing notifications
    DeviceEventEmitter.addListener('marketingNotification', (notification) => {
      this.route(notification);
    });

    // Listen for channel responses (from channelConversationService)
    DeviceEventEmitter.addListener('channelResponse', (data) => {
      this._logDelivery(data);
    });

    // Listen for badge updates from notification store
    realtimeService.on('notification', () => {
      this._incrementBadge();
    });
  }

  /**
   * Route a notification through the appropriate channels.
   * This is the main entry point for all notification delivery.
   */
  async route(notification) {
    const {
      category,
      priority = Priority.MEDIUM,
      preferredChannel: categoryChannel,
      title,
      body,
      data = {},
      deepLink,
    } = notification;

    // 1. Check quiet hours
    if (this._isQuietHours() && priority !== Priority.CRITICAL) {
      // Queue for later delivery
      this._queueForLater(notification);
      return { delivered: false, reason: 'quiet_hours' };
    }

    // 2. Check for category-specific delivery override
    const deliveryMode = this._categoryOverrides.get(category) || categoryChannel || this._getDeliveryMode(priority);

    // 3. Deduplicate (skip if same notification in last 60s)
    const dedupKey = `${category}_${title}_${body}`;
    const recentDup = this._deliveryLog.find(
      (entry) => entry.dedupKey === dedupKey && Date.now() - entry.ts < 60000,
    );
    if (recentDup) return { delivered: false, reason: 'duplicate' };

    // 4. Build notification payload
    const payload = {
      title,
      body,
      data: {
        ...data,
        category,
        priority,
        deep_link: deepLink?.url || deepLink?.customSchemeUrl || null,
      },
      timestamp: Date.now(),
    };

    // 5. Deliver based on mode
    const results = [];

    switch (deliveryMode) {
      case DeliveryMode.PUSH:
        results.push(await this._deliverPush(payload));
        break;

      case DeliveryMode.PREFERRED:
        if (this._preferredChannel) {
          results.push(await this._deliverToChannel(this._preferredChannel, payload));
        } else {
          results.push(await this._deliverPush(payload));
        }
        break;

      case DeliveryMode.ORIGIN:
        const originChannel = data?.source_channel;
        if (originChannel) {
          results.push(await this._deliverToChannel(originChannel, payload));
        } else {
          results.push(await this._deliverPush(payload));
        }
        break;

      case DeliveryMode.ALL:
        // Push + all bound channels
        results.push(await this._deliverPush(payload));
        for (const binding of this._boundChannels) {
          if (binding.is_active) {
            results.push(await this._deliverToChannel(binding.channel_type, payload));
          }
        }
        break;

      case DeliveryMode.SILENT:
        // Badge update only
        this._incrementBadge();
        results.push({ channel: 'badge', success: true });
        break;

      default:
        results.push(await this._deliverPush(payload));
    }

    // 6. Always update badge
    this._incrementBadge();

    // 7. Log delivery
    this._logDelivery({ dedupKey, category, mode: deliveryMode, results, ts: Date.now() });

    // 8. Emit to local listeners
    this._emit('delivered', { notification, results, mode: deliveryMode });

    return { delivered: true, mode: deliveryMode, results };
  }

  // ── Delivery Methods ──────────────────────────────────────────────────────

  /**
   * Deliver via native FCM push.
   */
  async _deliverPush(payload) {
    try {
      // Emit to DeviceEventEmitter for native handler to display
      DeviceEventEmitter.emit('showLocalNotification', {
        title: payload.title,
        body: payload.body,
        data: payload.data,
        channelId: 'wamp_events_channel', // Matches AndroidManifest
      });
      return { channel: 'push', success: true };
    } catch (err) {
      return { channel: 'push', success: false, error: err.message };
    }
  }

  /**
   * Deliver to a specific channel via backend API.
   */
  async _deliverToChannel(channelType, payload) {
    try {
      const channelInfo = CHANNEL_CATALOG[channelType];
      if (!channelInfo) return { channel: channelType, success: false, error: 'Unknown channel' };

      // Truncate to channel's max length
      const maxLen = channelInfo.capabilities?.maxLength || 2000;
      const content = `**${payload.title}**\n${payload.body}`.substring(0, maxLen);

      // Route through backend
      const res = await channelsApi.sendNotification?.({
        channel_type: channelType,
        title: payload.title,
        body: payload.body,
        content,
        data: payload.data,
      });

      return { channel: channelType, success: res?.success !== false };
    } catch (err) {
      return { channel: channelType, success: false, error: err.message };
    }
  }

  // ── Priority → Delivery Mode Mapping ──────────────────────────────────────

  _getDeliveryMode(priority) {
    switch (priority) {
      case Priority.CRITICAL: return DeliveryMode.ALL;
      case Priority.HIGH: return DeliveryMode.PUSH;
      case Priority.MEDIUM: return DeliveryMode.PREFERRED;
      case Priority.LOW: return DeliveryMode.SILENT;
      default: return DeliveryMode.PUSH;
    }
  }

  // ── Quiet Hours ───────────────────────────────────────────────────────────

  _isQuietHours() {
    if (!this._quietHours.enabled) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = this._quietHours.start.split(':').map(Number);
    const [endH, endM] = this._quietHours.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    // Overnight quiet hours (e.g., 22:00 → 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  _queueForLater(notification) {
    // Store for delivery when quiet hours end
    this._emit('queued', { notification, reason: 'quiet_hours' });
  }

  // ── Badge Management ──────────────────────────────────────────────────────

  _incrementBadge() {
    this._badgeCount++;
    this._emit('badge_update', { count: this._badgeCount });
    // Persist
    AsyncStorage.setItem(STORAGE.BADGE_COUNT, String(this._badgeCount)).catch(() => {});
    // Update native badge via NativeModules if available
    try {
      NativeModules.NotificationBadge?.setBadge?.(this._badgeCount);
    } catch {}
  }

  resetBadge() {
    this._badgeCount = 0;
    this._emit('badge_update', { count: 0 });
    AsyncStorage.setItem(STORAGE.BADGE_COUNT, '0').catch(() => {});
    try {
      NativeModules.NotificationBadge?.setBadge?.(0);
    } catch {}
  }

  getBadgeCount() {
    return this._badgeCount;
  }

  // ── Channel Bindings ──────────────────────────────────────────────────────

  async _refreshBindings() {
    try {
      const res = await channelsApi.bindings();
      const bindings = res?.data || [];
      this._boundChannels = bindings;
      this._preferredChannel = bindings.find((b) => b.is_preferred)?.channel_type || null;
    } catch {
      // silent
    }
  }

  getPreferredChannel() {
    return this._preferredChannel;
  }

  getBoundChannels() {
    return [...this._boundChannels];
  }

  // ── Preferences ───────────────────────────────────────────────────────────

  async _loadPreferences() {
    try {
      const prefsStr = await AsyncStorage.getItem(STORAGE.ROUTING_PREFS);
      if (prefsStr) {
        const prefs = JSON.parse(prefsStr);
        // Apply category overrides
        if (prefs.categoryOverrides) {
          Object.entries(prefs.categoryOverrides).forEach(([cat, mode]) => {
            this._categoryOverrides.set(cat, mode);
          });
        }
      }

      const quietStr = await AsyncStorage.getItem(STORAGE.QUIET_HOURS);
      if (quietStr) {
        this._quietHours = { ...DEFAULT_QUIET_HOURS, ...JSON.parse(quietStr) };
      }

      const badgeStr = await AsyncStorage.getItem(STORAGE.BADGE_COUNT);
      if (badgeStr) this._badgeCount = parseInt(badgeStr, 10) || 0;
    } catch {
      // silent
    }
  }

  /**
   * Set delivery mode override for a notification category.
   */
  async setCategoryDelivery(categoryId, deliveryMode) {
    this._categoryOverrides.set(categoryId, deliveryMode);
    await this._savePreferences();
  }

  /**
   * Set quiet hours configuration.
   */
  async setQuietHours(config) {
    this._quietHours = { ...this._quietHours, ...config };
    await AsyncStorage.setItem(STORAGE.QUIET_HOURS, JSON.stringify(this._quietHours));
  }

  getQuietHours() {
    return { ...this._quietHours };
  }

  async _savePreferences() {
    try {
      const prefs = {
        categoryOverrides: Object.fromEntries(this._categoryOverrides),
      };
      await AsyncStorage.setItem(STORAGE.ROUTING_PREFS, JSON.stringify(prefs));
    } catch {
      // silent
    }
  }

  // ── Delivery Logging ──────────────────────────────────────────────────────

  _logDelivery(entry) {
    this._deliveryLog.push(entry);
    // Keep last 100
    if (this._deliveryLog.length > 100) {
      this._deliveryLog = this._deliveryLog.slice(-100);
    }
  }

  getDeliveryLog() {
    return [...this._deliveryLog];
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
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    this._listeners.clear();
    this._categoryOverrides.clear();
    this._deliveryLog = [];
    this._initialized = false;
  }
}

const notificationRouter = new NotificationRouter();
export { DeliveryMode, Priority };
export default notificationRouter;
