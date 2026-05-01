import React, { useState, useEffect, useCallback } from 'react';
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
import useChannelStore from '../../../channelStore';

const CHANNEL_COLORS = {
  whatsapp: '#25D366',
  telegram: '#0088cc',
  discord: '#5865F2',
  slack: '#4A154B',
  email: '#EA4335',
  sms: '#00e89d',
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

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleSelectChannel = (channelKey, channelDef) => {
    setSelectedChannel({ key: channelKey, ...channelDef });
    setFormValues({});
    setStep(2);
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedChannel(null);
      setFormValues({});
    } else {
      navigation.goBack();
    }
  };

  const handleConnect = async () => {
    if (!selectedChannel) return;

    setConnecting(true);
    try {
      const payload = {
        channel: selectedChannel.key,
        ...formValues,
      };
      const res = await createBinding(payload);
      if (res.success) {
        Alert.alert('Connected', `${selectedChannel.name || selectedChannel.key} has been connected.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', res.error || 'Failed to connect channel. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to connect channel. Please try again.');
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
            {authMethod === 'qr_session' ? (
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
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons name="qr-code-outline" size={20} color="#FFF" />
                  <Text style={styles.primaryBtnText}>Scan QR Code</Text>
                </TouchableOpacity>
              </View>
            ) : authMethod === 'api_key' ? (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>API Key</Text>
                <Text style={styles.formHelpText}>
                  Enter your {selectedChannel.name || selectedChannel.key} API key or bot token.
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Paste your API key here"
                  placeholderTextColor="#555"
                  secureTextEntry
                  value={formValues.api_key || ''}
                  onChangeText={(val) => setField('api_key', val)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {setupFields.map((field) => (
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
                ))}
              </View>
            ) : (
              /* Generic form for other auth methods */
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Setup</Text>
                {setupFields.length > 0 ? (
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
                )}
              </View>
            )}

            {/* Connect button (not for QR — that navigates to scanner) */}
            {authMethod !== 'qr_session' ? (
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
      <StatusBar barStyle="light-content" backgroundColor="#0F0E17" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 1 ? 'Add Channel' : 'Configure'}
        </Text>
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
  container: { flex: 1, backgroundColor: '#0F0E17' },
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
