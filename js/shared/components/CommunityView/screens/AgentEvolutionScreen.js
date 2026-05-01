import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { evolutionApi } from '../../../services/socialApi';
import { EvolutionTimeline, SkeletonLoader } from '../components/Gamification';

const GENERATION_CONFIG = {
  1: { color: '#6B7280', label: 'Gen 1', description: 'Nascent', icon: 'robot' },
  2: { color: '#10B981', label: 'Gen 2', description: 'Learning', icon: 'robot-outline' },
  3: { color: '#00D9FF', label: 'Gen 3', description: 'Adaptive', icon: 'robot-happy' },
  4: { color: '#9D4EDD', label: 'Gen 4', description: 'Specialized', icon: 'robot-love' },
  5: { color: '#FFD700', label: 'Gen 5', description: 'Mastery', icon: 'robot-excited' },
};

const SPECIALIZATIONS = [
  { id: 'creative', name: 'Creative', icon: 'palette', color: '#FF6B35', description: 'Art, writing, and content creation' },
  { id: 'analytical', name: 'Analytical', icon: 'chart-line', color: '#00D9FF', description: 'Data analysis and research' },
  { id: 'social', name: 'Social', icon: 'account-group', color: '#9D4EDD', description: 'Community and engagement' },
  { id: 'technical', name: 'Technical', icon: 'code-braces', color: '#10B981', description: 'Coding and automation' },
];

const AgentEvolutionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { agentId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agent, setAgent] = useState(null);
  const [selectedSpec, setSelectedSpec] = useState(null);

  useEffect(() => {
    if (agentId) fetchData();
  }, [agentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [agentRes, historyRes, collabRes] = await Promise.all([
        evolutionApi.get(agentId).catch(() => ({})),
        evolutionApi.history(agentId).catch(() => ({ data: [] })),
        evolutionApi.collaborations(agentId, { limit: 10 }).catch(() => ({ data: [] })),
      ]);
      const data = agentRes.data || {};
      data.generationHistory = historyRes.data || [];
      data.recentCollaborations = collabRes.data || [];
      setAgent(data);
      setSelectedSpec(data.specialization || null);
    } catch (e) {}
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [agentId]);

  const handleEvolve = () => {
    console.log('Evolve agent');
  };

  const handleSelectSpec = (specId) => {
    if (agent.generation >= 3) {
      setSelectedSpec(specId);
    }
  };

  if (loading || !agent) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agent Evolution</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <SkeletonLoader variant="avatar" />
          <SkeletonLoader width={wp('60%')} height={hp('3%')} style={{ marginTop: hp('2%') }} />
          <SkeletonLoader variant="card" style={{ marginTop: hp('2%') }} />
        </View>
      </SafeAreaView>
    );
  }

  const genConfig = GENERATION_CONFIG[agent.generation];
  const progressPercent = (agent.currentXP / agent.xpToNextGen) * 100;
  const canEvolve = progressPercent >= 100 && agent.generation < 5;
  const canSpecialize = agent.generation >= 3 && !agent.specialization;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agent Evolution</Text>
        <TouchableOpacity style={styles.infoButton}>
          <Ionicons name="help-circle-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
        }
      >
        {/* Agent Header */}
        <Animatable.View animation="fadeIn" style={styles.agentHeader}>
          <View style={[styles.agentAvatar, { borderColor: genConfig.color }]}>
            {agent.avatar ? (
              <Image source={{ uri: agent.avatar }} style={styles.avatarImage} />
            ) : (
              <MaterialCommunityIcons name={genConfig.icon} size={40} color={genConfig.color} />
            )}
            <View style={[styles.genBadge, { backgroundColor: genConfig.color }]}>
              <Text style={styles.genBadgeText}>{agent.generation}</Text>
            </View>
          </View>
          <Text style={styles.agentName}>{agent.name}</Text>
          <View style={styles.agentGenInfo}>
            <Text style={[styles.agentGenLabel, { color: genConfig.color }]}>
              {genConfig.label} - {genConfig.description}
            </Text>
          </View>
        </Animatable.View>

        {/* Evolution Timeline */}
        <Animatable.View animation="fadeInUp" delay={100}>
          <EvolutionTimeline
            currentXP={agent.currentXP}
            currentStage={
              agent.generation === 1 ? 'seed' :
              agent.generation === 2 ? 'sprout' :
              agent.generation === 3 ? 'sapling' :
              agent.generation === 4 ? 'tree' : 'ancient'
            }
            specialization={selectedSpec ? SPECIALIZATIONS.find(s => s.id === selectedSpec)?.name : null}
          />
        </Animatable.View>

        {/* Stats Cards */}
        <Animatable.View animation="fadeInUp" delay={200} style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Agent Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="checkbox-marked-circle" size={28} color="#00e89d" />
              <Text style={styles.statValue}>{agent.stats.totalTasks}</Text>
              <Text style={styles.statLabel}>Total Tasks</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="account-group" size={28} color="#00D9FF" />
              <Text style={styles.statValue}>{agent.stats.collaborations}</Text>
              <Text style={styles.statLabel}>Collaborations</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="star" size={28} color="#FFD700" />
              <Text style={styles.statValue}>{agent.stats.qualityScore.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Quality Score</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="percent" size={28} color="#9D4EDD" />
              <Text style={styles.statValue}>{agent.stats.successRate}%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
          </View>
        </Animatable.View>

        {/* Specialization Selector (Gen 3+) */}
        {agent.generation >= 3 && (
          <Animatable.View animation="fadeInUp" delay={300} style={styles.specSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Specialization</Text>
              {!canSpecialize && (
                <View style={styles.specLockedBadge}>
                  <Ionicons name="lock-closed" size={12} color="#888" />
                  <Text style={styles.specLockedText}>Already specialized</Text>
                </View>
              )}
            </View>
            <Text style={styles.specSubtitle}>
              {canSpecialize
                ? 'Choose a path to enhance your agent\'s abilities'
                : 'Your agent has already chosen a specialization'}
            </Text>
            <View style={styles.specGrid}>
              {SPECIALIZATIONS.map((spec, index) => {
                const isSelected = selectedSpec === spec.id;
                const isLocked = agent.specialization && agent.specialization !== spec.id;
                return (
                  <Animatable.View key={spec.id} animation="fadeInRight" delay={index * 100}>
                    <TouchableOpacity
                      style={[
                        styles.specCard,
                        isSelected && { borderColor: spec.color, backgroundColor: `${spec.color}11` },
                        isLocked && styles.specCardLocked,
                      ]}
                      onPress={() => handleSelectSpec(spec.id)}
                      disabled={isLocked || !canSpecialize}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.specIcon, { backgroundColor: `${spec.color}22` }]}>
                        <MaterialCommunityIcons name={spec.icon} size={28} color={isLocked ? '#555' : spec.color} />
                      </View>
                      <Text style={[styles.specName, isLocked && styles.specNameLocked]}>
                        {spec.name}
                      </Text>
                      <Text style={[styles.specDesc, isLocked && styles.specDescLocked]}>
                        {spec.description}
                      </Text>
                      {isSelected && (
                        <View style={[styles.specSelectedBadge, { backgroundColor: spec.color }]}>
                          <Ionicons name="checkmark" size={14} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animatable.View>
                );
              })}
            </View>
          </Animatable.View>
        )}

        {/* Recent Collaborations */}
        <Animatable.View animation="fadeInUp" delay={400} style={styles.collabSection}>
          <Text style={styles.sectionTitle}>Recent Collaborations</Text>
          {agent.recentCollaborations.map((collab, index) => (
            <View key={collab.id} style={styles.collabItem}>
              <View style={styles.collabIcon}>
                <MaterialCommunityIcons
                  name={collab.success ? 'check-circle' : 'close-circle'}
                  size={24}
                  color={collab.success ? '#10B981' : '#EF4444'}
                />
              </View>
              <View style={styles.collabInfo}>
                <Text style={styles.collabTask}>{collab.taskName}</Text>
                <Text style={styles.collabMeta}>
                  with <Text style={styles.collabAgent}>{collab.agentName}</Text> - {new Date(collab.date).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
        </Animatable.View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Evolve CTA */}
      {canEvolve && (
        <Animatable.View animation="fadeInUp" style={styles.ctaContainer}>
          <TouchableOpacity
            style={styles.evolveButton}
            onPress={handleEvolve}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-up-bold-circle" size={24} color="#121212" />
            <Text style={styles.evolveButtonText}>Evolve to Gen {agent.generation + 1}</Text>
          </TouchableOpacity>
        </Animatable.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  infoButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: wp('4%'),
    alignItems: 'center',
  },
  agentHeader: {
    alignItems: 'center',
    paddingVertical: hp('2%'),
  },
  agentAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1A1A',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 94,
    height: 94,
    borderRadius: 47,
  },
  genBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121212',
  },
  genBadgeText: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '800',
  },
  agentName: {
    color: '#FFF',
    fontSize: wp('6%'),
    fontWeight: '800',
    marginTop: hp('1.5%'),
  },
  agentGenInfo: {
    marginTop: 4,
  },
  agentGenLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  statsSection: {
    paddingHorizontal: wp('4%'),
    marginTop: hp('2%'),
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statValue: {
    color: '#FFF',
    fontSize: wp('6%'),
    fontWeight: '800',
    marginTop: 8,
  },
  statLabel: {
    color: '#888',
    fontSize: wp('3%'),
    marginTop: 4,
  },
  specSection: {
    paddingHorizontal: wp('4%'),
    marginTop: hp('3%'),
  },
  specLockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A3E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  specLockedText: {
    color: '#888',
    fontSize: wp('2.5%'),
    marginLeft: 4,
  },
  specSubtitle: {
    color: '#888',
    fontSize: wp('3.2%'),
    marginBottom: hp('1.5%'),
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  specCard: {
    width: wp('44%'),
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2A2A',
    position: 'relative',
  },
  specCardLocked: {
    opacity: 0.5,
  },
  specIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  specName: {
    color: '#FFF',
    fontSize: wp('3.8%'),
    fontWeight: '700',
    marginBottom: 4,
  },
  specNameLocked: {
    color: '#666',
  },
  specDesc: {
    color: '#888',
    fontSize: wp('2.8%'),
    textAlign: 'center',
  },
  specDescLocked: {
    color: '#555',
  },
  specSelectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collabSection: {
    paddingHorizontal: wp('4%'),
    marginTop: hp('3%'),
  },
  collabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    marginBottom: hp('1%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  collabIcon: {
    marginRight: 12,
  },
  collabInfo: {
    flex: 1,
  },
  collabTask: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  collabMeta: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  collabAgent: {
    color: '#00D9FF',
  },
  bottomSpacer: {
    height: hp('12%'),
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: wp('4%'),
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  evolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00e89d',
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
  },
  evolveButtonText: {
    color: '#121212',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default AgentEvolutionScreen;
