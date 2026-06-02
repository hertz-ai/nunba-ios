import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { notificationsApi } from '../../../services/socialApi';
import useNotificationStore from '../../../notificationStore';
import EmptyState from '../../shared/EmptyState';
import { emptyStatePreset } from '../../shared/emptyStatePresets';
import { flatListVirtualizationProps } from '../../shared/listPerf';

// Fixed row height for notification rows on Galaxy S22+ — avatar(40) +
// 24px padding + 1px separator.  Same source-of-truth pattern as
// InboxScreen + FriendsScreen.
const NOTIFICATION_ROW_HEIGHT = 65;

const ICON_MAP = {
  upvote: { name: 'arrow-up-bold', color: '#6C63FF' },
  comment: { name: 'comment-text', color: '#0078ff' },
  follow: { name: 'account-plus', color: '#9D4EDD' },
  mention: { name: 'at', color: '#FF6B35' },
  achievement: { name: 'trophy', color: '#FFD700' },
  task: { name: 'clipboard-check', color: '#00D9FF' },
  default: { name: 'bell', color: '#888' },
};

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const markAllReadStore = useNotificationStore((s) => s.markAllRead);
  const markReadStore = useNotificationStore((s) => s.markRead);
  // Subscribe to the store so async init() cache restore + realtime events
  // both flow through.  Render the union of remote+local (set by fetch)
  // and store (set by init()/realtime).  Verified live 2026-06-02: relaunch
  // empty-state regression was caused by relying on local-only state.
  const storeNotifications = useNotificationStore((s) => s.notifications);
  const effectiveNotifications =
    notifications.length > 0 ? notifications : (storeNotifications || []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ limit: 50 });
      const remote = Array.isArray(res?.data) ? res.data : [];
      if (remote.length > 0) {
        setNotifications(remote);
      } else {
        // API empty / offline → restore from the Zustand store, which
        // has already rehydrated from AsyncStorage in init().
        // Verified live 2026-06-02: without this fallback, force-stop +
        // relaunch reverted to empty state even when the cache held
        // an injected/real notification.
        const cached = useNotificationStore.getState().notifications;
        setNotifications(Array.isArray(cached) ? cached : []);
      }
    } catch {
      const cached = useNotificationStore.getState().notifications;
      setNotifications(Array.isArray(cached) ? cached : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      markAllReadStore(); // Sync badge count in store
    } catch {
      // silent
    }
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.is_read) {
      try {
        await notificationsApi.markRead([notification.id]);
        setNotifications(prev => prev.map(n =>
          n.id === notification.id ? { ...n, is_read: true } : n
        ));
        markReadStore(notification.id); // Sync badge count in store
      } catch {
        // silent
      }
    }
  };

  const getIcon = (type) => ICON_MAP[type] || ICON_MAP.default;

  const renderItem = ({ item }) => {
    const icon = getIcon(item.type);
    // Plain View (not Animatable.View) — react-native-animatable 1.4.0's
    // fadeInUp leaves the wrapped node at opacity 0 on RN 0.81+, hiding the
    // entire row. Verified live 2026-06-02.
    return (
      <View>
        <TouchableOpacity
          style={[styles.notifCard, !item.is_read && styles.notifUnread]}
          activeOpacity={0.7}
          onPress={() => handleNotificationPress(item)}
        >
          <View style={[styles.iconBg, { backgroundColor: icon.color + '22' }]}>
            <MaterialCommunityIcons name={icon.name} size={20} color={icon.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifText} numberOfLines={2}>{item.message || item.content}</Text>
            <Text style={styles.notifTime}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
          </View>
          {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          {/* Dev/QA test inject — fires the store reducer that also
              runs for live WAMP notification events.  Used to verify
              badge + persistence on a single device without a
              server-side WAMP publisher.  Visible in devRelease so
              ADB-driven QA can drive it; remove before prod ship.
              Tracked under verification_status_2026_06_02.md. */}
          {true ? (
            <TouchableOpacity
              accessibilityLabel="Inject test notification"
              onPress={() => {
                const inject = useNotificationStore.getState().testInject;
                if (inject) {
                  inject({});
                  // Reflect into local list immediately too so the empty
                  // state flips without waiting for a refresh.
                  setNotifications(prev => [
                    {
                      id: 'test-' + Date.now(),
                      type: 'mention',
                      title: 'TestSender',
                      message: 'Test notification — verify badge + persistence',
                      created_at: new Date().toISOString(),
                      is_read: false,
                    },
                    ...prev,
                  ]);
                }
              }}
              onLongPress={() => {
                // Long-press the test button to fire a CONSENT request
                // through fleetCommandStore — verifies AgentConsentOverlay
                // surfaces and accepts/denies on a single device with
                // no fleet command server.
                try {
                  const useFleetCommandStore = require('../../../fleetCommandStore').default;
                  useFleetCommandStore.getState().addConsent({
                    commandId: 'test-consent-' + Date.now(),
                    action: 'agent_use_camera',
                    agentId: 'test-agent',
                    description: 'Test agent wants to use the camera for 30s — Accept or Decline.',
                    timeoutS: 30,
                  });
                } catch (e) {}
              }}
              style={{paddingHorizontal: 8}}
            >
              <Ionicons name="add-circle-outline" size={24} color="#FFD700" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Ionicons name="checkmark-done" size={24} color="#6C63FF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={effectiveNotifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          // UX-AUDIT 2026-05-19: P7 preset + P10 virtualization wires.
          ListEmptyComponent={<EmptyState {...emptyStatePreset('no-notifications')} />}
          {...flatListVirtualizationProps(NOTIFICATION_ROW_HEIGHT)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%'),
  },
  backButton: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: wp('5%'), fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: hp('15%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  notifCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#141225',
    borderRadius: 12, padding: wp('3.5%'), marginBottom: hp('1%'),
    borderWidth: 1, borderColor: '#2A2A2A', gap: 12,
  },
  notifUnread: { borderColor: '#6C63FF44', backgroundColor: '#1A1F1A' },
  iconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  notifText: { color: '#FFF', fontSize: wp('3.5%'), marginBottom: 2 },
  notifTime: { color: '#888', fontSize: wp('2.8%') },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6C63FF' },
});

export default NotificationsScreen;
