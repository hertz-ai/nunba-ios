/**
 * marketingStore — Zustand store for Marketing Flywheel state.
 *
 * Bridges marketingNotificationService + deepLinkService + notificationRouter
 * to provide reactive state for UI components.
 *
 * State includes:
 *   - Engagement scoring and streaks
 *   - Campaign attribution data
 *   - Referral tracking
 *   - Notification routing preferences
 *   - Marketing notification feed
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import marketingNotificationService, { NOTIFICATION_CATEGORIES } from './services/marketingNotificationService';
import deepLinkService from './services/deepLinkService';
import notificationRouter, { DeliveryMode } from './services/notificationRouter';
import { resonanceApi, referralsApi, campaignsApi } from './services/socialApi';

const useMarketingStore = create((set, get) => ({
  // ── Engagement State ────────────────────────────────────────────────────
  engagementScore: 0,
  streak: 0,
  lastCheckin: null,
  dailyCheckinDone: false,

  // ── Attribution State ───────────────────────────────────────────────────
  attribution: null, // Latest UTM data
  referralCode: null,
  referralStats: null,

  // ── Campaign State ──────────────────────────────────────────────────────
  activeCampaigns: [],
  campaignsLoading: false,

  // ── Notification Feed ───────────────────────────────────────────────────
  marketingNotifications: [],
  badgeCount: 0,

  // ── Routing Preferences ─────────────────────────────────────────────────
  preferredChannel: null,
  quietHours: { enabled: false, start: '22:00', end: '07:00' },

  // ── Resonance ───────────────────────────────────────────────────────────
  resonanceWallet: null,
  resonanceLevel: null,

  // ── Initialization ──────────────────────────────────────────────────────
  _initialized: false,

  init: async () => {
    if (get()._initialized) return;
    set({ _initialized: true });

    // Subscribe to marketing notification events
    marketingNotificationService.on('*', (notification) => {
      set((state) => ({
        marketingNotifications: [notification, ...state.marketingNotifications].slice(0, 50),
      }));
    });

    // Subscribe to badge updates from router
    notificationRouter.on('badge_update', ({ count }) => {
      set({ badgeCount: count });
    });

    // Load persisted state
    try {
      const streakStr = await AsyncStorage.getItem('hevolve_streak_count');
      const lastCheckin = await AsyncStorage.getItem('hevolve_last_checkin');
      const today = new Date().toDateString();

      set({
        streak: streakStr ? parseInt(streakStr, 10) : 0,
        lastCheckin,
        dailyCheckinDone: lastCheckin === today,
        engagementScore: marketingNotificationService.getEngagementScore(),
      });
    } catch {}

    // Load attribution
    const attribution = await deepLinkService.getAttribution();
    set({
      attribution: attribution.utm,
      referralCode: attribution.referralCode,
    });

    // Load routing preferences
    set({
      preferredChannel: notificationRouter.getPreferredChannel(),
      quietHours: notificationRouter.getQuietHours(),
    });

    // Fetch remote data
    get().fetchReferralStats();
    get().fetchResonance();
    get().fetchCampaigns();
  },

  // ── Engagement Actions ──────────────────────────────────────────────────

  trackEngagement: (action, metadata) => {
    marketingNotificationService.trackEngagement(action, metadata);
    set({ engagementScore: marketingNotificationService.getEngagementScore() });
  },

  performDailyCheckin: async () => {
    const result = await marketingNotificationService.triggerDailyCheckin();
    if (result && result.isNew) {
      set({
        streak: result.streak,
        dailyCheckinDone: true,
        lastCheckin: new Date().toDateString(),
      });
    }
    return result;
  },

  // ── Referral Actions ────────────────────────────────────────────────────

  fetchReferralStats: async () => {
    try {
      const res = await referralsApi.stats();
      set({ referralStats: res?.data || res });
    } catch {}
  },

  createReferralLink: async () => {
    try {
      const codeRes = await referralsApi.getCode();
      const code = codeRes?.data?.code || codeRes?.code;
      if (code) {
        set({ referralCode: code });
        return deepLinkService.createReferralLink(code);
      }
    } catch {}
    return null;
  },

  // ── Campaign Actions ────────────────────────────────────────────────────

  fetchCampaigns: async () => {
    set({ campaignsLoading: true });
    try {
      const res = await campaignsApi.list({ mine: true });
      set({ activeCampaigns: res?.data || [] });
    } catch {}
    set({ campaignsLoading: false });
  },

  // ── Resonance Actions ───────────────────────────────────────────────────

  fetchResonance: async () => {
    try {
      const [wallet, level] = await Promise.all([
        resonanceApi.getWallet(),
        resonanceApi.getLevelInfo(),
      ]);
      set({
        resonanceWallet: wallet?.data || wallet,
        resonanceLevel: level?.data || level,
      });
    } catch {}
  },

  // ── Deep Link Sharing ───────────────────────────────────────────────────

  createShareLink: async (resourceType, resourceId, options = {}) => {
    const link = await deepLinkService.createShareLink(resourceType, resourceId, options);
    if (link) {
      marketingNotificationService.trackEngagement('share_created', {
        resource_type: resourceType,
        resource_id: resourceId,
      });
    }
    return link;
  },

  createCampaignLink: (campaignId, options = {}) => {
    return deepLinkService.createCampaignLink(campaignId, options);
  },

  // ── Notification Routing ────────────────────────────────────────────────

  setPreferredChannel: async (channelType) => {
    set({ preferredChannel: channelType });
    // notificationRouter will pick this up from channel bindings
  },

  setQuietHours: async (config) => {
    await notificationRouter.setQuietHours(config);
    set({ quietHours: notificationRouter.getQuietHours() });
  },

  setCategoryDelivery: async (categoryId, mode) => {
    await notificationRouter.setCategoryDelivery(categoryId, mode);
  },

  resetBadge: () => {
    notificationRouter.resetBadge();
    set({ badgeCount: 0 });
  },

  // ── Cleanup ─────────────────────────────────────────────────────────────
  reset: () => set({
    engagementScore: 0,
    streak: 0,
    lastCheckin: null,
    dailyCheckinDone: false,
    attribution: null,
    referralCode: null,
    referralStats: null,
    activeCampaigns: [],
    marketingNotifications: [],
    badgeCount: 0,
    resonanceWallet: null,
    resonanceLevel: null,
    _initialized: false,
  }),
}));

export default useMarketingStore;
