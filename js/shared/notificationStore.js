/**
 * notificationStore — Zustand store for real-time notifications.
 *
 * Manages unread badge count and live notification list.
 * Connects to realtimeService which bridges the native WAMP/crossbar connection.
 */

import { create } from 'zustand';
import realtimeService from './services/realtimeService';
import { notificationsApi } from './services/socialApi';

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

    // Listen for crossbar events relayed from native WAMP
    realtimeService.on('notification', (data) => {
      set((state) => ({
        notifications: [data, ...state.notifications].slice(0, 100),
        unreadCount: state.unreadCount + 1,
      }));
    });

    realtimeService.on('connected', () => set({ connected: true }));
    realtimeService.on('disconnected', () => set({ connected: false }));

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
}));

export default useNotificationStore;
