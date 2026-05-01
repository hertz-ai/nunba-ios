import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch,
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
import { codingApi, authApi } from '../../../services/socialApi';

const CodingAgentScreen = () => {
  const navigation = useNavigation();
  const [goals, setGoals] = useState([]);
  const [optedIn, setOptedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, meRes] = await Promise.all([
        codingApi.goals(),
        authApi.me(),
      ]);
      setGoals(goalsRes.data || []);
      if (meRes.data) {
        setCurrentUser(meRes.data);
        setOptedIn(!!meRes.data.idle_compute_opt_in);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleOptInToggle = async () => {
    if (!currentUser) return;
    try {
      if (optedIn) {
        await codingApi.optOut(currentUser.id);
        setOptedIn(false);
      } else {
        await codingApi.optIn(currentUser.id);
        setOptedIn(true);
      }
    } catch (err) {
      Alert.alert('Error', err.error || 'Failed to update opt-in status');
    }
  };

  const getStatusColor = (status) => {
    const colors = { active: '#00e89d', completed: '#0078ff', paused: '#FFD700' };
    return colors[status] || '#888';
  };

  const renderGoal = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title || item.description}</Text>
            <Text style={styles.cardMeta}>
              {item.repo_url || 'No repo'} — {item.status}
            </Text>
          </View>
        </View>
        {item.description && item.title && (
          <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
        )}
      </View>
    </Animatable.View>
  );

  const renderHeader = () => (
    <Animatable.View animation="fadeIn">
      <View style={styles.optInCard}>
        <View style={styles.optInRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optInTitle}>Contribute Idle Compute</Text>
            <Text style={styles.optInDesc}>
              When your agent is idle, allow it to work on community coding goals
            </Text>
          </View>
          <Switch
            value={optedIn}
            onValueChange={handleOptInToggle}
            trackColor={{ false: '#3A3A4E', true: '#00e89d44' }}
            thumbColor={optedIn ? '#00e89d' : '#888'}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Active Goals</Text>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Coding Agent</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00e89d" />
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderGoal}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <MaterialCommunityIcons name="code-tags" size={48} color="#555" />
              <Text style={styles.emptyText}>No coding goals yet</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%') },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: hp('10%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  optInCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('2%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  optInRow: { flexDirection: 'row', alignItems: 'center' },
  optInTitle: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700', marginBottom: 2 },
  optInDesc: { color: '#888', fontSize: wp('3%') },
  sectionTitle: { color: '#FFF', fontSize: wp('4%'), fontWeight: '700', marginBottom: hp('1%') },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700' },
  cardMeta: { color: '#888', fontSize: wp('2.8%') },
  cardDesc: { color: '#AAA', fontSize: wp('3.2%'), marginTop: 8 },
});

export default CodingAgentScreen;
