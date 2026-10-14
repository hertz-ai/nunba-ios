import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useChannelStore from '../../../channelStore';
import InAppOAuthService from '../../../services/InAppOAuthService';

// TEMP DEBUG (2026-07-27) — real devices have no way to set the
// hevolve_api_base AsyncStorage override (simulator testing did this by
// editing the app container's manifest.json directly on disk, not possible
// on hardware). Long-press the header title to point this device at a
// local HARTOS server for testing real-gateway channels (e.g. WhatsApp),
// bypassing the cloud deploy gap. Remove once there's a real debug menu.
const _promptApiBaseOverride = async () => {
  const current = (await AsyncStorage.getItem('hevolve_api_base')) || '';
  Alert.prompt(
    'API Base Override',
    `Current: ${current || '(none — using cloud)'}\n\nEnter a local server URL (e.g. http://192.168.1.7:6777), or leave blank to clear.`,
    async (value) => {
      const trimmed = (value || '').trim();
      if (trimmed) {
        await AsyncStorage.setItem('hevolve_api_base', trimmed);
        Alert.alert('Saved', `Now pointing at: ${trimmed}`);
      } else {
        await AsyncStorage.removeItem('hevolve_api_base');
        Alert.alert('Cleared', 'Back to normal endpoint resolution (cloud).');
      }
    },
    'plain-text',
    current,
  );
};

// TEMP DEBUG (2026-07-28) — the app's normal token self-heal
// (ensureFreshHartosToken) chains through Hevolve's cloud refresh
// endpoint even when pointed at a local server override, and that cloud
// endpoint has a strict rate limit (1/sec, 5/min, 15/hour, 300/day) that
// heavy local testing exhausts, silently breaking the self-heal (it
// swallows the failure and leaves the stale/expired token in place).
// Single-tap the header to inject a known-good local HARTOS bearer
// token directly into the Keychain, bypassing that chain entirely for
// local testing. Remove once there's a real debug menu.
const _promptHartosTokenOverride = async () => {
  const m = NativeModules.OnboardingModule;
  const current = await new Promise((resolve) => {
    if (typeof m?.getHartosToken !== 'function') return resolve('');
    m.getHartosToken((t) => resolve(t || ''));
  });
  Alert.prompt(
    'HARTOS Token Override',
    `Current len=${current.length} tail=${current.slice(-8)}\n\nPaste a known-good bearer token to inject directly (bypasses the cloud refresh chain).`,
    async (value) => {
      const trimmed = (value || '').trim();
      if (trimmed && typeof m?.setHartosToken === 'function') {
        await m.setHartosToken(trimmed);
        Alert.alert('Saved', `Token set (len=${trimmed.length}).`);
      }
    },
    'plain-text',
    '',
  );
};

// TEMP DIAGNOSTIC (2026-07-06, fixed 2026-07-08) — remove once the
// token-expiry loop is root-caused. Surfaces what actually authenticates
// the Connect call. Was reading getAccessToken() (the Hevolve OTP token),
// but /api/social/* calls send the separate HARTOS token — that mismatch
// meant this diagnostic could never explain a "Missing or invalid
// Authorization header" failure. Also surfaces which host endpointResolver
// picked, since cloud-vs-local routing is the other leading theory.
const _debugToken = () =>
  new Promise((resolve) => {
    try {
      NativeModules.OnboardingModule.getHartosToken((t) => resolve(t || ''));
    } catch (_) {
      resolve('<threw>');
    }
  });

const _debugSource = async () => {
  try {
    const resolver = require('../../../services/endpointResolver').default;
    const { url, source } = await resolver.getApiBase();
    return `${source} (${url})`;
  } catch (e) {
    return `<threw: ${e?.message}>`;
  }
};

const CHANNEL_COLORS = {
  whatsapp: '#25D366',
  telegram: '#0088cc',
  discord: '#5865F2',
  slack: '#4A154B',
  email: '#EA4335',
  sms: '#6C63FF',
  webhook: '#FF6B35',
  default: '#6C63FF',
};

const CHANNEL_ICONS = {
  whatsapp: 'whatsapp',
  telegram: 'telegram',
  discord: 'discord',
  slack: 'slack',
  email: 'email-outline',
  sms: 'message-text-outline',
  webhook: 'webhook',
  default: 'connection',
};

const getColor = (ch) => CHANNEL_COLORS[(ch || '').toLowerCase()] || CHANNEL_COLORS.default;
const getIcon = (ch) => CHANNEL_ICONS[(ch || '').toLowerCase()] || CHANNEL_ICONS.default;

// WhatsApp's real backend auth_method is 'gateway_qr' (Baileys gateway QR
// pairing); 'qr_session' covers other QR-paired channels. Both render the
// same scan-QR UI.
const isQrAuth = (authMethod) => authMethod === 'qr_session' || authMethod === 'gateway_qr';

const ChannelSetupScreen = () => {
  const navigation = useNavigation();
  const catalog = useChannelStore((s) => s.catalog);
  const catalogLoading = useChannelStore((s) => s.catalogLoading);
  const fetchCatalog = useChannelStore((s) => s.fetchCatalog);
  const createBinding = useChannelStore((s) => s.createBinding);

  const [step, setStep] = useState(1);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [connecting, setConnecting] = useState(false);
  // QR channels (e.g. WhatsApp) default to the QR button; this reveals the
  // old manual field-entry form alongside it for users who want it.
  const [showManualSetup, setShowManualSetup] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleSelectChannel = (channelKey, channelDef) => {
    setSelectedChannel({ key: channelKey, ...channelDef });
    setFormValues({});
    setShowManualSetup(false);
    setStep(2);
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedChannel(null);
      setFormValues({});
      setShowManualSetup(false);
    } else {
      navigation.goBack();
    }
  };

  // Ported from Android (#464/#465): in-app PKCE OAuth click-through for
  // auth_method 'oauth2' channels (Teams, Google Chat, etc). Same
  // createBinding call as handleConnect, keyed by channel_type (matches
  // the backend field fixed 2026-07-08).
  const oauthSubRef = useRef(null);
  const handleOAuthConnect = useCallback(async () => {
    if (!selectedChannel) return;
    setConnecting(true);
    try {
      const token = await InAppOAuthService.startOAuth(selectedChannel.key);
      await createBinding({
        channel_type: selectedChannel.key,
        access_token: token.access_token,
        scope: token.scope,
      });
      Alert.alert(
        'Connected',
        `${selectedChannel.name || selectedChannel.key} authorized successfully.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      Alert.alert(
        'Authorization Failed',
        err?.message || 'The provider did not authorize the connection.',
      );
    } finally {
      setConnecting(false);
    }
  }, [selectedChannel, navigation, createBinding]);

  useEffect(() => () => {
    if (oauthSubRef.current) oauthSubRef.current.remove?.();
  }, []);

  const handleConnect = async () => {
    if (!selectedChannel) return;

    setConnecting(true);
    try {
      const payload = {
        channel_type: selectedChannel.key,
        ...formValues,
      };
      const res = await createBinding(payload);
      if (res.success) {
        Alert.alert('Connected', `${selectedChannel.name || selectedChannel.key} has been connected.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        const tok = await _debugToken();
        const src = await _debugSource();
        Alert.alert(
          'Error',
          `${res.error || 'Failed to connect channel. Please try again.'}\n\n[debug] hartos token len=${tok.length} tail=${tok.slice(-8)}\n[debug] endpoint=${src}`,
        );
      }
    } catch (e) {
      const tok = await _debugToken();
      const src = await _debugSource();
      Alert.alert('Error', `Failed to connect channel. Please try again.\n\n[debug] ${e?.message}\n[debug] hartos token len=${tok.length} tail=${tok.slice(-8)}\n[debug] endpoint=${src}`);
    } finally {
      setConnecting(false);
    }
  };

  const setField = (key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  // Group channels by category
  const groupedChannels = {};
  if (catalog && typeof catalog === 'object') {
    Object.entries(catalog).forEach(([key, def]) => {
      const cat = def.category || 'Other';
      if (!groupedChannels[cat]) groupedChannels[cat] = [];
      groupedChannels[cat].push({ key, ...def });
    });
  }

  const renderStep1 = () => (
    <ScrollView
      style={styles.scrollContent}
      contentContainerStyle={styles.scrollInner}
      showsVerticalScrollIndicator={false}
    >
      {catalogLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Loading channels...</Text>
        </View>
      ) : Object.keys(groupedChannels).length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="connection" size={48} color="#555" />
          <Text style={styles.emptyText}>No channels available</Text>
        </View>
      ) : (
        Object.entries(groupedChannels).map(([category, channels]) => (
          <Animatable.View key={category} animation="fadeInUp" delay={100}>
            <Text style={styles.categoryLabel}>{category}</Text>
            <View style={styles.channelGrid}>
              {channels.map((ch) => {
                const color = getColor(ch.key);
                const icon = getIcon(ch.key);
                return (
                  <TouchableOpacity
                    key={ch.key}
                    style={styles.channelCard}
                    activeOpacity={0.7}
                    onPress={() => handleSelectChannel(ch.key, ch)}
                  >
                    <View style={[styles.channelIconBg, { backgroundColor: color + '22' }]}>
                      <MaterialCommunityIcons name={icon} size={28} color={color} />
                    </View>
                    <Text style={styles.channelName} numberOfLines={1}>
                      {ch.name || ch.key}
                    </Text>
                    {ch.description ? (
                      <Text style={styles.channelDesc} numberOfLines={2}>
                        {ch.description}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animatable.View>
        ))
      )}
    </ScrollView>
  );

  const renderGenericFields = (setupFields) => (
    setupFields.length > 0 ? (
      setupFields.map((field) => (
        <View key={field.key || field.name} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{field.label || field.name}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={field.placeholder || ''}
            placeholderTextColor="#555"
            secureTextEntry={field.secret || false}
            value={formValues[field.key || field.name] || ''}
            onChangeText={(val) => setField(field.key || field.name, val)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {field.help ? (
            <Text style={styles.fieldHelp}>{field.help}</Text>
          ) : null}
        </View>
      ))
    ) : (
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Sender ID / Phone / Username</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter your identifier"
          placeholderTextColor="#555"
          value={formValues.sender_id || ''}
          onChangeText={(val) => setField('sender_id', val)}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    )
  );

  const renderAuthForm = () => {
    if (!selectedChannel) return null;

    const authMethod = selectedChannel.auth_method || 'api_key';
    const setupFields = selectedChannel.setup_fields || [];
    const color = getColor(selectedChannel.key);
    const icon = getIcon(selectedChannel.key);

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          <Animatable.View animation="fadeInUp">
            {/* Channel header */}
            <View style={styles.selectedHeader}>
              <View style={[styles.selectedIconBg, { backgroundColor: color + '22' }]}>
                <MaterialCommunityIcons name={icon} size={32} color={color} />
              </View>
              <Text style={styles.selectedName}>{selectedChannel.name || selectedChannel.key}</Text>
              {selectedChannel.description ? (
                <Text style={styles.selectedDesc}>{selectedChannel.description}</Text>
              ) : null}
            </View>

            {/* Auth-method-specific form */}
            {authMethod === 'oauth2' ? (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>One-Tap Connect</Text>
                <Text style={styles.formHelpText}>
                  You&apos;ll be taken to {selectedChannel.name || selectedChannel.key}
                  &nbsp;to authorize Nunba. Tap Authorize there and we&apos;ll
                  finish the connection automatically.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: color }]}
                  onPress={handleOAuthConnect}
                  activeOpacity={0.7}
                  disabled={connecting}
                >
                  {connecting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <MaterialCommunityIcons name={icon} size={20} color="#FFF" />
                  )}
                  <Text style={styles.primaryBtnText}>
                    {connecting
                      ? 'Opening authorization page…'
                      : `Connect with ${selectedChannel.name || selectedChannel.key}`}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.formHelpText}>
                  Nunba never sees your password — only the access token
                  the provider grants.
                </Text>
              </View>
            ) : isQrAuth(authMethod) ? (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>QR Session Pairing</Text>
                <Text style={styles.formHelpText}>
                  Scan a QR code from your desktop/web to link this channel.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: color }]}
                  onPress={() =>
                    navigation.navigate('QRScanner', {
                      channel: selectedChannel.key,
                      channelName: selectedChannel.name || selectedChannel.key,
                      isGatewayQr: authMethod === 'gateway_qr',
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons name="qr-code-outline" size={20} color="#FFF" />
                  <Text style={styles.primaryBtnText}>Scan QR Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowManualSetup((v) => !v)}
                  activeOpacity={0.7}
                  style={styles.manualToggle}
                >
                  <Text style={styles.manualToggleText}>
                    {showManualSetup ? 'Hide manual setup' : 'Set up manually instead'}
                  </Text>
                </TouchableOpacity>
                {showManualSetup ? (
                  <View style={styles.manualSection}>
                    <Text style={styles.formLabel}>Manual Setup</Text>
                    {renderGenericFields(setupFields)}
                  </View>
                ) : null}
              </View>
            ) : authMethod === 'api_key' ? (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>API Key</Text>
                <Text style={styles.formHelpText}>
                  Enter your {selectedChannel.name || selectedChannel.key} API key or bot token.
                </Text>
                {renderGenericFields(setupFields)}
              </View>
            ) : (
              /* Generic form for other auth methods */
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Setup</Text>
                {renderGenericFields(setupFields)}
              </View>
            )}

            {/* Connect button — hidden for QR unless manual setup is
                expanded (QR's own scan button covers the default path),
                and always hidden for OAuth (has its own "Connect with X"
                button). */}
            {(!isQrAuth(authMethod) || showManualSetup) && authMethod !== 'oauth2' ? (
              <TouchableOpacity
                style={[styles.connectBtn, connecting && styles.connectBtnDisabled]}
                onPress={handleConnect}
                disabled={connecting}
                activeOpacity={0.7}
              >
                {connecting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="link-variant" size={20} color="#FFF" />
                    <Text style={styles.connectBtnText}>Connect</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </Animatable.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={__DEV__ ? _promptHartosTokenOverride : undefined}
          onLongPress={__DEV__ ? _promptApiBaseOverride : undefined}
          activeOpacity={1}
        >
          <Text style={styles.headerTitle}>
            {step === 1 ? 'Add Channel' : 'Configure'}
          </Text>
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
      </View>

      {step === 1 ? renderStep1() : renderAuthForm()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%'),
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1, color: '#FFF', fontSize: wp('5%'),
    fontWeight: '700', textAlign: 'center',
  },
  headerSpacer: { width: 32 },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: wp('20%'), marginBottom: hp('2%'),
  },
  stepDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#2A2A3E',
  },
  stepDotActive: { backgroundColor: '#6C63FF' },
  stepLine: {
    flex: 1, height: 2, backgroundColor: '#2A2A3E', marginHorizontal: 8,
  },
  stepLineActive: { backgroundColor: '#6C63FF' },
  scrollContent: { flex: 1 },
  scrollInner: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  centerContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: hp('15%'),
  },
  loadingText: { color: '#888', fontSize: wp('3.2%'), marginTop: hp('1.5%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  categoryLabel: {
    color: '#888', fontSize: wp('3.2%'), fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: hp('1.5%'), marginBottom: hp('1%'),
  },
  channelGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: wp('3%'),
  },
  channelCard: {
    width: wp('42%'), backgroundColor: '#1A1A2E', borderRadius: 12,
    padding: wp('4%'), borderWidth: 1, borderColor: '#2A2A3E',
  },
  channelIconBg: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  channelName: { color: '#FFF', fontSize: wp('3.5%'), fontWeight: '700' },
  channelDesc: { color: '#888', fontSize: wp('2.8%'), marginTop: 4 },
  selectedHeader: { alignItems: 'center', marginBottom: hp('3%') },
  selectedIconBg: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  selectedName: { color: '#FFF', fontSize: wp('5%'), fontWeight: '700' },
  selectedDesc: { color: '#888', fontSize: wp('3.2%'), marginTop: 4, textAlign: 'center' },
  formSection: { marginBottom: hp('2%') },
  formLabel: {
    color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700', marginBottom: hp('0.5%'),
  },
  formHelpText: {
    color: '#888', fontSize: wp('3%'), marginBottom: hp('1.5%'), lineHeight: wp('4.5%'),
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: hp('1.5%'), borderRadius: 12,
  },
  primaryBtnText: { color: '#FFF', fontSize: wp('3.5%'), fontWeight: '700' },
  manualToggle: { alignItems: 'center', paddingVertical: hp('1.5%') },
  manualToggleText: { color: '#6C63FF', fontSize: wp('3.2%'), fontWeight: '600' },
  manualSection: {
    marginTop: hp('1%'), paddingTop: hp('1.5%'),
    borderTopWidth: 1, borderTopColor: '#2A2A3E',
  },
  textInput: {
    backgroundColor: '#1A1A2E', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A3E',
    color: '#FFF', fontSize: wp('3.5%'),
    paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%'),
    marginBottom: hp('1%'),
  },
  fieldRow: { marginBottom: hp('1%') },
  fieldLabel: {
    color: '#CCC', fontSize: wp('3.2%'), fontWeight: '600', marginBottom: hp('0.5%'),
  },
  fieldHelp: { color: '#666', fontSize: wp('2.8%'), marginTop: 2 },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#6C63FF', borderRadius: 12,
    paddingVertical: hp('1.8%'), marginTop: hp('2%'),
  },
  connectBtnDisabled: { opacity: 0.6 },
  connectBtnText: { color: '#FFF', fontSize: wp('4%'), fontWeight: '700' },
});

export default ChannelSetupScreen;
