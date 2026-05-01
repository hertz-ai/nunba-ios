/**
 * AgentHiveDetailScreen - Detail view for a single hive agent.
 * Shows tasks, conversations, inject/interview actions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import useExperimentStore from '../../../experimentStore';
import { colors } from '../../../theme/colors';

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
  pending: '#6B7280',
  running: '#3B82F6',
  done: '#00e89d',
  failed: '#EF4444',
  unknown: '#374151',
};

const TaskItem = ({ task, index }) => {
  const statusColor = STATUS_COLORS[task.status] || STATUS_COLORS.unknown;
  return (
    <Animatable.View animation="fadeInRight" delay={index * 40} style={styles.taskItem}>
      <View style={[styles.taskDot, { backgroundColor: statusColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.taskTitle} numberOfLines={2}>
          {task.description || task.name || `Task ${index + 1}`}
        </Text>
        {task.result && (
          <Text style={styles.taskResult} numberOfLines={1}>
            {task.result}
          </Text>
        )}
      </View>
      <View style={[styles.taskStatusBadge, { backgroundColor: statusColor + '22' }]}>
        <Text style={[styles.taskStatusText, { color: statusColor }]}>
          {task.status || 'pending'}
        </Text>
      </View>
    </Animatable.View>
  );
};

const ConversationEntry = ({ entry, index }) => (
  <Animatable.View animation="fadeIn" delay={index * 30} style={styles.convoEntry}>
    <MaterialCommunityIcons name="brain" size={14} color={colors.accent} />
    <View style={{ flex: 1, marginLeft: 8 }}>
      <Text style={styles.convoText} numberOfLines={3}>
        {entry.content || entry.text || JSON.stringify(entry)}
      </Text>
      {entry.timestamp && (
        <Text style={styles.convoTime}>
          {new Date(entry.timestamp).toLocaleString()}
        </Text>
      )}
    </View>
  </Animatable.View>
);

export default function AgentHiveDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId } = route.params || {};
  const [refreshing, setRefreshing] = useState(false);

  const agent = useExperimentStore((s) => s.selectedHiveAgent);
  const conversations = useExperimentStore((s) => s.hiveConversations);
  const convoLoading = useExperimentStore((s) => s.hiveConversationsLoading);
  const fetchConversations = useExperimentStore((s) => s.fetchHiveConversations);
  const injectVariable = useExperimentStore((s) => s.injectVariable);

  useEffect(() => {
    if (postId) {
      fetchConversations(postId);
    }
  }, [postId, fetchConversations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations(postId).finally(() => setRefreshing(false));
  }, [postId, fetchConversations]);

  const handleInject = useCallback(() => {
    Alert.prompt(
      'Inject Variable',
      'Enter a variable or context to inject into this agent:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Inject',
          onPress: async (value) => {
            if (!value?.trim()) return;
            const res = await injectVariable(postId, { variable: value.trim() });
            if (res?.success) {
              Alert.alert('Injected', 'Variable sent to agent successfully.');
              fetchConversations(postId);
            } else {
              Alert.alert('Error', 'Could not inject variable.');
            }
          },
        },
      ],
      'plain-text',
    );
  }, [postId, injectVariable, fetchConversations]);

  const handleInterview = useCallback(() => {
    navigation.navigate('AgentInterview', {
      postId,
      agentName: agent?.name || 'Agent',
    });
  }, [navigation, postId, agent]);

  if (!agent) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Agent Detail</Text>
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="robot-confused" size={48} color="#333" />
          <Text style={styles.emptyText}>No agent selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  const m = agent.metrics || {};
  const statusColor = STATUS_COLORS[agent.status] || STATUS_COLORS.unknown;
  const progressPct = agent.progress != null ? agent.progress : 0;
  const tasks = agent.tasks || [];

  const sections = [];

  // Tasks section
  if (tasks.length > 0) {
    sections.push({ key: 'tasks_header', type: 'section_header', title: 'Tasks' });
    tasks.forEach((t, i) =>
      sections.push({ key: `task_${i}`, type: 'task', data: t, index: i }),
    );
  }

  // Conversations section
  sections.push({
    key: 'convo_header',
    type: 'section_header',
    title: 'Memory / Conversations',
  });
  if (convoLoading) {
    sections.push({ key: 'convo_loading', type: 'loading' });
  } else if (conversations.length > 0) {
    conversations.forEach((c, i) =>
      sections.push({ key: `convo_${i}`, type: 'conversation', data: c, index: i }),
    );
  } else {
    sections.push({ key: 'convo_empty', type: 'convo_empty' });
  }

  const renderItem = ({ item }) => {
    switch (item.type) {
      case 'section_header':
        return (
          <Text style={styles.sectionTitle}>{item.title}</Text>
        );
      case 'task':
        return <TaskItem task={item.data} index={item.index} />;
      case 'conversation':
        return <ConversationEntry entry={item.data} index={item.index} />;
      case 'loading':
        return (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        );
      case 'convo_empty':
        return (
          <Text style={styles.convoEmptyText}>No conversation entries yet.</Text>
        );
      default:
        return null;
    }
  };

  const ListHeader = () => (
    <View>
      {/* Agent info card */}
      <Animatable.View animation="fadeIn" duration={400} style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={[styles.agentAvatar, { backgroundColor: statusColor + '22' }]}>
            <MaterialCommunityIcons name="robot" size={28} color={statusColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.agentName}>{agent.name || 'Agent'}</Text>
            {agent.experiment_title && (
              <Text style={styles.agentExperiment}>{agent.experiment_title}</Text>
            )}
          </View>
          <View
            style={[
              styles.stageBadge,
              { backgroundColor: statusColor + '22', borderColor: statusColor + '44' },
            ]}
          >
            <Text style={[styles.stageText, { color: statusColor }]}>
              {agent.status || 'unknown'}
            </Text>
          </View>
        </View>

        {/* Progress ring approximation: bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Overall Progress</Text>
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

        {/* Spark */}
        {m.spark_budget > 0 && (
          <View style={styles.sparkRow}>
            <MaterialCommunityIcons name="lightning-bolt" size={14} color="#FF6B6B" />
            <Text style={styles.sparkText}>
              Spark: {m.spark_spent || 0} / {m.spark_budget}
            </Text>
          </View>
        )}
      </Animatable.View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleInject}>
          <MaterialCommunityIcons name="needle" size={18} color="#FF6B6B" />
          <Text style={styles.actionBtnText}>Inject Variable</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={handleInterview}
        >
          <MaterialCommunityIcons name="message-text" size={18} color="#fff" />
          <Text style={[styles.actionBtnText, { color: '#fff' }]}>
            Interview Agent
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {agent.name || 'Agent Detail'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00e89d"
          />
        }
        contentContainerStyle={styles.listContent}
      />
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
    fontSize: wp(4.5),
    fontWeight: '700',
    flex: 1,
  },
  listContent: {
    paddingHorizontal: wp(4),
    paddingTop: hp(2),
    paddingBottom: 100,
  },

  // Info card
  infoCard: {
    backgroundColor: '#1A1932',
    borderRadius: 12,
    padding: 16,
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: '#2A2950',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: '700',
  },
  agentExperiment: {
    color: '#aaa',
    fontSize: wp(3),
    marginTop: 2,
  },
  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  stageText: {
    fontSize: wp(2.8),
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  progressSection: {
    marginTop: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    color: '#888',
    fontSize: wp(2.8),
  },
  progressValue: {
    color: '#ccc',
    fontSize: wp(2.8),
    fontWeight: '600',
  },
  progressBg: {
    height: 6,
    backgroundColor: '#252542',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  sparkText: {
    color: '#aaa',
    fontSize: wp(2.8),
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: hp(2),
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1A1932',
    borderWidth: 1,
    borderColor: '#2A2950',
  },
  actionBtnPrimary: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  actionBtnText: {
    color: '#ccc',
    fontSize: wp(3.2),
    fontWeight: '600',
  },

  // Sections
  sectionTitle: {
    color: '#fff',
    fontSize: wp(3.8),
    fontWeight: '700',
    marginTop: hp(1),
    marginBottom: hp(1),
  },

  // Task items
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1932',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2950',
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  taskTitle: {
    color: '#ddd',
    fontSize: wp(3),
  },
  taskResult: {
    color: '#888',
    fontSize: wp(2.6),
    marginTop: 2,
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  taskStatusText: {
    fontSize: wp(2.4),
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Conversations
  convoEntry: {
    flexDirection: 'row',
    backgroundColor: '#1A1932',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2950',
  },
  convoText: {
    color: '#ccc',
    fontSize: wp(3),
  },
  convoTime: {
    color: '#555',
    fontSize: wp(2.4),
    marginTop: 4,
  },
  convoEmptyText: {
    color: '#555',
    fontSize: wp(3),
    textAlign: 'center',
    paddingVertical: hp(3),
  },
  loadingRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#555',
    fontSize: wp(3.5),
    marginTop: 12,
  },
});
