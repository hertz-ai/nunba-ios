import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import useSecureInputStore from '../../../secureInputStore';
import useDeviceCapabilityStore from '../../../deviceCapabilityStore';
import { vaultStore } from '../../../services/vaultApi';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../../theme/colors';

const SecureInputOverlay = () => {
  const currentRequest = useSecureInputStore((s) => s.currentRequest);
  const resolve = useSecureInputStore((s) => s.resolve);
  const dismiss = useSecureInputStore((s) => s.dismiss);
  const isTV = useDeviceCapabilityStore((s) => s.deviceType) === 'tv';

  const visible = currentRequest !== null;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [value, setValue] = useState('');
  const [consent, setConsent] = useState(false);
  const [storing, setStoring] = useState(false);
  const [stored, setStored] = useState(false);
  const [error, setError] = useState(null);

  // Slide-up animation when overlay appears
  useEffect(() => {
    if (visible) {
      setValue('');
      setConsent(false);
      setStoring(false);
      setStored(false);
      setError(null);
      slideAnim.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleStore = async () => {
    if (!value.trim() || !consent || !currentRequest) return;
    Keyboard.dismiss();
    setStoring(true);
    setError(null);
    try {
      const result = await vaultStore({
        key_type: currentRequest.type || 'tool_key',
        key_name: currentRequest.key_name,
        value: value.trim(),
        channel_type: currentRequest.channel_type || '',
      });
      if (result?.success) {
        setStored(true);
        setTimeout(() => resolve(currentRequest.key_name), 1000);
      } else {
        setError(result?.error || 'Failed to store key');
      }
    } catch (err) {
      setError(err?.message || 'Connection error');
    } finally {
      setStoring(false);
    }
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  if (!visible) return null;

  const cardContent = (
    <Animated.View
      style={[
        styles.card,
        isTV && styles.cardTV,
        { transform: [{ translateY }] },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.lockIcon}>
          <MaterialCommunityIcons name="shield-lock" size={24} color="#6C63FF" />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {currentRequest.label || 'API Key Required'}
        </Text>
        <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Description */}
      <Text style={styles.description}>
        {currentRequest.description || 'An API key is required to proceed.'}
      </Text>

      {/* Key purpose disclosure */}
      <View style={styles.purposeBadge}>
        <Text style={styles.purposeLabel}>Used by: </Text>
        <Text style={styles.purposeValue}>
          {currentRequest.used_by || 'Agent tool'}
        </Text>
      </View>

      {/* Secure text input */}
      <TextInput
        style={styles.input}
        secureTextEntry
        autoComplete="off"
        autoCorrect={false}
        value={value}
        onChangeText={setValue}
        placeholder={`Enter ${currentRequest.label || 'API key'}...`}
        placeholderTextColor={colors.textMuted}
        editable={!stored}
        returnKeyType="done"
        onSubmitEditing={() => { if (consent && value.trim()) handleStore(); }}
      />

      {/* Consent checkbox */}
      <TouchableOpacity
        style={styles.consentRow}
        onPress={() => setConsent(!consent)}
        activeOpacity={0.7}
        disabled={stored}
      >
        <MaterialCommunityIcons
          name={consent ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={20}
          color={consent ? '#6C63FF' : colors.textMuted}
        />
        <Text style={styles.consentText}>
          I understand this secret will be encrypted and stored on this device
        </Text>
      </TouchableOpacity>

      {/* Trust indicator */}
      <View style={styles.trustRow}>
        <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
        <Text style={styles.trustText}>
          Encrypted with machine-locked Fernet. Never leaves this device.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={dismiss}
          disabled={storing}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.storeBtn,
            (!consent || !value.trim() || storing || stored) && styles.storeBtnDisabled,
          ]}
          onPress={handleStore}
          disabled={!consent || !value.trim() || storing || stored}
          activeOpacity={0.7}
        >
          <Text style={styles.storeBtnText}>
            {stored ? 'Stored' : storing ? 'Encrypting...' : 'Store Securely'}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={[styles.backdrop, isTV && styles.backdropTV]}>
        {cardContent}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropTV: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#0F0E17',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: 34,
  },
  cardTV: {
    borderRadius: 20,
    maxWidth: 480,
    width: '90%',
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  lockIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(108,99,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: '#EEEEF0',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  closeBtn: {
    padding: 4,
  },
  description: {
    color: '#9B9BAD',
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: 12,
  },
  purposeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
    borderRadius: borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  purposeLabel: {
    color: '#9B9BAD',
    fontSize: 12,
  },
  purposeValue: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  input: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#EEEEF0',
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  consentText: {
    flex: 1,
    color: '#BBBBC8',
    fontSize: 13,
    lineHeight: 18,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: borderRadius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  trustText: {
    color: '#10B981',
    fontSize: 12,
  },
  error: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: borderRadius.md,
  },
  cancelBtnText: {
    color: '#9B9BAD',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  storeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#6C63FF',
    borderRadius: borderRadius.md,
  },
  storeBtnDisabled: {
    opacity: 0.5,
  },
  storeBtnText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});

export default SecureInputOverlay;
