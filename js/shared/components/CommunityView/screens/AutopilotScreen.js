/**
 * AutopilotScreen — RN parity for the web SPA's
 * landing-page/src/components/Social/Autopilot/AutopilotPage.jsx.
 *
 * RN-simplified scope (see NUNBA_PARITY.md):
 *   - Master enable toggle.
 *   - Agent mode selector (suggest/auto/off).
 *   - 6 agent toggles (games/learning/content/wellness/social/creative).
 *   - 6 automation toggles (dailyDigest/smartReminders/etc.).
 *   - Interest chip multiselect (technology/health/education/...).
 *   - Time-of-day suggestions list (clickable → navigation).
 *   - Daily content card.
 *
 * Dropped vs web (deferred — see autopilotStore.js docstring):
 *   - Pattern detection (peak-activity / daily-routine / repeated-search
 *     / game-affinity).  Heavy local activity log + analytics.
 *   - Agent dispatch chain orchestration — needs a backend dispatch
 *     endpoint wired into a Hevolve_RN agentDispatchApi.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import {
  ACTION_ROUTES,
  AGENT_MODES,
  AGENT_OPTIONS,
  AUTOMATION_OPTIONS,
  DEFAULT_CONFIG,
  INTEREST_OPTIONS,
  getAutopilotConfig,
  getDailyContent,
  getTimeSuggestions,
  saveAutopilotConfig,
} from '../../../autopilotStore';

const ACCENT = '#6C63FF';
const ACCENT_GREEN = '#00e89d';
const MUTED = '#888';

const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    {icon ? (
      <MaterialIcons name={icon} size={16} color={MUTED} />
    ) : null}
    <Text style={styles.sectionLabel}>{title}</Text>
  </View>
);

const AutopilotScreen = () => {
  const navigation = useNavigation();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getAutopilotConfig();
      if (!cancelled) {
        setConfig(c);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change once we've finished loading.  Skipping
  // the pre-load write avoids stomping the saved config with the
  // default during the initial render.
  useEffect(() => {
    if (!loaded) return;
    saveAutopilotConfig(config);
  }, [config, loaded]);

  const timeSuggestions = useMemo(
    () => getTimeSuggestions(config),
    [config],
  );
  const dailyContent = useMemo(
    () => getDailyContent(config),
    [config],
  );

  const toggleField = useCallback((key) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleAgent = useCallback((key) => {
    setConfig((prev) => ({
      ...prev,
      agents: { ...(prev.agents || {}), [key]: !prev.agents?.[key] },
    }));
  }, []);

  const setAgentMode = useCallback((mode) => {
    setConfig((prev) => ({ ...prev, agentMode: mode }));
  }, []);

  const toggleInterest = useCallback((label) => {
    const lower = label.toLowerCase();
    setConfig((prev) => {
      const interests = prev.interests || [];
      const next = interests.includes(lower)
        ? interests.filter((i) => i !== lower)
        : [...interests, lower];
      return { ...prev, interests: next };
    });
  }, []);

  const handleSuggestionPress = useCallback(
    (action) => {
      const route = ACTION_ROUTES[action];
      if (route && route[0]) {
        navigation.navigate(route[0]);
      }
    },
    [navigation],
  );

  if (!loaded) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={ACCENT_GREEN} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="autopilot-screen"
    >
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <MaterialIcons name="auto-awesome" size={22} color="#FFF" />
          <Text style={styles.headerTitle}>Nunba Autopilot</Text>
          <Switch
            value={!!config.enabled}
            onValueChange={() => toggleField('enabled')}
            trackColor={{ false: '#3a3a4e', true: 'rgba(0,232,157,0.4)' }}
            thumbColor={config.enabled ? ACCENT_GREEN : '#bbb'}
            testID="autopilot-master-toggle"
          />
        </View>
        <Text style={styles.headerSub}>
          Your intelligent life assistant. Nunba learns your patterns
          and helps you stay on track.
        </Text>
      </View>

      {/* ── Daily content ── */}
      {dailyContent && (
        <View style={styles.dailyCard} testID="autopilot-daily-content">
          <Text style={styles.dailyEmoji}>{dailyContent.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.dailyTitle}>{dailyContent.title}</Text>
            <Text style={styles.dailyBody}>{dailyContent.content}</Text>
          </View>
        </View>
      )}

      {/* ── Your Day timeline ── */}
      {config.enabled && timeSuggestions.length > 0 && (
        <View style={styles.section}>
          <SectionHeader icon="timeline" title="YOUR DAY" />
          {timeSuggestions.map((s, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSuggestionPress(s.action)}
              style={styles.suggestionRow}
              accessibilityRole="button"
              accessibilityLabel={s.text}
              testID={`autopilot-suggestion-${s.action}`}
            >
              <Text style={styles.suggestionIcon}>{s.icon}</Text>
              <Text style={styles.suggestionText}>{s.text}</Text>
              <MaterialIcons
                name="chevron-right"
                size={18}
                color={MUTED}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Agent mode ── */}
      <View style={styles.section}>
        <SectionHeader icon="tune" title="AGENT MODE" />
        <View style={styles.modeRow}>
          {AGENT_MODES.map((m) => {
            const active = config.agentMode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setAgentMode(m.key)}
                style={[styles.modeChip, active && styles.modeChipActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                testID={`autopilot-mode-${m.key}`}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    active && styles.modeChipTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.modeHint}>
          {AGENT_MODES.find((m) => m.key === config.agentMode)?.desc || ''}
        </Text>
      </View>

      {/* ── Agents ── */}
      <View style={styles.section}>
        <SectionHeader icon="smart-toy" title="AGENTS" />
        {AGENT_OPTIONS.map((a) => {
          const enabled = !!config.agents?.[a.key];
          return (
            <View
              key={a.key}
              style={styles.toggleRow}
              testID={`autopilot-agent-${a.key}`}
            >
              <MaterialIcons name={a.icon} size={20} color={MUTED} />
              <View style={styles.toggleRowText}>
                <Text style={styles.toggleRowLabel}>{a.label}</Text>
                <Text style={styles.toggleRowDesc}>{a.desc}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={() => toggleAgent(a.key)}
                trackColor={{
                  false: '#3a3a4e',
                  true: 'rgba(108,99,255,0.4)',
                }}
                thumbColor={enabled ? ACCENT : '#bbb'}
                testID={`autopilot-agent-toggle-${a.key}`}
              />
            </View>
          );
        })}
      </View>

      {/* ── Automations ── */}
      <View style={styles.section}>
        <SectionHeader icon="check-circle-outline" title="AUTOMATIONS" />
        {AUTOMATION_OPTIONS.map((a) => {
          const enabled = !!config[a.key];
          return (
            <View
              key={a.key}
              style={styles.toggleRow}
              testID={`autopilot-automation-${a.key}`}
            >
              <Text style={styles.automationEmoji}>{a.icon}</Text>
              <View style={styles.toggleRowText}>
                <Text style={styles.toggleRowLabel}>{a.label}</Text>
                <Text style={styles.toggleRowDesc}>{a.desc}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={() => toggleField(a.key)}
                trackColor={{
                  false: '#3a3a4e',
                  true: 'rgba(108,99,255,0.4)',
                }}
                thumbColor={enabled ? ACCENT : '#bbb'}
                testID={`autopilot-automation-toggle-${a.key}`}
              />
            </View>
          );
        })}
      </View>

      {/* ── Interests ── */}
      <View style={styles.section}>
        <SectionHeader icon="lightbulb" title="INTERESTS" />
        <View style={styles.chipsWrap}>
          {INTEREST_OPTIONS.map((label) => {
            const active = (config.interests || []).includes(
              label.toLowerCase(),
            );
            return (
              <TouchableOpacity
                key={label}
                onPress={() => toggleInterest(label)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`autopilot-interest-${label.toLowerCase()}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: wp('4%') },
  headerCard: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    padding: wp('4%'),
    marginBottom: hp('2%'),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: hp('0.5%'),
  },
  headerTitle: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '800',
    flex: 1,
  },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: wp('3%') },
  dailyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('3.5%'),
    marginBottom: hp('1.8%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  dailyEmoji: { fontSize: wp('7%') },
  dailyTitle: { color: '#FFF', fontSize: wp('3.6%'), fontWeight: '700' },
  dailyBody: {
    color: MUTED,
    fontSize: wp('3.1%'),
    marginTop: 2,
    lineHeight: wp('4.4%'),
  },
  section: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('3.5%'),
    marginBottom: hp('1.8%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: hp('1%'),
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: wp('2.7%'),
    fontWeight: '700',
    letterSpacing: 1,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('0.8%'),
    paddingHorizontal: wp('2%'),
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 10,
    marginBottom: hp('0.5%'),
  },
  suggestionIcon: { fontSize: wp('5%') },
  suggestionText: { color: '#FFF', fontSize: wp('3.2%'), flex: 1 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: hp('0.4%') },
  modeChip: {
    flex: 1,
    paddingVertical: hp('0.9%'),
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  modeChipActive: { backgroundColor: 'rgba(108,99,255,0.25)' },
  modeChipText: { color: MUTED, fontSize: wp('3.2%'), fontWeight: '600' },
  modeChipTextActive: { color: '#FFF' },
  modeHint: { color: MUTED, fontSize: wp('2.8%'), marginTop: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  toggleRowText: { flex: 1 },
  toggleRowLabel: { color: '#FFF', fontSize: wp('3.4%'), fontWeight: '600' },
  toggleRowDesc: {
    color: MUTED,
    fontSize: wp('2.9%'),
    marginTop: 2,
    lineHeight: wp('4%'),
  },
  automationEmoji: { fontSize: wp('5%'), width: 24, textAlign: 'center' },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.6%'),
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(108,99,255,0.18)',
    borderColor: ACCENT,
  },
  chipText: { color: MUTED, fontSize: wp('3%'), fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
});

export default AutopilotScreen;
