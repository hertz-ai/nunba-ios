/**
 * ProposeExperimentScreen — Form to author a new Thought Experiment.
 *
 * Closes gap thought-exp-fab (2026-06-20): ExperimentDiscoveryScreen had no
 * "+ Propose" affordance even though the empty-state copy invited it and
 * experimentsApi.create has been wired in services/socialApi.js for weeks.
 *
 * Pattern matches CreateCommunityScreen (presentation:'modal', dark theme,
 * defensive submit() with per-step try/catch + toast).  Backend contract:
 *   POST /experiments  { title, hypothesis, intent_category, experiment_type, description? }
 *
 * Caller:
 *   navigation.navigate('ProposeExperiment', {
 *     onCreated: (created) => refreshDiscovery(),
 *   });
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { experimentsApi } from '../../../services/socialApi';
import { colors, INTENT_COLORS, INTENT_LABELS, INTENT_ICONS } from '../../../theme/colors';

const INTENT_KEYS = ['technology', 'health', 'education', 'environment', 'community', 'equity'];

const EXPERIMENT_TYPES = [
  { key: 'physical_ai', label: 'Physical AI', icon: 'camera' },
  { key: 'software', label: 'Software', icon: 'code' },
];

const _toast = (msg) => {
  try {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    }
  } catch (_) {}
};

const ProposeExperimentScreen = ({ navigation, route }) => {
  const onCreated = route?.params?.onCreated;
  const [title, setTitle] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [description, setDescription] = useState('');
  const [intentCategory, setIntentCategory] = useState('technology');
  const [experimentType, setExperimentType] = useState('software');
  const [submitting, setSubmitting] = useState(false);

  const close = () => { try { navigation.goBack(); } catch (_) {} };

  const submit = async () => {
    const trimmedTitle = (title || '').trim();
    const trimmedHypothesis = (hypothesis || '').trim();
    const trimmedDescription = (description || '').trim();

    if (!trimmedTitle) {
      _toast('Title is required');
      return;
    }
    if (!trimmedHypothesis) {
      _toast('Hypothesis is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: trimmedTitle,
        hypothesis: trimmedHypothesis,
        intent_category: intentCategory,
        experiment_type: experimentType,
      };
      if (trimmedDescription) payload.description = trimmedDescription;

      const res = await experimentsApi.create(payload);

      if (!res || typeof res !== 'object') {
        _toast('Propose failed: empty server response');
        setSubmitting(false);
        return;
      }
      if (res.error && !res.id && !(res.data && res.data.id)) {
        _toast(`Propose failed: ${res.error || 'server error'}`);
        setSubmitting(false);
        return;
      }
      const created = (res.data || res) || null;
      if (!created || !created.id) {
        _toast('Propose failed: backend did not return an experiment id');
        setSubmitting(false);
        return;
      }
      if (typeof onCreated === 'function') {
        try { onCreated(created); } catch (_) {}
      }
      try { _toast('Thought experiment proposed'); } catch (_) {}
      setSubmitting(false);
      setTimeout(() => {
        try { navigation.goBack(); } catch (_) {}
      }, 50);
    } catch (e) {
      const msg = (e && (e.message || String(e))) || 'Network error';
      try { _toast(`Propose failed: ${msg}`); } catch (_) {}
      setSubmitting(false);
    }
  };

  const canSubmit = title.trim().length > 0 && hypothesis.trim().length > 0 && !submitting;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={close}
          style={styles.headerBtn}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Propose Experiment</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Can phones predict mood from gait?"
            placeholderTextColor={colors.textMuted}
            autoFocus
            maxLength={120}
            accessibilityLabel="Experiment title"
          />

          <Text style={styles.label}>Hypothesis</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={hypothesis}
            onChangeText={setHypothesis}
            placeholder="What do you believe will happen, and why?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            maxLength={500}
            accessibilityLabel="Experiment hypothesis"
          />

          <Text style={styles.label}>Intent</Text>
          <View style={styles.chipWrap}>
            {INTENT_KEYS.map((key) => {
              const selected = intentCategory === key;
              const tint = INTENT_COLORS[key] || colors.accent;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.chip,
                    selected && {
                      backgroundColor: tint + '33',
                      borderColor: tint,
                    },
                  ]}
                  onPress={() => setIntentCategory(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}>
                  <MaterialCommunityIcons
                    name={INTENT_ICONS[key] || 'flask'}
                    size={14}
                    color={selected ? tint : colors.textMuted}
                  />
                  <Text style={[styles.chipText, selected && { color: tint }]}>
                    {INTENT_LABELS[key] || key}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Type</Text>
          <View style={styles.chipWrap}>
            {EXPERIMENT_TYPES.map((t) => {
              const selected = experimentType === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.chip,
                    selected && {
                      backgroundColor: colors.accent + '33',
                      borderColor: colors.accent,
                    },
                  ]}
                  onPress={() => setExperimentType(t.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}>
                  <MaterialIcons
                    name={t.icon}
                    size={14}
                    color={selected ? colors.accent : colors.textMuted}
                  />
                  <Text style={[styles.chipText, selected && { color: colors.accent }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Background, prior work, or how you'd run this..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={1000}
            accessibilityLabel="Experiment description"
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={close}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, !canSubmit && { opacity: 0.6 }]}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Propose experiment">
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.btnPrimaryText}>Propose</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: 'center' },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: { flex: 1 },
  scrollContent: { padding: wp('5%'), paddingBottom: 40 },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 6,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  btn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    marginLeft: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  btnGhost: { backgroundColor: colors.card },
  btnGhostText: { color: colors.text, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
});

export default ProposeExperimentScreen;
