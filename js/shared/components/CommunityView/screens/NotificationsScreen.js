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

const ICON_MAP = {
  upvote: { name: 'arrow-up-bold', color: '#00e89d' },
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

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ limit: 50 });
      setNotifications(res.data || []);
    } catch {
      // silent
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

  const renderItem = ({ item, index }) => {
    const icon = getIcon(item.type);
    return (
      <Animatable.View animation="fadeInUp" delay={index * 30}>
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
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Ionicons name="checkmark-done" size={24} color="#00e89d" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00e89d" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <MaterialCommunityIcons name="bell-off" size={48} color="#555" />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: wp('3.5%'), marginBottom: hp('1%'),
    borderWidth: 1, borderColor: '#2A2A2A', gap: 12,
  },
  notifUnread: { borderColor: '#00e89d44', backgroundColor: '#1A1F1A' },
  iconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  notifText: { color: '#FFF', fontSize: wp('3.5%'), marginBottom: 2 },
  notifTime: { color: '#888', fontSize: wp('2.8%') },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00e89d' },
});

export default NotificationsScreen;
