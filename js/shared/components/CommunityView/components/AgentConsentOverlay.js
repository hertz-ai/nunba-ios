import React, { useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { GameSounds } from './KidsLearning/shared/SoundManager';
import useFleetCommandStore from '../../../fleetCommandStore';
import { ackFleetCommand } from '../../../services/deviceApi';
import useDeviceCapabilityStore from '../../../deviceCapabilityStore';
import TVFocusableItem from '../../shared/TVFocusableItem';

const AgentConsentOverlay = () => {
  const pendingConsents = useFleetCommandStore((s) => s.pendingConsents);
  const resolveConsent = useFleetCommandStore((s) => s.resolveConsent);
  const addToHistory = useFleetCommandStore((s) => s.addToHistory);
  const isTV = useDeviceCapabilityStore((s) => s.deviceType) === 'tv';

  const consent = pendingConsents.length > 0 ? pendingConsents[0] : null;
  const visible = consent !== null;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const timerProgress = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Slide-up / center animation when a consent appears
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // Countdown timer
  useEffect(() => {
    if (!consent) return;

    const timeoutS = consent.timeoutS || 60;
    timerProgress.setValue(1);

    Animated.timing(timerProgress, {
      toValue: 0,
      duration: timeoutS * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        handleDeny();
      }
    }, timeoutS * 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [consent?.commandId]);

  const animateOut = useCallback(() => {
    return new Promise(resolve => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => resolve());
    });
  }, [slideAnim]);

  const handleAllow = useCallback(async () => {
    GameSounds.tap();
    if (!consent) return;
    const { commandId } = consent;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await animateOut();
    await ackFleetCommand(commandId, true, 'approved');
    addToHistory({ ...consent, result: 'approved', resolvedAt: Date.now() });
    resolveConsent(commandId);
  }, [consent, resolveConsent, addToHistory, animateOut]);

  const handleDeny = useCallback(async () => {
    GameSounds.tap();
    if (!consent) return;
    const { commandId } = consent;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await animateOut();
    await ackFleetCommand(commandId, false, 'denied');
    addToHistory({ ...consent, result: 'denied', resolvedAt: Date.now() });
    resolveConsent(commandId);
  }, [consent, resolveConsent, addToHistory, animateOut]);

  if (!visible) return null;

  const translateY = isTV
    ? 0
    : slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
      });

  const timerBarWidth = timerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const cardContent = (
    <Animated.View
      style={[
        styles.card,
        isTV ? styles.cardTV : { transform: [{ translateY }] },
      ]}
    >
      {/* Timer bar */}
      <View style={styles.timerTrack}>
        <Animated.View style={[styles.timerBar, { width: timerBarWidth }]} />
      </View>

      {/* Robot icon */}
      <View style={styles.iconRow}>
        <MaterialCommunityIcons name="robot" size={48} color="#4ECDC4" />
      </View>

      {/* Agent info */}
      <Text style={styles.title}>Agent Consent Required</Text>
      {consent.agentId && (
        <Text style={styles.agentId}>Agent: {consent.agentId}</Text>
      )}
      <Text style={styles.description}>{consent.description}</Text>
      <View style={styles.actionBadge}>
        <Text style={styles.actionText}>{consent.action}</Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TVFocusableItem
          onPress={handleDeny}
          style={[styles.button, styles.denyButton]}
          hasTVPreferredFocus={isTV}
        >
          <MaterialCommunityIcons name="close" size={20} color="#FFF" />
          <Text style={styles.buttonText}>Deny</Text>
        </TVFocusableItem>

        <TVFocusableItem
          onPress={handleAllow}
          style={[styles.button, styles.allowButton]}
        >
          <MaterialCommunityIcons name="check" size={20} color="#FFF" />
          <Text style={styles.buttonText}>Allow</Text>
        </TVFocusableItem>
      </View>
    </Animated.View>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
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
    backgroundColor: '#1E1E2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  cardTV: {
    borderRadius: 20,
    maxWidth: 500,
    width: '40%',
  },
  timerTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  timerBar: {
    height: '100%',
    backgroundColor: '#FF6B6B',
    borderRadius: 2,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  agentId: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  actionBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  actionText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 8,
    minWidth: 130,
  },
  denyButton: {
    backgroundColor: '#FF6B6B',
  },
  allowButton: {
    backgroundColor: '#4ECDC4',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AgentConsentOverlay;
