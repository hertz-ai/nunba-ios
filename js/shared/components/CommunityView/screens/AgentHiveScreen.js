/**
 * AgentHiveScreen - Main hive overview with summary cards, filter chips, and agent list.
 * Polls every 5s for live agent data.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import useExperimentStore from '../../../experimentStore';
import { colors } from '../../../theme/colors';

const POLL_INTERVAL = 5000;

const STATUS_COLORS = {
  active: '#00e89d',
  executing: '#3B82F6',
  healthy: '#00e89d',
  stalled: '#F59E0B',
  frozen: '#EF4444',
  idle: '#6B7280',
  completed: '#4B5563',
  dead: '#DC2626',
  needs_review: '#F59E0B',
  unknown: '#374151',
};

const STATUS_ICONS = {
  active: 'circle',
  executing: 'play-circle',
  healthy: 'heart-pulse',
  stalled: 'pause-circle',
  frozen: 'snowflake',
  idle: 'sleep',
  completed: 'check-circle',
  dead: 'skull',
  needs_review: 'alert-circle',
  unknown: 'help-circle',
};

const FILTER_CHIPS = [
  { label: 'All', key: 'all' },
  { label: 'Active', key: 'active' },
  { label: 'Needs Review', key: 'needs_review' },
];

const SummaryCard = ({ summary }) => {
  const total = summary.total || 0;
  const byStatus = summary.by_status || {};
  const byType = summary.by_type || {};
  const sparkTotal = summary.total_spark_spent || 0;
  const sparkBudget = summary.total_spark_budget || 1;
  const sparkPct = Math.min((sparkTotal / sparkBudget) * 100, 100);

  return (
    <Animatable.View animation="fadeIn" duration={400} style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.accent }]}>{total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        {Object.entries(byStatus).map(([status, count]) => (
          <View key={status} style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: STATUS_COLORS[status] || '#888' }]}>
              {count}
            </Text>
            <Text style={styles.summaryLabel}>{status}</Text>
          </View>
        ))}
      </View>

      {Object.keys(byType).length > 0 && (
        <View style={styles.typeRow}>
          {Object.entries(byType).map(([type, count]) => (
            <View key={type} style={styles.typeBadge}>
              <Text style={styles.typeText}>
                {type.replace(/_/g, ' ')} ({count})
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Spark meter */}
      <View style={styles.sparkMeterRow}>
        <MaterialCommunityIcons name="lightning-bolt" size={14} color="#FF6B6B" />
        <Text style={styles.sparkMeterLabel}>Hive Spark</Text>
        <Text style={styles.sparkMeterValue}>{sparkTotal}/{sparkBudget}</Text>
      </View>
      <View style={styles.sparkMeterBg}>
        <View
          style={[
            styles.sparkMeterFill,
            { width: `${sparkPct}%`, backgroundColor: sparkPct > 80 ? '#EF4444' : '#00e89d' },
          ]}
        />
      </View>
    </Animatable.View>
  );
};

const AgentHiveCard = ({ agent, index, onPress }) => {
  const m = agent.metrics || {};
  const statusColor = STATUS_COLORS[agent.status] || STATUS_COLORS.unknown;
  const statusIcon = STATUS_ICONS[agent.status] || STATUS_ICONS.unknown;
  const sparkPct = m.spark_budget
    ? Math.min((m.spark_spent / m.spark_budget) * 100, 100)
    : 0;
  const progressPct = agent.progress != null ? agent.progress : null;

  return (
    <Animatable.View animation="fadeInUp" delay={index * 50} useNativeDriver>
      <TouchableOpacity
        style={styles.agentCard}
        onPress={() => onPress(agent)}
        activeOpacity={0.7}
      >
        <View style={styles.agentHeader}>
          <View style={styles.agentInfo}>
            <View style={[styles.agentAvatar, { backgroundColor: statusColor + '22' }]}>
              <MaterialCommunityIcons name="robot" size={20} color={statusColor} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.agentName} numberOfLines={1}>
                {agent.name || 'Unnamed Agent'}
              </Text>
              {agent.experiment_title && (
                <Text style={styles.agentExperiment} numberOfLines={1}>
                  {agent.experiment_title}
                </Text>
              )}
              <Text style={styles.agentType}>
                {(agent.type || 'unknown').replace(/_/g, ' ')}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + '22', borderColor: statusColor + '44' },
            ]}
          >
            <MaterialCommunityIcons name={statusIcon} size={12} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {agent.status || 'unknown'}
            </Text>
          </View>
        </View>

        {agent.current_task && (
          <Text style={styles.taskText} numberOfLines={1}>
            {agent.current_task}
          </Text>
        )}

        {/* Progress bar */}
        {progressPct != null && (
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressValue}>{Math.round(progressPct)}%</Text>
            </View>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPct}%`, backgroundColor: colors.accent },
                ]}
              />
            </View>
          </View>
        )}

        {/* Spark mini-bar */}
        {m.spark_budget > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <MaterialCommunityIcons name="lightning-bolt" size={12} color="#FF6B6B" />
              <Text style={styles.sparkLabel}>Spark</Text>
              <Text style={styles.sparkValue}>
                {m.spark_spent || 0}/{m.spark_budget}
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${sparkPct}%`,
                    backgroundColor: sparkPct > 80 ? '#EF4444' : '#00e89d',
                  },
                ]}
              />
            </View>
          </View>
        )}

        {agent.last_active && (
          <Text style={styles.lastActive}>
            Last active: {new Date(agent.last_active).toLocaleTimeString()}
          </Text>
        )}
      </TouchableOpacity>
    </Animatable.View>
  );
};

export default function AgentHiveScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const hiveAgents = useExperimentStore((s) => s.hiveAgents);
  const hiveSummary = useExperimentStore((s) => s.hiveSummary);
  const hiveLoading = useExperimentStore((s) => s.hiveLoading);
  const hiveFilter = useExperimentStore((s) => s.hiveFilter);
  const fetchHiveAgents = useExperimentStore((s) => s.fetchHiveAgents);
  const setHiveFilter = useExperimentStore((s) => s.setHiveFilter);
  const selectHiveAgent = useExperimentStore((s) => s.selectHiveAgent);

  // Filtered agents
  const filteredAgents = useMemo(() => {
    if (hiveFilter === 'all') return hiveAgents;
    if (hiveFilter === 'active')
      return hiveAgents.filter((a) =>
        ['active', 'executing', 'healthy'].includes(a.status),
      );
    if (hiveFilter === 'needs_review')
      return hiveAgents.filter(
        (a) => a.status === 'needs_review' || a.status === 'stalled',
      );
    return hiveAgents;
  }, [hiveAgents, hiveFilter]);

  // Initial fetch + polling
  useEffect(() => {
    fetchHiveAgents();
    intervalRef.current = setInterval(fetchHiveAgents, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchHiveAgents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHiveAgents().finally(() => setRefreshing(false));
  }, [fetchHiveAgents]);

  const handleAgentPress = useCallback(
    (agent) => {
      selectHiveAgent(agent);
      navigation.navigate('AgentHiveDetail', { agentId: agent.id, postId: agent.post_id });
    },
    [navigation, selectHiveAgent],
  );

  const renderAgent = useCallback(
    ({ item, index }) => (
      <AgentHiveCard agent={item} index={index} onPress={handleAgentPress} />
    ),
    [handleAgentPress],
  );

  const ListHeader = () => (
    <View>
      {/* Summary */}
      {(hiveSummary.total != null || hiveAgents.length > 0) && (
        <SummaryCard summary={hiveSummary} />
      )}

      {/* Filter chips */}
      <View style={styles.chipRow}>
        {FILTER_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={[
              styles.chip,
              hiveFilter === chip.key && styles.chipActive,
            ]}
            onPress={() => setHiveFilter(chip.key)}
          >
            <Text
              style={[
                styles.chipText,
                hiveFilter === chip.key && styles.chipTextActive,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const ListEmpty = () =>
    !hiveLoading ? (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="robot-off-outline" size={48} color="#333" />
        <Text style={styles.emptyTitle}>No agents in the hive</Text>
        <Text style={styles.emptySubtitle}>
          Start an experiment to see agents here
        </Text>
      </View>
    ) : null;

  const ListFooter = () =>
    hiveLoading && hiveAgents.length > 0 ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Agent Hive</Text>
          <Text style={styles.subtitle}>Live view -- refreshes every 5s</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('AgentDashboard')}
          style={styles.dashboardBtn}
        >
          <MaterialCommunityIcons name="view-dashboard" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Loading skeleton */}
      {hiveLoading && hiveAgents.length === 0 ? (
        <View style={styles.skeletonWrap}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.agentCard, { opacity: 0.3 }]}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '40%', marginTop: 8 }]} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredAgents}
          keyExtractor={(item) => String(item.id || item.name)}
          renderItem={renderAgent}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={ListFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00e89d"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0E17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#1A1932',
  },
  backBtn: {
    marginRight: wp(3),
  },
  title: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '700',
  },
  subtitle: {
    color: '#888',
    fontSize: wp(3),
    marginTop: 2,
  },
  dashboardBtn: {
    padding: 8,
  },
  listContent: {
    paddingHorizontal: wp(4),
    paddingTop: hp(2),
    paddingBottom: 100,
  },

  // Summary
  summaryCard: {
    backgroundColor: '#1A1932',
    borderRadius: 12,
    padding: 16,
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: '#2A2950',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    minWidth: wp(16),
    marginVertical: 4,
  },
  summaryValue: {
    fontSize: wp(5),
    fontWeight: '700',
  },
  summaryLabel: {
    color: '#888',
    fontSize: wp(2.8),
    marginTop: 2,
    textTransform: 'capitalize',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  typeBadge: {
    backgroundColor: '#252542',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: {
    color: '#aaa',
    fontSize: wp(2.6),
    textTransform: 'capitalize',
  },
  sparkMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  sparkMeterLabel: {
    color: '#888',
    fontSize: wp(2.8),
    flex: 1,
  },
  sparkMeterValue: {
    color: '#ccc',
    fontSize: wp(2.8),
    fontWeight: '600',
  },
  sparkMeterBg: {
    height: 5,
    backgroundColor: '#252542',
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  sparkMeterFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Filter chips
  chipRow: {
    flexDirection: 'row',
    marginBottom: hp(2),
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2A2950',
    backgroundColor: '#1A1932',
  },
  chipActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  chipText: {
    color: '#888',
    fontSize: wp(3),
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },

  // Agent card
  agentCard: {
    backgroundColor: '#1A1932',
    borderRadius: 12,
    padding: 16,
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: '#2A2950',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  agentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    color: '#fff',
    fontSize: wp(3.5),
    fontWeight: '600',
  },
  agentExperiment: {
    color: '#aaa',
    fontSize: wp(2.8),
    marginTop: 1,
  },
  agentType: {
    color: '#666',
    fontSize: wp(2.6),
    textTransform: 'capitalize',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  statusText: {
    fontSize: wp(2.6),
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  taskText: {
    color: '#aaa',
    fontSize: wp(2.8),
    marginTop: 10,
  },
  progressSection: {
    marginTop: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    color: '#888',
    fontSize: wp(2.6),
  },
  progressValue: {
    color: '#ccc',
    fontSize: wp(2.6),
    fontWeight: '600',
  },
  progressBg: {
    height: 5,
    backgroundColor: '#252542',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sparkLabel: {
    color: '#888',
    fontSize: wp(2.6),
    flex: 1,
    marginLeft: 4,
  },
  sparkValue: {
    color: '#ccc',
    fontSize: wp(2.6),
    fontWeight: '600',
  },
  lastActive: {
    color: '#555',
    fontSize: wp(2.4),
    marginTop: 8,
  },

  // Empty / loading
  emptyState: {
    alignItems: 'center',
    paddingTop: hp(10),
  },
  emptyTitle: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: wp(3),
    marginTop: 4,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  skeletonWrap: {
    paddingHorizontal: wp(4),
    paddingTop: hp(2),
  },
  skeletonLine: {
    height: 14,
    width: '60%',
    backgroundColor: '#333',
    borderRadius: 4,
  },
});
