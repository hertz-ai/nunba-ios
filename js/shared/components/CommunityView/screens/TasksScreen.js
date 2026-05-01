import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator, Alert, Modal,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { tasksApi } from '../../../services/socialApi';

const STATUS_COLORS = {
  open: '#0078ff',
  assigned: '#FFD700',
  completed: '#00e89d',
  cancelled: '#888',
};

const TasksScreen = () => {
  const navigation = useNavigation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      const res = await tasksApi.list({ limit: 50 });
      setTasks(res.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  }, [fetchTasks]);

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    try {
      await tasksApi.create({ title: newTitle, description: newDesc });
      setNewTitle('');
      setNewDesc('');
      setShowCreate(false);
      fetchTasks();
    } catch (err) {
      Alert.alert('Error', err.error || 'Failed to create task');
    }
  };

  const handleComplete = async (id) => {
    try {
      await tasksApi.complete(id, {});
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' } : t));
    } catch (err) {
      const msg = err.error || 'Failed to complete task';
      Alert.alert('Not authorized', msg.includes('403') || msg.includes('authorized') ? 'You are not authorized to complete this task' : msg);
    }
  };

  const renderItem = ({ item, index }) => {
    const statusColor = STATUS_COLORS[item.status] || '#888';
    return (
      <Animatable.View animation="fadeInUp" delay={index * 50}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.status} — Requester: {item.requester_name || 'Unknown'}
                {item.assignee_name ? ` — Assigned: ${item.assignee_name}` : ''}
              </Text>
            </View>
          </View>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          {item.status !== 'completed' && item.status !== 'cancelled' && (
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.completeBtn} onPress={() => handleComplete(item.id)}>
                <Ionicons name="checkmark-circle" size={16} color="#00e89d" />
                <Text style={styles.completeText}>Complete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
        <Text style={styles.headerTitle}>Tasks</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00e89d" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#555" />
              <Text style={styles.emptyText}>No tasks yet</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
          }
        />
      )}

      {/* Create Task FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
        <MaterialCommunityIcons name="plus" size={28} color="#121212" />
      </TouchableOpacity>

      {/* Create Task Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Task</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Task title"
              placeholderTextColor="#666"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={[styles.modalInput, { height: hp('12%') }]}
              placeholder="Description (optional)"
              placeholderTextColor="#666"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCreateBtn} onPress={handleCreateTask}>
                <Text style={styles.modalCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%') },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: hp('15%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('12%') },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700' },
  cardMeta: { color: '#888', fontSize: wp('2.8%') },
  cardDesc: { color: '#AAA', fontSize: wp('3.2%'), marginTop: 4, marginBottom: 4 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  completeText: { color: '#00e89d', fontWeight: '600', fontSize: wp('3%') },
  fab: {
    position: 'absolute', bottom: hp('3%'), right: wp('5%'),
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#00e89d',
    justifyContent: 'center', alignItems: 'center', elevation: 6,
    shadowColor: '#00e89d', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: wp('5%') },
  modalContent: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: wp('5%') },
  modalTitle: { color: '#FFF', fontSize: wp('5%'), fontWeight: '700', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#121212', borderRadius: 12, padding: wp('3.5%'), color: '#FFF',
    fontSize: wp('3.5%'), marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2A',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancelBtn: { paddingHorizontal: wp('4%'), paddingVertical: hp('1%') },
  modalCancelText: { color: '#888', fontWeight: '600' },
  modalCreateBtn: { paddingHorizontal: wp('6%'), paddingVertical: hp('1%'), borderRadius: 20, backgroundColor: '#00e89d' },
  modalCreateText: { color: '#121212', fontWeight: '700' },
});

export default TasksScreen;
