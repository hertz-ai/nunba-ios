/**
 * ThemeSettingsScreen — RN parity for the web SPA's
 * landing-page/src/components/Social/Settings/ThemeSettingsPage.jsx.
 *
 * RN-simplified scope (intentional — see NUNBA_PARITY.md):
 *   - Preset grid (8 curated dark themes) with active-chip + swatches
 *   - Apply preset → themeApi.apply(id) + local Zustand setTheme()
 *   - AI generator: free-text prompt → themeApi.generate() → preview +
 *     apply.
 *   - Reset to default (top-right icon button).
 *   - Status banner for success/error feedback.
 *
 * Dropped vs web (deferred — would need web-only deps):
 *   - Per-color HexColorPicker (`react-colorful` is web-only).
 *   - Animation intensity sliders + glassmorphism knobs (require
 *     full ThemeContext mirror; out of scope for v1 RN port).
 *   - Font picker (font hot-swap requires deeper RN integration).
 *   - Live preview via setPreviewTheme() — RN's local store doesn't
 *     yet have a "preview-only" channel; tap-to-apply is direct.
 *
 * Backend (HARTOS — routes/api_theme.py):
 *   GET  /api/social/theme/presets           — list (we use local
 *                                              themePresets for swatches)
 *   GET  /api/social/theme/active            — current user theme
 *   POST /api/social/theme/apply             — activate by id
 *   POST /api/social/theme/customize         — partial overrides
 *   POST /api/social/theme/generate          — AI generation
 *
 * Service: services/socialApi.js → themeApi.{apply, generate, getActive}.
 * Local state: colorThemeZustand.js (existing setTheme).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { themeApi } from '../../../services/socialApi';
import {
  THEME_PRESETS,
  DEFAULT_THEME_CONFIG,
  findPresetById,
} from '../../../theme/themePresets';
import useThemeStore from '../../../colorThemeZustand';

const ACCENT = '#6C63FF';
const ACCENT_GREEN = '#00e89d';
const MUTED = '#888';

const unwrap = (res) => {
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

const ThemeSettingsScreen = () => {
  const setTheme = useThemeStore((s) => s.setTheme);
  const [activeId, setActiveId] = useState(DEFAULT_THEME_CONFIG.id);
  const [applying, setApplying] = useState(null); // preset id currently applying
  const [message, setMessage] = useState(null);

  // AI generator state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null); // generated theme awaiting apply

  // Fetch the user's currently-active theme on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await themeApi.getActive();
        const theme = unwrap(res);
        if (!cancelled && theme && theme.id) {
          setActiveId(theme.id);
        }
      } catch (_) {
        // Ignore — fall back to DEFAULT_THEME_CONFIG.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyLocally = useCallback(
    (theme) => {
      // Push to the local Zustand store so any listening components
      // can re-render with the new color set.
      try {
        setTheme(theme);
      } catch (_) {
        // setTheme is a no-op if the store isn't wired — preserves
        // zero-regression for older builds that don't subscribe.
      }
    },
    [setTheme],
  );

  const handleApplyPreset = useCallback(
    async (preset) => {
      setApplying(preset.id);
      setMessage(null);
      try {
        await themeApi.apply(preset.id);
        setActiveId(preset.id);
        applyLocally(preset);
        setMessage({ type: 'success', text: 'Theme applied.' });
      } catch (e) {
        setMessage({
          type: 'error',
          text: e?.message || 'Failed to apply theme.',
        });
      } finally {
        setApplying(null);
      }
    },
    [applyLocally],
  );

  const handleReset = useCallback(async () => {
    setApplying('reset');
    setMessage(null);
    try {
      await themeApi.apply(DEFAULT_THEME_CONFIG.id);
      setActiveId(DEFAULT_THEME_CONFIG.id);
      applyLocally(DEFAULT_THEME_CONFIG);
      setMessage({ type: 'success', text: 'Reset to default theme.' });
    } catch (e) {
      setMessage({
        type: 'error',
        text: e?.message || 'Failed to reset theme.',
      });
    } finally {
      setApplying(null);
    }
  }, [applyLocally]);

  const handleAiGenerate = useCallback(async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    setAiGenerating(true);
    setAiResult(null);
    setMessage(null);
    try {
      const res = await themeApi.generate(prompt);
      const generated = unwrap(res);
      // Server returns either a theme object directly or {theme: {...}}.
      const theme =
        generated && (generated.theme || generated.id ? generated : null);
      const normalized =
        theme && theme.theme ? theme.theme : theme;
      if (normalized && normalized.id) {
        setAiResult(normalized);
      } else {
        setMessage({ type: 'error', text: 'Could not generate theme.' });
      }
    } catch (e) {
      setMessage({
        type: 'error',
        text: e?.message || 'AI generation failed — try again.',
      });
    } finally {
      setAiGenerating(false);
    }
  }, [aiPrompt]);

  const handleApplyAiTheme = useCallback(async () => {
    if (!aiResult) return;
    setApplying('ai');
    try {
      // Send back to server as a customize payload so it lives across
      // sessions; the server returns the merged record.
      await themeApi.customize(aiResult);
      setActiveId(aiResult.id || 'custom');
      applyLocally(aiResult);
      setMessage({ type: 'success', text: 'AI theme applied.' });
      setAiResult(null);
      setAiPrompt('');
    } catch (e) {
      setMessage({
        type: 'error',
        text: e?.message || 'Could not save AI theme.',
      });
    } finally {
      setApplying(null);
    }
  }, [aiResult, applyLocally]);

  const renderSwatchRow = (colors, sizes = 18) =>
    [colors.background, colors.paper, colors.primary, colors.secondary].map(
      (c, i) => (
        <View
          key={i}
          style={[
            styles.swatch,
            { width: sizes, height: sizes, borderRadius: sizes / 2, backgroundColor: c },
          ]}
        />
      ),
    );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="theme-settings-screen"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="palette" size={20} color={ACCENT} />
          <Text style={styles.heading}>Appearance</Text>
        </View>
        <TouchableOpacity
          onPress={handleReset}
          disabled={applying === 'reset'}
          accessibilityRole="button"
          accessibilityLabel="Reset to default theme"
          testID="theme-reset"
          style={styles.iconButton}
        >
          {applying === 'reset' ? (
            <ActivityIndicator size="small" color={MUTED} />
          ) : (
            <MaterialIcons name="restart-alt" size={20} color={MUTED} />
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.subtle}>
        Pick a curated theme or generate one with AI. Active theme syncs to
        every device on your account.
      </Text>

      {message && (
        <View
          style={[
            styles.banner,
            message.type === 'error' ? styles.bannerError : styles.bannerOk,
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.bannerText}>{message.text}</Text>
          <TouchableOpacity
            onPress={() => setMessage(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            testID="theme-banner-dismiss"
          >
            <MaterialIcons name="close" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Section: Curated Presets ── */}
      <Text style={styles.sectionLabel}>PRESETS</Text>
      <View style={styles.presetGrid}>
        {THEME_PRESETS.map((preset) => {
          const isActive = activeId === preset.id;
          const isApplying = applying === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              onPress={() => handleApplyPreset(preset)}
              disabled={isActive || isApplying}
              style={[
                styles.presetCard,
                isActive && {
                  borderColor: preset.colors.primary,
                  borderWidth: 2,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Apply ${preset.name} theme`}
              testID={`theme-preset-${preset.id}`}
            >
              {isActive && (
                <View
                  style={[
                    styles.activeChip,
                    { backgroundColor: preset.colors.primary },
                  ]}
                >
                  <MaterialIcons name="check" size={11} color="#FFF" />
                  <Text style={styles.activeChipText}>Active</Text>
                </View>
              )}
              {isApplying && (
                <ActivityIndicator
                  size="small"
                  color={preset.colors.primary}
                  style={styles.applyingSpinner}
                />
              )}
              <View style={styles.swatchRow}>
                {renderSwatchRow(preset.colors)}
              </View>
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetDesc} numberOfLines={2}>
                {preset.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Section: AI Generator ── */}
      <Text style={styles.sectionLabel}>AI THEME GENERATOR</Text>
      <View style={styles.aiCard}>
        <Text style={styles.aiHelp}>
          Describe your ideal theme and AI will generate colors for you.
        </Text>
        <View style={styles.aiInputRow}>
          <TextInput
            style={styles.aiInput}
            value={aiPrompt}
            onChangeText={setAiPrompt}
            placeholder="e.g. calm ocean at twilight"
            placeholderTextColor={MUTED}
            autoCapitalize="none"
            testID="theme-ai-prompt"
          />
          <TouchableOpacity
            onPress={handleAiGenerate}
            disabled={aiGenerating || !aiPrompt.trim()}
            style={[
              styles.aiButton,
              (aiGenerating || !aiPrompt.trim()) && styles.aiButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Generate theme"
            testID="theme-ai-generate"
          >
            {aiGenerating ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.aiButtonText}>Generate</Text>
            )}
          </TouchableOpacity>
        </View>

        {aiResult && (
          <View style={styles.aiResultCard} testID="theme-ai-result">
            <Text style={styles.aiResultName}>
              {aiResult.name || 'Generated Theme'}
            </Text>
            <View style={styles.swatchRow}>
              {renderSwatchRow(aiResult.colors || {}, 22)}
            </View>
            <View style={styles.aiResultActions}>
              <TouchableOpacity
                onPress={() => setAiResult(null)}
                style={[styles.button, styles.outlineButton]}
                accessibilityRole="button"
                testID="theme-ai-discard"
              >
                <Text style={styles.outlineButtonText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApplyAiTheme}
                disabled={applying === 'ai'}
                style={[
                  styles.button,
                  styles.primaryButton,
                  applying === 'ai' && styles.primaryButtonDisabled,
                ]}
                accessibilityRole="button"
                testID="theme-ai-apply"
              >
                {applying === 'ai' ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: wp('4%') },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('0.6%'),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
  },
  subtle: { color: MUTED, fontSize: wp('3.2%'), marginBottom: hp('1.5%') },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.2%'),
    borderRadius: 8,
    marginBottom: hp('1.5%'),
  },
  bannerOk: { backgroundColor: 'rgba(0,232,157,0.15)' },
  bannerError: { backgroundColor: 'rgba(255,107,107,0.18)' },
  bannerText: { color: '#FFF', fontSize: wp('3.2%'), flex: 1, marginRight: 8 },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: wp('2.8%'),
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: hp('1%'),
    marginBottom: hp('1%'),
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  presetCard: {
    width: '48%',
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('3%'),
    marginBottom: hp('1.2%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  activeChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  activeChipText: { color: '#FFF', fontSize: wp('2.5%'), fontWeight: '700' },
  applyingSpinner: { position: 'absolute', top: 8, right: 8 },
  swatchRow: { flexDirection: 'row', gap: 4, marginBottom: hp('1%') },
  swatch: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  presetName: {
    color: '#FFF',
    fontSize: wp('3.4%'),
    fontWeight: '700',
    marginBottom: 2,
  },
  presetDesc: {
    color: MUTED,
    fontSize: wp('2.8%'),
    lineHeight: wp('4%'),
  },
  aiCard: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: hp('2%'),
  },
  aiHelp: { color: MUTED, fontSize: wp('3.2%'), marginBottom: hp('1%') },
  aiInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.1%'),
    fontSize: wp('3.4%'),
  },
  aiButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderRadius: 8,
    minWidth: wp('22%'),
    alignItems: 'center',
  },
  aiButtonDisabled: { backgroundColor: 'rgba(108,99,255,0.5)' },
  aiButtonText: { color: '#FFF', fontWeight: '700', fontSize: wp('3.2%') },
  aiResultCard: {
    marginTop: hp('1.5%'),
    padding: wp('3%'),
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  aiResultName: {
    color: '#FFF',
    fontSize: wp('3.6%'),
    fontWeight: '600',
    marginBottom: hp('0.8%'),
  },
  aiResultActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: hp('1%'),
  },
  button: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.9%'),
    borderRadius: 8,
    alignItems: 'center',
    minWidth: wp('20%'),
  },
  primaryButton: { backgroundColor: ACCENT },
  primaryButtonDisabled: { backgroundColor: 'rgba(108,99,255,0.5)' },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: wp('3.2%') },
  outlineButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  outlineButtonText: { color: MUTED, fontWeight: '600', fontSize: wp('3.2%') },
  iconButton: { padding: 6 },
});

export default ThemeSettingsScreen;
