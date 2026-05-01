import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

import { dashboardApi } from '../../../services/socialApi';

const POLL_INTERVAL = 5000;

const STATUS_COLORS = {
  active: '#10B981', executing: '#3B82F6', healthy: '#10B981',
  stalled: '#F59E0B', frozen: '#EF4444', idle: '#6B7280',
  completed: '#4B5563', dead: '#DC2626', unknown: '#374151',
};

const STATUS_ICONS = {
  active: 'circle', executing: 'play-circle', healthy: 'heart-pulse',
  stalled: 'pause-circle', frozen: 'snowflake', idle: 'sleep',
  completed: 'check-circle', dead: 'skull', unknown: 'help-circle',
};

const AgentCard = ({ agent, index }) => {
  const m = agent.metrics || {};
  const color = STATUS_COLORS[agent.status] || STATUS_COLORS.unknown;
  const icon = STATUS_ICONS[agent.status] || STATUS_ICONS.unknown;
  const sparkPct = m.spark_budget ? Math.min((m.spark_spent / m.spark_budget) * 100, 100) : 0;

  return (
    <Animatable.View animation="fadeInUp" delay={index * 60} style={styles.agentCard}>
      <View style={styles.agentHeader}>
        <View style={styles.agentInfo}>
          <MaterialCommunityIcons name="robot" size={18} color="#888" />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.agentName} numberOfLines={1}>{agent.name}</Text>
            <Text style={styles.agentType}>{agent.type.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
          <MaterialCommunityIcons name={icon} size={12} color={color} />
          <Text style={[styles.statusText, { color }]}>{agent.status}</Text>
        </View>
      </View>

      {agent.current_task ? (
        <Text style={styles.taskText} numberOfLines={1}>{agent.current_task}</Text>
      ) : null}

      {m.spark_budget ? (
        <View style={styles.sparkRow}>
          <Text style={styles.sparkLabel}>Spark</Text>
          <Text style={styles.sparkValue}>{m.spark_spent || 0}/{m.spark_budget}</Text>
        </View>
      ) : null}
      {m.spark_budget ? (
        <View style={styles.progressBg}>
          <View style={[
            styles.progressBar,
            { width: `${sparkPct}%`, backgroundColor: sparkPct > 80 ? '#EF4444' : '#10B981' },
          ]} />
        </View>
      ) : null}

      {agent.last_active ? (
        <Text style={styles.lastActive}>
          Last: {new Date(agent.last_active).toLocaleTimeString()}
        </Text>
      ) : null}
    </Animatable.View>
  );
};

const SummaryStat = ({ label, value, color }) => (
  <View style={styles.summaryItem}>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

export default function AgentDashboardScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await dashboardApi.agents();
      setData(res.data || res);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, [fetchDashboard]);

  const agents = data?.agents || [];
  const summary = data?.summary || {};
  const health = data?.node_health || {};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Agent Dashboard</Text>
          <Text style={styles.subtitle}>Live view — refreshes every 5s</Text>
        </View>
        <View style={[styles.healthBadge, {
          backgroundColor: health.watchdog === 'healthy' ? '#10B98122' : '#F59E0B22',
        }]}>
          <MaterialCommunityIcons
            name="heart-pulse"
            size={14}
            color={health.watchdog === 'healthy' ? '#10B981' : '#F59E0B'}
          />
          <Text style={[styles.healthText, {
            color: health.watchdog === 'healthy' ? '#10B981' : '#F59E0B',
          }]}>
            {health.watchdog || '?'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* Summary */}
        {summary.total != null && (
          <Animatable.View animation="fadeIn" style={styles.summaryCard}>
            <SummaryStat label="Total" value={summary.total} color="#3B82F6" />
            {summary.by_status && Object.entries(summary.by_status).map(([s, c]) => (
              <SummaryStat key={s} label={s} value={c} color={STATUS_COLORS[s] || '#888'} />
            ))}
          </Animatable.View>
        )}

        {/* Agent List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            {[1,2,3].map(i => (
              <View key={i} style={[styles.agentCard, { opacity: 0.3 }]}>
                <View style={{ height: 16, width: '60%', backgroundColor: '#333', borderRadius: 4, marginBottom: 8 }} />
                <View style={{ height: 12, width: '40%', backgroundColor: '#333', borderRadius: 4 }} />
              </View>
            ))}
          </View>
        ) : (
          agents.map((agent, i) => <AgentCard key={agent.id || i} agent={agent} index={i} />)
        )}

        {!loading && agents.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="robot-off" size={48} color="#333" />
            <Text style={styles.emptyText}>No agents running</Text>
          </View>
        )}

        <View style={{ height: hp(4) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(4),
    paddingVertical: hp(1.5), borderBottomWidth: 1, borderBottomColor: '#1A1A2E',
  },
  backBtn: { marginRight: wp(3) },
  title: { color: '#fff', fontSize: wp(5), fontWeight: '700' },
  subtitle: { color: '#888', fontSize: wp(3), marginTop: 2 },
  healthBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12, gap: 4,
  },
  healthText: { fontSize: wp(2.8), fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: wp(4), paddingTop: hp(2) },
  summaryCard: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around',
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16, marginBottom: hp(2),
    borderWidth: 1, borderColor: '#2A2A3E',
  },
  summaryItem: { alignItems: 'center', minWidth: wp(16), marginVertical: 4 },
  summaryValue: { fontSize: wp(5), fontWeight: '700' },
  summaryLabel: { color: '#888', fontSize: wp(2.8), marginTop: 2, textTransform: 'capitalize' },
  agentCard: {
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16, marginBottom: hp(1.5),
    borderWidth: 1, borderColor: '#2A2A3E',
  },
  agentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  agentName: { color: '#fff', fontSize: wp(3.5), fontWeight: '600' },
  agentType: { color: '#888', fontSize: wp(2.8), textTransform: 'capitalize' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 10, borderWidth: 1, gap: 4,
  },
  statusText: { fontSize: wp(2.6), fontWeight: '600', textTransform: 'capitalize' },
  taskText: { color: '#aaa', fontSize: wp(2.8), marginTop: 8 },
  sparkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  sparkLabel: { color: '#888', fontSize: wp(2.6) },
  sparkValue: { color: '#ccc', fontSize: wp(2.6), fontWeight: '600' },
  progressBg: { height: 5, backgroundColor: '#2A2A3E', borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },
  lastActive: { color: '#555', fontSize: wp(2.4), marginTop: 8 },
  loadingContainer: {},
  emptyState: { alignItems: 'center', paddingVertical: hp(8) },
  emptyText: { color: '#555', fontSize: wp(3.5), marginTop: 12 },
});
