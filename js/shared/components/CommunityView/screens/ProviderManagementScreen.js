import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ScrollView,
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
import { colors, borderRadius, spacing, fontSize, fontWeight } from '../../../theme/colors';
import { providerApi } from '../../../services/socialApi';

// ── Constants ──

const PROVIDER_TYPE_LABELS = {
  api: 'API Provider',
  affiliate: 'Affiliate',
  local: 'Local',
};

const PROVIDER_TYPE_COLORS = {
  api: '#4CAF50',
  affiliate: '#FF9800',
  local: colors.accent,
};

const CATEGORY_LABELS = {
  llm: 'LLM',
  tts: 'TTS',
  stt: 'STT',
  vlm: 'Vision',
  image_gen: 'Image',
  video_gen: 'Video',
  audio_gen: 'Audio',
  embedding: 'Embed',
  '3d_gen': '3D',
};

const TYPE_FILTERS = ['all', 'api', 'affiliate', 'local'];

// ── Sub-components ──

const CategoryBadge = ({ cat }) => (
  <View style={styles.categoryBadge}>
    <Text style={styles.categoryText}>{CATEGORY_LABELS[cat] || cat}</Text>
  </View>
);

const TypeBadge = ({ type }) => {
  const color = PROVIDER_TYPE_COLORS[type] || '#666';
  return (
    <View style={[styles.typeBadge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.typeBadgeText, { color }]}>
        {PROVIDER_TYPE_LABELS[type] || type}
      </Text>
    </View>
  );
};

const HealthDot = ({ healthy }) => (
  <View style={styles.healthRow}>
    <View style={[styles.healthDot, { backgroundColor: healthy ? '#4CAF50' : '#f44336' }]} />
    <Text style={[styles.healthLabel, { color: healthy ? '#4CAF50' : '#f44336' }]}>
      {healthy ? 'Healthy' : 'Down'}
    </Text>
  </View>
);

const StatChip = ({ label, color: chipColor }) => (
  <Text style={[styles.statText, chipColor ? { color: chipColor } : null]}>{label}</Text>
);

const ProviderCard = ({ provider, onTest, onToggle, onSetKey, testing, index }) => {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyValue, setKeyValue] = useState('');

  const handleSaveKey = () => {
    if (keyValue.trim()) {
      onSetKey(provider.id, keyValue.trim());
      setKeyValue('');
      setShowKeyInput(false);
    }
  };

  const isApi = provider.provider_type === 'api' && provider.id !== 'local';
  const isTesting = testing === provider.id;

  return (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <View style={[
        styles.card,
        !provider.enabled && styles.cardDisabled,
      ]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.providerName} numberOfLines={1}>
                {provider.name}
              </Text>
              <TypeBadge type={provider.provider_type} />
            </View>
            <Text style={styles.providerId}>{provider.id}</Text>
          </View>
          <HealthDot healthy={provider.healthy} />
        </View>

        {/* Categories */}
        {provider.categories?.length > 0 && (
          <View style={styles.categoriesRow}>
            {provider.categories.map(cat => (
              <CategoryBadge key={cat} cat={cat} />
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatChip label={`${provider.model_count} models`} />
          {provider.avg_latency_ms > 0 && (
            <StatChip label={`${Math.round(provider.avg_latency_ms)}ms avg`} />
          )}
          {provider.commission_pct > 0 && (
            <StatChip
              label={`${provider.commission_pct}% commission`}
              color="#FF9800"
            />
          )}
        </View>

        {/* API Key Status */}
        {isApi && (
          <View style={styles.keySection}>
            {provider.api_key_set ? (
              <View style={styles.keyConfigured}>
                <Text style={styles.keySetText}>API key configured</Text>
                <TouchableOpacity
                  onPress={() => setShowKeyInput(!showKeyInput)}
                  style={styles.btnSmall}
                >
                  <Text style={styles.btnSmallText}>Update</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowKeyInput(!showKeyInput)}
                style={[styles.btnAction, { backgroundColor: '#FF9800' }]}
              >
                <Text style={styles.btnActionText}>Set API Key</Text>
              </TouchableOpacity>
            )}

            {showKeyInput && (
              <View style={styles.keyInputRow}>
                <TextInput
                  style={styles.keyInput}
                  placeholder="sk-..."
                  placeholderTextColor={colors.textDisabled}
                  secureTextEntry
                  value={keyValue}
                  onChangeText={setKeyValue}
                  onSubmitEditing={handleSaveKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={handleSaveKey}
                  style={[styles.btnAction, { backgroundColor: '#4CAF50' }]}
                >
                  <Text style={styles.btnActionText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowKeyInput(false)}
                  style={[styles.btnAction, { backgroundColor: colors.backgroundTertiary }]}
                >
                  <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          {provider.provider_type === 'api' && provider.api_key_set && (
            <TouchableOpacity
              onPress={() => onTest(provider.id)}
              disabled={isTesting}
              style={[
                styles.btnAction,
                { backgroundColor: isTesting ? '#444' : colors.accent },
              ]}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnActionText}>Test</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onToggle(provider.id, !provider.enabled)}
            style={[
              styles.btnAction,
              { backgroundColor: provider.enabled ? '#f44336' : '#4CAF50' },
            ]}
          >
            <Text style={styles.btnActionText}>
              {provider.enabled ? 'Disable' : 'Enable'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animatable.View>
  );
};

const LeaderboardRow = ({ entry, rank }) => {
  const effColor = entry.efficiency_score > 1 ? '#4CAF50' : '#FF9800';
  return (
    <View style={styles.lbRow}>
      <Text style={[styles.lbCell, { width: 28 }]}>{rank}</Text>
      <Text style={[styles.lbCell, { flex: 1 }]} numberOfLines={1}>
        {entry.provider_id}
      </Text>
      <Text style={[styles.lbCell, { flex: 1 }]} numberOfLines={1}>
        {entry.model_id?.split('/').pop()}
      </Text>
      <Text style={[styles.lbCell, { width: 56, color: effColor }]}>
        {entry.efficiency_score?.toFixed(3) || '--'}
      </Text>
      <Text style={[styles.lbCell, { width: 58 }]}>
        {entry.avg_tok_per_s?.toFixed(0) || '--'} t/s
      </Text>
    </View>
  );
};

// ── Test result toast ──

const TestResultToast = ({ result, onDismiss }) => {
  if (!result) return null;
  const success = result.success;
  return (
    <Animatable.View animation="fadeInDown" style={[
      styles.toastContainer,
      { borderColor: success ? '#4CAF50' : '#f44336', backgroundColor: success ? '#1a332a' : '#331a1a' },
    ]}>
      <View style={styles.toastContent}>
        <MaterialCommunityIcons
          name={success ? 'check-circle' : 'alert-circle'}
          size={18}
          color={success ? '#4CAF50' : '#f44336'}
        />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.toastTitle, { color: success ? '#4CAF50' : '#f44336' }]}>
            {success ? 'Success' : 'Failed'} - {result.providerId}
          </Text>
          {success && result.latency_ms != null && (
            <Text style={styles.toastDetail}>
              {result.latency_ms?.toFixed(0)}ms
              {result.cost_usd != null ? ` | $${result.cost_usd?.toFixed(6)}` : ''}
            </Text>
          )}
          {result.error && (
            <Text style={[styles.toastDetail, { color: '#f44336' }]}>{result.error}</Text>
          )}
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.toastClose}>
          <MaterialCommunityIcons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );
};

// ── Resource stats bar ──

const ResourceBar = ({ stats }) => {
  if (!stats) return null;
  return (
    <View style={styles.resourceBar}>
      <StatChip
        label={`Mode: ${stats.mode?.toUpperCase() || '?'}`}
        color={stats.mode === 'idle' ? '#4CAF50' : '#FF9800'}
      />
      {stats.cpu_percent !== undefined && (
        <StatChip
          label={`CPU: ${stats.cpu_percent}%`}
          color={stats.cpu_percent > 80 ? '#f44336' : colors.textSecondary}
        />
      )}
      {stats.ram_used_gb !== undefined && (
        <StatChip
          label={`RAM: ${stats.ram_used_gb}/${stats.ram_total_gb} GB`}
          color={colors.textSecondary}
        />
      )}
      {stats.gpu?.cuda_available && (
        <StatChip
          label={`GPU: ${stats.gpu.free_gb?.toFixed(1)}/${stats.gpu.total_gb?.toFixed(1)} GB`}
          color="#4CAF50"
        />
      )}
    </View>
  );
};

// ── Main Screen ──

export default function ProviderManagementScreen() {
  const navigation = useNavigation();
  const [providers, setProviders] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [gatewayStats, setGatewayStats] = useState(null);
  const [resourceStats, setResourceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [provRes, lbRes, gwRes, rsRes] = await Promise.all([
        providerApi.list().catch(() => null),
        providerApi.leaderboard().catch(() => null),
        providerApi.gatewayStats().catch(() => null),
        providerApi.resourceStats().catch(() => null),
      ]);
      if (provRes?.providers) setProviders(provRes.providers);
      if (lbRes) setLeaderboard(lbRes);
      if (gwRes) setGatewayStats(gwRes);
      if (rsRes) setResourceStats(rsRes);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const handleTest = async (providerId) => {
    setTesting(providerId);
    setTestResult(null);
    try {
      const data = await providerApi.test(providerId);
      setTestResult({ providerId, ...data });
    } catch (e) {
      setTestResult({ providerId, success: false, error: e.message });
    }
    setTesting(null);
  };

  const handleToggle = async (providerId, enabled) => {
    try {
      await providerApi.enable(providerId, enabled);
      await fetchAll();
    } catch { /* ignore */ }
  };

  const handleSetKey = async (providerId, apiKey) => {
    try {
      await providerApi.setApiKey(providerId, apiKey);
      await fetchAll();
    } catch { /* ignore */ }
  };

  const filtered = filter === 'all'
    ? providers
    : providers.filter(p => p.provider_type === filter);

  const apiConfigured = providers.filter(p => p.provider_type === 'api' && p.api_key_set).length;
  const totalApi = providers.filter(p => p.provider_type === 'api' && p.id !== 'local').length;

  const renderProvider = ({ item, index }) => (
    <ProviderCard
      provider={item}
      onTest={handleTest}
      onToggle={handleToggle}
      onSetKey={handleSetKey}
      testing={testing}
      index={index}
    />
  );

  const lbEntries = leaderboard?.leaderboard?.slice(0, 10) || [];

  const ListHeader = () => (
    <>
      {/* Subtitle */}
      <Text style={styles.subtitle}>
        {apiConfigured}/{totalApi} API keys configured  |  {providers.length} total providers
      </Text>

      {/* Resource stats */}
      <ResourceBar stats={resourceStats} />

      {/* Gateway stats */}
      {gatewayStats && gatewayStats.total_requests > 0 && (
        <View style={styles.resourceBar}>
          <StatChip label={`Gateway: ${gatewayStats.total_requests} requests`} color={colors.textSecondary} />
          <StatChip label={`Cost: $${gatewayStats.total_cost_usd?.toFixed(4)}`} color="#FF9800" />
        </View>
      )}

      {/* Test result toast */}
      <TestResultToast result={testResult} onDismiss={() => setTestResult(null)} />

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {TYPE_FILTERS.map(t => {
          const isActive = filter === t;
          const count = t === 'all'
            ? providers.length
            : providers.filter(p => p.provider_type === t).length;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setFilter(t)}
              style={[
                styles.filterChip,
                isActive && styles.filterChipActive,
              ]}
            >
              <Text style={[
                styles.filterChipText,
                isActive && styles.filterChipTextActive,
              ]}>
                {t === 'all' ? `All (${count})` : `${PROVIDER_TYPE_LABELS[t] || t} (${count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );

  const ListFooter = () => (
    <>
      {filtered.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="cloud-off-outline" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyText}>No providers found for this filter.</Text>
        </View>
      )}

      {/* Leaderboard */}
      <Text style={styles.sectionTitle}>Efficiency Leaderboard</Text>
      <View style={styles.leaderboardCard}>
        {lbEntries.length === 0 ? (
          <Text style={styles.lbEmpty}>
            No benchmark data yet. Data accumulates as providers are used.
          </Text>
        ) : (
          <>
            {/* Header row */}
            <View style={[styles.lbRow, styles.lbHeaderRow]}>
              <Text style={[styles.lbHeaderCell, { width: 28 }]}>#</Text>
              <Text style={[styles.lbHeaderCell, { flex: 1 }]}>Provider</Text>
              <Text style={[styles.lbHeaderCell, { flex: 1 }]}>Model</Text>
              <Text style={[styles.lbHeaderCell, { width: 56 }]}>Eff.</Text>
              <Text style={[styles.lbHeaderCell, { width: 58 }]}>Speed</Text>
            </View>
            {lbEntries.map((entry, i) => (
              <LeaderboardRow
                key={`${entry.provider_id}:${entry.model_id}`}
                entry={entry}
                rank={i + 1}
              />
            ))}
          </>
        )}
      </View>
      <View style={{ height: hp(4) }} />
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Provider Management</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <MaterialCommunityIcons name="refresh" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading providers...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderProvider}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  backBtn: {
    marginRight: wp(3),
  },
  title: {
    color: colors.textPrimary,
    fontSize: wp(5),
    fontWeight: fontWeight.bold,
  },
  refreshBtn: {
    padding: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: wp(4),
    paddingTop: hp(2),
  },

  // ── Resource / gateway bar ──
  resourceBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.backgroundTertiary,
  },

  // ── Filter chips ──
  filterScroll: {
    marginBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundTertiary,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  filterChipTextActive: {
    color: colors.textPrimary,
  },

  // ── Provider card ──
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.backgroundTertiary,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  providerName: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    flexShrink: 1,
  },
  providerId: {
    color: colors.textDisabled,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // ── Badges ──
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  healthLabel: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },

  // ── Categories ──
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.accent + '15',
  },
  categoryText: {
    fontSize: 11,
    color: '#9990ff',
    fontWeight: fontWeight.medium,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  statText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // ── API key section ──
  keySection: {
    marginBottom: 8,
  },
  keyConfigured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keySetText: {
    fontSize: fontSize.xs,
    color: '#4CAF50',
  },
  btnSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.backgroundTertiary,
  },
  btnSmallText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  keyInputRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  keyInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.backgroundTertiary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.textPrimary,
    fontSize: fontSize.xs,
  },

  // ── Action buttons ──
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  btnAction: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  btnActionText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // ── Toast ──
  toastContainer: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  toastDetail: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  toastClose: {
    padding: 4,
  },

  // ── Leaderboard ──
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  leaderboardCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.backgroundTertiary,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.backgroundTertiary,
  },
  lbHeaderRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundTertiary,
    marginBottom: 2,
  },
  lbCell: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  lbHeaderCell: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  lbEmpty: {
    color: colors.textDisabled,
    fontSize: fontSize.xs,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  // ── States ──
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: hp(6),
  },
  emptyText: {
    color: colors.textDisabled,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
});
