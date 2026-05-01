/**
 * ExperimentDiscoveryScreen — Context-aware thought experiment discovery for React Native.
 *
 * Context-aware features:
 * - Greeting changes by time of day
 * - Tab highlight based on user's past interactions
 * - Nearby experimenter count (social proof)
 * - Status badges for active experiments (voting, evaluating)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import useExperimentStore from '../../../experimentStore';
import { experimentsApi, encountersApi } from '../../../services/socialApi';
import ThoughtExperimentCard from '../components/Experiments/ThoughtExperimentCard';
import ExperimentMetricsCard from '../components/Experiments/ExperimentMetricsCard';
import ContextBridge from '../components/ContextBridge';
import colors, {
  INTENT_COLORS,
  INTENT_LABELS,
  INTENT_ICONS,
} from '../../../theme/colors';

const TABS = [
  { label: 'For You', key: 'recommended', icon: 'trending-up' },
  { label: 'Active', key: 'active', icon: 'science' },
  { label: 'Physical AI', key: 'physical_ai', icon: 'camera' },
  { label: 'Software', key: 'software', icon: 'code' },
];

const INTENT_KEYS = ['technology', 'health', 'education', 'environment', 'community', 'equity'];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Late night thought experiments';
  if (h < 12) return 'Morning thought experiments';
  if (h < 17) return 'Afternoon thought experiments';
  if (h < 21) return 'Evening thought experiments';
  return 'Night owl thought experiments';
}

const ExperimentDiscoveryScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState(0);
  const [intentFilter, setIntentFilter] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyCount, setNearbyCount] = useState(0);

  const resonanceCtx = null;
  const challengeCtx = null;

  const experiments = useExperimentStore((s) => s.experiments);
  const loading = useExperimentStore((s) => s.loading);
  const hasMore = useExperimentStore((s) => s.hasMore);
  const offset = useExperimentStore((s) => s.offset);
  const userIntents = useExperimentStore((s) => s.userIntents);
  const setExperiments = useExperimentStore((s) => s.setExperiments);
  const appendExperiments = useExperimentStore((s) => s.appendExperiments);
  const setLoading = useExperimentStore((s) => s.setLoading);
  const setHasMore = useExperimentStore((s) => s.setHasMore);
  const setOffset = useExperimentStore((s) => s.setOffset);
  const setUserIntents = useExperimentStore((s) => s.setUserIntents);
  const reset = useExperimentStore((s) => s.reset);

  const currentTab = TABS[activeTab];
  const greeting = useMemo(() => getGreeting(), []);

  // Context: fetch nearby count
  useEffect(() => {
    encountersApi
      .nearbyCount()
      .then((r) => {
        if (r?.data?.count) setNearbyCount(r.data.count);
      })
      .catch(() => {});
  }, []);

  // Context: top user intent
  const topIntent = useMemo(() => {
    const entries = Object.entries(userIntents || {});
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }, [userIntents]);

  const fetchExperiments = useCallback(
    async (isRefresh = false) => {
      const newOffset = isRefresh ? 0 : offset;
      setLoading(true);

      try {
        const params = { limit: 20, offset: newOffset };
        if (intentFilter) params.intent_category = intentFilter;
        if (currentTab.key === 'active') params.status = 'voting';
        else if (['physical_ai', 'software'].includes(currentTab.key)) {
          params.experiment_type = currentTab.key;
        }

        const r = await experimentsApi.discover(params);
        const data = r?.data || [];
        const meta = r?.meta || {};

        if (isRefresh) {
          setExperiments(data);
          setOffset(data.length);
        } else {
          appendExperiments(data);
          setOffset(newOffset + data.length);
        }
        setHasMore(meta.has_more || false);
        if (meta.user_intents) setUserIntents(meta.user_intents);
      } catch {
        if (isRefresh) setExperiments([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [offset, intentFilter, currentTab, setExperiments, appendExperiments, setLoading, setOffset, setHasMore, setUserIntents],
  );

  // Refresh on tab/filter change
  useEffect(() => {
    reset();
    fetchExperiments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, intentFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchExperiments(true);
  };

  const onEndReached = () => {
    if (!loading && hasMore) fetchExperiments(false);
  };

  const handleExperimentPress = (exp) => {
    // Navigate to detail or post if available
    navigation.navigate('ExperimentDetail', { experimentId: exp.id, postId: exp.post_id });
  };

  const renderItem = ({ item }) => (
    <View>
      <ThoughtExperimentCard experiment={item} onPress={handleExperimentPress} />
      <ExperimentMetricsCard experimentId={item.id} experimentType={item.experiment_type} />
    </View>
  );

  const ListHeader = () => (
    <View style={styles.header}>
      {/* Context-aware greeting */}
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.subtitle}>
        Discover thought experiments that match your interests
      </Text>

      {/* Context bridge: nearby experimenters → Encounters */}
      {nearbyCount > 0 && (
        <ContextBridge
          variant="inline"
          targetScreen="Encounters"
          icon="people"
          iconType="material"
          color="#00e89d"
          title={`${nearbyCount} experimenter${nearbyCount !== 1 ? 's' : ''} near you`}
          subtitle="Discover who's exploring nearby"
        />
      )}

      {/* Context: top intent suggestion */}
      {topIntent && !intentFilter && (
        <TouchableOpacity
          style={[styles.intentSuggestion, { backgroundColor: (INTENT_COLORS[topIntent] || colors.accent) + '22' }]}
          onPress={() => setIntentFilter(topIntent)}
        >
          <MaterialCommunityIcons name="robot" size={14} color={INTENT_COLORS[topIntent] || colors.accent} />
          <Text style={[styles.intentSuggestionText, { color: INTENT_COLORS[topIntent] || colors.accent }]}>
            Based on your activity, try {INTENT_LABELS[topIntent] || topIntent}
          </Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <MaterialIcons
              name={t.icon}
              size={16}
              color={activeTab === i ? '#fff' : colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === i && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Intent filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {INTENT_KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.chip,
              intentFilter === key && {
                backgroundColor: (INTENT_COLORS[key] || colors.accent) + '33',
                borderColor: INTENT_COLORS[key] || colors.accent,
              },
            ]}
            onPress={() => setIntentFilter(intentFilter === key ? null : key)}
          >
            <MaterialCommunityIcons
              name={INTENT_ICONS[key] || 'flask'}
              size={13}
              color={intentFilter === key ? INTENT_COLORS[key] : colors.textMuted}
            />
            <Text
              style={[
                styles.chipText,
                intentFilter === key && { color: INTENT_COLORS[key] },
              ]}
            >
              {INTENT_LABELS[key] || key}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Context bridges: Spark balance + active challenges */}
      <View style={styles.bridgeChipRow}>
        {resonanceCtx?.sparkBalance > 0 && (
          <ContextBridge
            variant="chip"
            targetScreen="ResonanceDashboard"
            icon="lightning-bolt"
            iconType="community"
            color="#FF6B6B"
            title={`${resonanceCtx.sparkBalance} Spark`}
          />
        )}
        {challengeCtx?.activeCount > 0 && (
          <ContextBridge
            variant="chip"
            targetScreen="Challenges"
            icon="flag-checkered"
            iconType="community"
            color="#EF4444"
            title={`${challengeCtx.activeCount} active`}
          />
        )}
      </View>
    </View>
  );

  const ListEmpty = () =>
    !loading ? (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="flask-empty-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No thought experiments found</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to propose a thought experiment!
        </Text>
      </View>
    ) : null;

  const ListFooter = () =>
    loading && experiments.length > 0 ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Thought Experiments</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={experiments}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  topBarTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  header: {
    paddingHorizontal: wp('4%'),
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accent,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  nearbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.accent + '0F',
    borderWidth: 1,
    borderColor: colors.accent + '22',
    marginBottom: 12,
  },
  nearbyText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  intentSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  intentSuggestionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  bridgeChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: hp('10%'),
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default ExperimentDiscoveryScreen;
