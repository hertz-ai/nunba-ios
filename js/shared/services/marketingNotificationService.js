/**
 * Marketing Notification Service — Flywheel Triggers + Push Routing
 *
 * Integrates the Hevolve.ai campaign system (campaignsApi, referralsApi, resonanceApi)
 * with the Nunba-HART channel routing patterns to deliver marketing notifications
 * through the user's preferred channel.
 *
 * Flywheel Triggers:
 *   - Engagement:  streak reminders, trending content, achievement unlocks, daily checkin
 *   - Campaign:    referral rewards, milestone notifications, seasonal promotions
 *   - Re-engagement: inactive user nudges, comeback rewards, content digests
 *   - Channel:     cross-channel sync, channel binding confirmations, typing indicators
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, DeviceEventEmitter } from 'react-native';
import { notificationsApi, resonanceApi, referralsApi, campaignsApi } from './socialApi';
import realtimeService from './realtimeService';
import deepLinkService, { CAMPAIGN_LINK_TYPES } from './deepLinkService';

// ── Notification Categories ───────────────────────────────────────────────────
const NOTIFICATION_CATEGORIES = {
  // Engagement triggers
  STREAK_REMINDER:      { id: 'streak_reminder',      priority: 'high',   channel: 'push' },
  DAILY_CHECKIN:        { id: 'daily_checkin',         priority: 'medium', channel: 'push' },
  TRENDING_CONTENT:     { id: 'trending_content',      priority: 'low',    channel: 'push' },
  ACHIEVEMENT_UNLOCK:   { id: 'achievement_unlock',    priority: 'high',   channel: 'all' },
  LEVEL_UP:             { id: 'level_up',              priority: 'high',   channel: 'all' },
  RESONANCE_MILESTONE:  { id: 'resonance_milestone',   priority: 'medium', channel: 'push' },

  // Campaign triggers
  REFERRAL_REWARD:      { id: 'referral_reward',       priority: 'high',   channel: 'all' },
  REFERRAL_SIGNUP:      { id: 'referral_signup',       priority: 'high',   channel: 'push' },
  CAMPAIGN_MILESTONE:   { id: 'campaign_milestone',    priority: 'medium', channel: 'push' },
  SEASONAL_PROMO:       { id: 'seasonal_promo',        priority: 'low',    channel: 'push' },
  NEW_FEATURE:          { id: 'new_feature',           priority: 'medium', channel: 'push' },

  // Re-engagement triggers
  COMEBACK_REWARD:      { id: 'comeback_reward',       priority: 'high',   channel: 'all' },
  CONTENT_DIGEST:       { id: 'content_digest',        priority: 'low',    channel: 'preferred' },
  MISSED_ACTIVITY:      { id: 'missed_activity',       priority: 'medium', channel: 'push' },
  FRIEND_ACTIVITY:      { id: 'friend_activity',       priority: 'low',    channel: 'push' },

  // Channel triggers
  CHANNEL_BOUND:        { id: 'channel_bound',         priority: 'high',   channel: 'push' },
  CHANNEL_MESSAGE:      { id: 'channel_message',       priority: 'medium', channel: 'origin' },
  CROSS_CHANNEL_SYNC:   { id: 'cross_channel_sync',    priority: 'low',    channel: 'all' },

  // Social triggers
  NEW_FOLLOWER:         { id: 'new_follower',          priority: 'medium', channel: 'push' },
  POST_UPVOTE:          { id: 'post_upvote',           priority: 'low',    channel: 'push' },
  COMMENT_REPLY:        { id: 'comment_reply',         priority: 'high',   channel: 'push' },
  MENTION:              { id: 'mention',               priority: 'high',   channel: 'all' },
};

// ── Engagement Scoring ────────────────────────────────────────────────────────
const ENGAGEMENT_WEIGHTS = {
  post_created: 10,
  comment_created: 5,
  upvote_given: 2,
  share_created: 8,
  referral_sent: 15,
  daily_checkin: 3,
  game_played: 7,
  challenge_completed: 12,
  achievement_unlocked: 20,
  channel_message_sent: 4,
};

// ── Storage Keys ──────────────────────────────────────────────────────────────
const STORAGE = {
  LAST_CHECKIN: 'hevolve_last_checkin',
  STREAK_COUNT: 'hevolve_streak_count',
  ENGAGEMENT_LOG: 'hevolve_engagement_log',
  NOTIFICATION_PREFS: 'hevolve_notification_prefs',
  LAST_DIGEST: 'hevolve_last_digest',
  SUPPRESSED_UNTIL: 'hevolve_suppressed_until',
};

// ── Marketing Notification Service ────────────────────────────────────────────
class MarketingNotificationService {
  constructor() {
    this._initialized = false;
    this._engagementScore = 0;
    this._handlers = new Map();
    this._suppressedCategories = new Set();
  }

  /**
   * Initialize the service. Connect to WAMP for real-time triggers.
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Listen for real-time marketing events from WAMP
    realtimeService.on('notification', (data) => this._handleRealtimeNotification(data));
    realtimeService.on('achievement', (data) => this._onAchievementUnlock(data));
    realtimeService.on('resonance_update', (data) => this._onResonanceUpdate(data));
    realtimeService.on('referral_event', (data) => this._onReferralEvent(data));
    realtimeService.on('campaign_event', (data) => this._onCampaignEvent(data));
    realtimeService.on('channel_message', (data) => this._onChannelMessage(data));

    // Initialize engagement tracking
    this._loadEngagementState();
  }

  // ── Flywheel Trigger Handlers ───────────────────────────────────────────

  /**
   * Track a user engagement action for the flywheel scoring.
   */
  async trackEngagement(action, metadata = {}) {
    const weight = ENGAGEMENT_WEIGHTS[action] || 1;
    this._engagementScore += weight;

    try {
      const logStr = await AsyncStorage.getItem(STORAGE.ENGAGEMENT_LOG);
      const log = logStr ? JSON.parse(logStr) : [];
      log.push({ action, weight, metadata, ts: Date.now() });
      // Keep last 200 entries
      await AsyncStorage.setItem(STORAGE.ENGAGEMENT_LOG, JSON.stringify(log.slice(-200)));
    } catch {
      // silent
    }

    // Check for milestone triggers
    this._checkEngagementMilestones();
  }

  /**
   * Daily check-in trigger. Call from app foreground handler.
   */
  async triggerDailyCheckin() {
    try {
      const lastCheckin = await AsyncStorage.getItem(STORAGE.LAST_CHECKIN);
      const today = new Date().toDateString();

      if (lastCheckin === today) return false; // Already checked in

      await AsyncStorage.setItem(STORAGE.LAST_CHECKIN, today);

      // Update streak
      const streakStr = await AsyncStorage.getItem(STORAGE.STREAK_COUNT);
      let streak = streakStr ? parseInt(streakStr, 10) : 0;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const wasYesterday = lastCheckin === yesterday.toDateString();

      streak = wasYesterday ? streak + 1 : 1;
      await AsyncStorage.setItem(STORAGE.STREAK_COUNT, String(streak));

      // Backend sync
      resonanceApi.dailyCheckin().catch(() => {});

      // Track engagement
      this.trackEngagement('daily_checkin', { streak });

      // Streak milestone notifications
      if ([3, 7, 14, 30, 50, 100].includes(streak)) {
        this._emitNotification(NOTIFICATION_CATEGORIES.STREAK_REMINDER, {
          title: `${streak}-day streak!`,
          body: `You're on fire! Keep your ${streak}-day streak going.`,
          data: { streak, type: 'streak_milestone' },
        });
      }

      return { streak, isNew: true };
    } catch {
      return false;
    }
  }

  /**
   * Check if user should receive re-engagement notification.
   * Call periodically from background task or app resume.
   */
  async checkReengagement() {
    try {
      const lastCheckin = await AsyncStorage.getItem(STORAGE.LAST_CHECKIN);
      if (!lastCheckin) return;

      const daysSinceCheckin = Math.floor(
        (Date.now() - new Date(lastCheckin).getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceCheckin >= 3 && daysSinceCheckin < 7) {
        this._emitNotification(NOTIFICATION_CATEGORIES.MISSED_ACTIVITY, {
          title: "We miss you!",
          body: "Your community has been active. Come see what's new.",
          data: { type: 're_engagement', days_inactive: daysSinceCheckin },
          deepLink: deepLinkService.createCampaignLink('re_engage_3d', {
            source: 'push', medium: 'notification', content: 'missed_3d',
          }),
        });
      } else if (daysSinceCheckin >= 7) {
        this._emitNotification(NOTIFICATION_CATEGORIES.COMEBACK_REWARD, {
          title: "Welcome back bonus waiting!",
          body: `You've been away ${daysSinceCheckin} days. Claim your comeback reward!`,
          data: { type: 're_engagement', days_inactive: daysSinceCheckin, has_reward: true },
          deepLink: deepLinkService.createCampaignLink('comeback_reward', {
            source: 'push', medium: 'notification', content: `comeback_${daysSinceCheckin}d`,
          }),
        });
      }
    } catch {
      // silent
    }
  }

  // ── Real-time Event Handlers (from WAMP) ────────────────────────────────

  _handleRealtimeNotification(data) {
    const type = data?.type || data?.notification_type;
    const category = this._mapNotificationType(type);
    if (category) {
      this._emitNotification(category, {
        title: data?.title || 'Hevolve',
        body: data?.message || data?.body || '',
        data,
      });
    }
  }

  _onAchievementUnlock(data) {
    this._emitNotification(NOTIFICATION_CATEGORIES.ACHIEVEMENT_UNLOCK, {
      title: 'Achievement Unlocked!',
      body: data?.name || data?.title || 'You earned a new achievement!',
      data: { ...data, type: 'achievement' },
    });
    this.trackEngagement('achievement_unlocked', data);
  }

  _onResonanceUpdate(data) {
    const amount = data?.amount || 0;
    if (amount > 0) {
      // Check for milestones
      const milestones = [100, 500, 1000, 5000, 10000];
      const total = data?.total || 0;
      const prevTotal = total - amount;
      const crossed = milestones.find((m) => prevTotal < m && total >= m);
      if (crossed) {
        this._emitNotification(NOTIFICATION_CATEGORIES.RESONANCE_MILESTONE, {
          title: `${crossed} Resonance reached!`,
          body: `You've accumulated ${crossed} resonance points. Keep contributing!`,
          data: { milestone: crossed, total },
        });
      }
    }
  }

  _onReferralEvent(data) {
    const eventType = data?.event_type || data?.type;
    if (eventType === 'signup') {
      this._emitNotification(NOTIFICATION_CATEGORIES.REFERRAL_SIGNUP, {
        title: 'Referral success!',
        body: `${data?.referred_name || 'Someone'} joined through your invite!`,
        data,
      });
    } else if (eventType === 'reward') {
      this._emitNotification(NOTIFICATION_CATEGORIES.REFERRAL_REWARD, {
        title: 'Referral reward earned!',
        body: `You earned ${data?.reward_amount || ''} resonance from a referral.`,
        data,
      });
    }
    this.trackEngagement('referral_sent', data);
  }

  _onCampaignEvent(data) {
    const eventType = data?.event_type || data?.type;
    if (eventType === 'milestone') {
      this._emitNotification(NOTIFICATION_CATEGORIES.CAMPAIGN_MILESTONE, {
        title: 'Campaign milestone!',
        body: data?.message || `Your campaign "${data?.campaign_name}" hit a milestone!`,
        data,
      });
    }
  }

  _onChannelMessage(data) {
    this._emitNotification(NOTIFICATION_CATEGORIES.CHANNEL_MESSAGE, {
      title: `Message via ${data?.channel_type || 'channel'}`,
      body: data?.content?.substring(0, 100) || 'New message',
      data: {
        ...data,
        source_channel: data?.channel_type,
      },
    });
    this.trackEngagement('channel_message_sent', { channel: data?.channel_type });
  }

  // ── Notification Emission ───────────────────────────────────────────────

  _emitNotification(category, notification) {
    if (this._suppressedCategories.has(category.id)) return;

    const enriched = {
      ...notification,
      category: category.id,
      priority: category.priority,
      preferredChannel: category.channel,
      timestamp: Date.now(),
    };

    // Emit to local handlers (UI overlays, badge updates, etc.)
    const handlers = this._handlers.get(category.id) || [];
    handlers.forEach((handler) => {
      try { handler(enriched); } catch {}
    });

    // Emit to wildcard handlers
    const wildcardHandlers = this._handlers.get('*') || [];
    wildcardHandlers.forEach((handler) => {
      try { handler(enriched); } catch {}
    });

    // Emit to DeviceEventEmitter for native notification display
    DeviceEventEmitter.emit('marketingNotification', enriched);
  }

  // ── Engagement Milestone Checks ─────────────────────────────────────────

  _checkEngagementMilestones() {
    const milestones = [50, 100, 250, 500, 1000];
    const crossed = milestones.find(
      (m) => this._engagementScore >= m && this._engagementScore - 10 < m,
    );
    if (crossed) {
      this._emitNotification(NOTIFICATION_CATEGORIES.LEVEL_UP, {
        title: 'Engagement milestone!',
        body: `You've reached ${crossed} engagement points this session!`,
        data: { score: this._engagementScore, milestone: crossed },
      });
    }
  }

  async _loadEngagementState() {
    try {
      const logStr = await AsyncStorage.getItem(STORAGE.ENGAGEMENT_LOG);
      if (logStr) {
        const log = JSON.parse(logStr);
        // Calculate score from recent entries (last 7 days)
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        this._engagementScore = log
          .filter((e) => e.ts > weekAgo)
          .reduce((sum, e) => sum + (e.weight || 0), 0);
      }
    } catch {
      // silent
    }
  }

  // ── Notification Type Mapping ───────────────────────────────────────────

  _mapNotificationType(type) {
    const map = {
      upvote: NOTIFICATION_CATEGORIES.POST_UPVOTE,
      comment: NOTIFICATION_CATEGORIES.COMMENT_REPLY,
      follow: NOTIFICATION_CATEGORIES.NEW_FOLLOWER,
      mention: NOTIFICATION_CATEGORIES.MENTION,
      achievement: NOTIFICATION_CATEGORIES.ACHIEVEMENT_UNLOCK,
      referral: NOTIFICATION_CATEGORIES.REFERRAL_SIGNUP,
      campaign: NOTIFICATION_CATEGORIES.CAMPAIGN_MILESTONE,
      streak: NOTIFICATION_CATEGORIES.STREAK_REMINDER,
      channel: NOTIFICATION_CATEGORIES.CHANNEL_MESSAGE,
      digest: NOTIFICATION_CATEGORIES.CONTENT_DIGEST,
      promo: NOTIFICATION_CATEGORIES.SEASONAL_PROMO,
    };
    return map[type] || null;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Register a handler for a notification category.
   * @param {string} categoryId - Category ID or '*' for all
   * @param {Function} handler
   * @returns {Function} unsubscribe
   */
  on(categoryId, handler) {
    if (!this._handlers.has(categoryId)) {
      this._handlers.set(categoryId, []);
    }
    this._handlers.get(categoryId).push(handler);
    return () => {
      const arr = this._handlers.get(categoryId);
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  /**
   * Suppress a notification category temporarily.
   */
  suppress(categoryId) {
    this._suppressedCategories.add(categoryId);
  }

  unsuppress(categoryId) {
    this._suppressedCategories.delete(categoryId);
  }

  /**
   * Get the current engagement score.
   */
  getEngagementScore() {
    return this._engagementScore;
  }

  /**
   * Get notification preferences.
   */
  async getPreferences() {
    try {
      const str = await AsyncStorage.getItem(STORAGE.NOTIFICATION_PREFS);
      return str ? JSON.parse(str) : {};
    } catch {
      return {};
    }
  }

  /**
   * Update notification preferences.
   */
  async setPreferences(prefs) {
    try {
      await AsyncStorage.setItem(STORAGE.NOTIFICATION_PREFS, JSON.stringify(prefs));
    } catch {
      // silent
    }
  }

  destroy() {
    this._handlers.clear();
    this._suppressedCategories.clear();
    this._initialized = false;
  }
}

const marketingNotificationService = new MarketingNotificationService();
export { NOTIFICATION_CATEGORIES, ENGAGEMENT_WEIGHTS };
export default marketingNotificationService;
