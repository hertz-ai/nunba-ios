import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import useChannelStore from '../../../channelStore';

const CHANNEL_COLORS = {
  whatsapp: '#25D366',
  telegram: '#0088cc',
  discord: '#5865F2',
  slack: '#4A154B',
  email: '#EA4335',
  sms: '#00e89d',
  webhook: '#FF6B35',
  default: '#6C63FF',
};

const getChannelColor = (channel) =>
  CHANNEL_COLORS[(channel || '').toLowerCase()] || CHANNEL_COLORS.default;

const CHANNEL_ICONS = {
  whatsapp: 'whatsapp',
  telegram: 'telegram',
  discord: 'discord',
  slack: 'slack',
  email: 'email-outline',
  sms: 'message-text-outline',
  webhook: 'webhook',
  default: 'connection',
};

const getChannelIcon = (channel) =>
  CHANNEL_ICONS[(channel || '').toLowerCase()] || CHANNEL_ICONS.default;

const ChannelBindingsScreen = () => {
  const navigation = useNavigation();
  const bindings = useChannelStore((s) => s.bindings);
  const bindingsLoading = useChannelStore((s) => s.bindingsLoading);
  const fetchBindings = useChannelStore((s) => s.fetchBindings);
  const removeBinding = useChannelStore((s) => s.removeBinding);
  const setPreferred = useChannelStore((s) => s.setPreferred);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBindings();
  }, [fetchBindings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBindings();
    setRefreshing(false);
  }, [fetchBindings]);

  const handleRemove = (item) => {
    Alert.alert(
      'Remove Channel',
      `Disconnect ${item.channel_name || item.channel}? You can re-add it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeBinding(item.id),
        },
      ],
    );
  };

  const handleSetPreferred = async (item) => {
    if (item.is_preferred) return;
    await setPreferred(item.id);
  };

  const renderItem = ({ item, index }) => {
    const color = getChannelColor(item.channel);
    const iconName = getChannelIcon(item.channel);
    const displayName = item.channel_name || item.channel || 'Channel';
    const statusText = item.status === 'active' ? 'Connected' : (item.status || 'Pending');
    const statusColor = item.status === 'active' ? '#00e89d' : '#888';

    return (
      <Animatable.View animation="fadeInUp" delay={index * 60}>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.iconCircle, { backgroundColor: color + '22' }]}>
              <MaterialCommunityIcons name={iconName} size={24} color={color} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{displayName}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                {item.sender_id ? (
                  <Text style={styles.senderText} numberOfLines={1}>
                    {item.sender_id}
                  </Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={styles.starBtn}
              onPress={() => handleSetPreferred(item)}
              activeOpacity={0.6}
            >
              <Ionicons
                name={item.is_preferred ? 'star' : 'star-outline'}
                size={22}
                color={item.is_preferred ? '#FFD700' : '#555'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.trashBtn}
              onPress={() => handleRemove(item)}
              activeOpacity={0.6}
            >
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0E17" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Channels</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('ChannelSetup')}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={28} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      {/* Quick actions bar */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.actionChip}
          onPress={() => navigation.navigate('ConversationHistory')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={16} color="#6C63FF" />
          <Text style={styles.actionChipText}>Chat History</Text>
        </TouchableOpacity>
      </View>

      {bindingsLoading && bindings.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={bindings}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <MaterialCommunityIcons name="connection" size={48} color="#555" />
              <Text style={styles.emptyText}>No channels connected yet</Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => navigation.navigate('ChannelSetup')}
                activeOpacity={0.7}
              >
                <Text style={styles.emptyAddBtnText}>Add Channel</Text>
              </TouchableOpacity>
            </View>
          }
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
  container: { flex: 1, backgroundColor: '#0F0E17' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%'),
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1, color: '#FFF', fontSize: wp('5%'),
    fontWeight: '700', textAlign: 'center',
  },
  addBtn: { padding: 4 },
  actionsBar: {
    flexDirection: 'row', paddingHorizontal: wp('4%'),
    marginBottom: hp('1%'),
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1A1A2E', borderRadius: 20,
    paddingHorizontal: wp('3.5%'), paddingVertical: hp('0.8%'),
    borderWidth: 1, borderColor: '#6C63FF33',
  },
  actionChipText: { color: '#6C63FF', fontSize: wp('3%'), fontWeight: '600' },
  centerContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: hp('15%'),
  },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  emptyAddBtn: {
    marginTop: hp('2%'), paddingHorizontal: wp('6%'), paddingVertical: hp('1.2%'),
    backgroundColor: '#6C63FF', borderRadius: 20,
  },
  emptyAddBtnText: { color: '#FFF', fontWeight: '700', fontSize: wp('3.2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  card: {
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A3E',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: wp('2.8%'), fontWeight: '600' },
  senderText: {
    color: '#666', fontSize: wp('2.6%'), marginLeft: 4, maxWidth: wp('25%'),
  },
  starBtn: { padding: 6 },
  trashBtn: { padding: 6 },
});

export default ChannelBindingsScreen;
