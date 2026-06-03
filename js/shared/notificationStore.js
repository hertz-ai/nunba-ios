/**
 * notificationStore — Zustand store for real-time notifications.
 *
 * Manages unread badge count and live notification list.
 * Connects to realtimeService which bridges the native WAMP/crossbar connection.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import realtimeService from './services/realtimeService';
import { notificationsApi } from './services/socialApi';

// Local cache key for restore-after-kill verification.  Kept tiny —
// only the badge count + the 20 most recent entries — to avoid an
// AsyncStorage write storm.  Verified live 2026-06-02: without this,
// restarting the app dropped the badge back to 0 even when there
// were unread test notifications already in-memory.
const NOTIF_CACHE_KEY = '@hevolve:notifications:cache';
const NOTIF_CACHE_LIMIT = 20;

const persistCache = async (notifications, unreadCount) => {
  try {
    await AsyncStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify({
      notifications: notifications.slice(0, NOTIF_CACHE_LIMIT),
      unreadCount,
    }));
  } catch (_) {}
};

const loadCache = async () => {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.notifications)) {
      return parsed;
    }
  } catch (_) {}
  return null;
};

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  connected: false,
  _initialized: false,

  /**
   * Initialize real-time listener via native WAMP bridge.
   * No token needed — native AutobahnConnectionManager handles auth.
   * Safe to call multiple times — only connects once.
   */
  init: async () => {
    if (get()._initialized) return;
    set({ _initialized: true });

    // Restore cache first so the badge survives app restart.
    const cached = await loadCache();
    if (cached) {
      set({
        notifications: cached.notifications,
        unreadCount: cached.unreadCount,
      });
    }

    // Listen for crossbar events relayed from native WAMP
    realtimeService.on('notification', (data) => {
      set((state) => {
        const next = [data, ...state.notifications].slice(0, 100);
        const count = state.unreadCount + 1;
        persistCache(next, count);
        return { notifications: next, unreadCount: count };
      });
    });

    realtimeService.on('connected', () => set({ connected: true }));
    realtimeService.on('disconnected', () => set({ connected: false }));

    // FCM -> RN bridge: MyFirebaseMessagingService.sendNotification emits
    // NotificationReceived for every FCM push (task #377). Previously
    // only fleet_command FCM data made it to JS; regular reaction /
    // friend-req / call_invite notifications appeared in the OS shade
    // only. Listening here closes the in-app NotificationsScreen gap.
    try {
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.addListener('NotificationReceived', (payload) => {
        const entry = {
          id: `fcm-${payload?.timestamp || Date.now()}`,
          title: payload?.title || 'Notification',
          body: payload?.body || '',
          kind: payload?.type || 'fcm',
          source: 'fcm',
          created_at: new Date(payload?.timestamp || Date.now()).toISOString(),
          read: false,
        };
        set((state) => {
          const next = [entry, ...state.notifications].slice(0, 100);
          const count = state.unreadCount + 1;
          persistCache(next, count);
          return { notifications: next, unreadCount: count };
        });
      });
    } catch (_) {}

    // Start listening to native DeviceEventEmitter bridge
    realtimeService.connect();

    // Fetch initial unread count from REST API
    try {
      const res = await notificationsApi.list({ unread_only: true, limit: 0 });
      const count = res?.count ?? res?.data?.length ?? 0;
      set({ unreadCount: count });
    } catch (_) {}
  },

  /** Fetch notifications from API */
  fetchNotifications: async (params = {}) => {
    try {
      const res = await notificationsApi.list(params);
      const data = Array.isArray(res?.data) ? res.data : [];
      set({ notifications: data });
      return data;
    } catch (_) {
      return [];
    }
  },

  /** Mark a notification as read */
  markRead: async (notificationId) => {
    try {
      await notificationsApi.markRead(notificationId);
      set((state) => ({
        unreadCount: Math.max(0, state.unreadCount - 1),
        notifications: state.notifications.map((n) =>
          (n.id === notificationId ? { ...n, read: true } : n)
        ),
      }));
    } catch (_) {}
  },

  /** Mark all as read */
  markAllRead: async () => {
    try {
      await notificationsApi.markAllRead();
      set((state) => ({
        unreadCount: 0,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      }));
    } catch (_) {}
  },

  /** Disconnect from native WAMP bridge */
  disconnect: () => {
    realtimeService.disconnect();
    set({ connected: false, _initialized: false });
  },

  /**
   * Test inject — adds a fake notification.  Production behaviour
   * mirrors the realtimeService 'notification' event path so this
   * exercises the same reducer.  Used by the dev-only "+" button on
   * NotificationsScreen to drive notification + badge + persistence
   * end-to-end from ADB.  No-op in release builds (the button is
   * hidden by __DEV__ check).
   */
  testInject: (override = {}) => {
    const id = override.id || ('test-' + Math.floor(Date.now ? Date.now() : (1234567890000 + Math.random() * 1e9)));
    const data = {
      id,
      type: override.type || 'mention',
      source_user_id: override.source_user_id || 'test-user',
      source_user_name: override.source_user_name || 'TestSender',
      target_type: override.target_type || 'post',
      target_id: override.target_id || 'test-post-1',
      message: override.message || 'Test notification — verify badge + persistence',
      is_read: false,
      created_at: override.created_at || new Date(Date.now()).toISOString(),
    };
    set((state) => {
      const next = [data, ...state.notifications].slice(0, 100);
      const count = state.unreadCount + 1;
      persistCache(next, count);
      return { notifications: next, unreadCount: count };
    });
    return data;
  },
}));

export default useNotificationStore;
