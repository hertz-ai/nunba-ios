import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Image,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import useChannelStore from '../../../channelStore';

// Try to import camera kit, fallback gracefully
let CameraScreen = null;
try {
  const CameraKit = require('react-native-camera-kit');
  CameraScreen = CameraKit.CameraScreen;
} catch {
  /* camera kit not installed — fallback to manual code entry */
}

const WHATSAPP_POLL_MS = 2500;
const WHATSAPP_POLL_TIMEOUT_MS = 3 * 60 * 1000;

// WhatsApp (auth_method 'gateway_qr') is backed by a real embedded
// Baileys session, not the generic PairingManager code used by every
// other qr_session channel — it needs its own phone-number → real
// pairing-code → poll-until-authenticated flow instead of a manual
// code the user types in.
const WHATSAPP_QR_POLL_MS = 3000;

const WhatsAppGatewayPair = ({ channelName, navigation }) => {
  const whatsappPairCode = useChannelStore((s) => s.whatsappPairCode);
  const whatsappStatus = useChannelStore((s) => s.whatsappStatus);
  const fetchBindings = useChannelStore((s) => s.fetchBindings);

  // 'qr' is the default, primary method (matches real WhatsApp's own
  // Link a Device screen — QR first, phone number as the "instead"
  // option) — 'phone' reveals the manual pairing-code flow.
  const [mode, setMode] = useState('qr');
  const [phone, setPhone] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [code, setCode] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [error, setError] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [alreadyConnected, setAlreadyConnected] = useState(false);
  const pollRef = useRef(null);
  const pollDeadlineRef = useRef(0);
  const qrPollRef = useRef(null);

  useEffect(() => () => { clearTimeout(pollRef.current); clearTimeout(qrPollRef.current); }, []);

  const handleAuthenticated = async () => {
    clearTimeout(pollRef.current);
    clearTimeout(qrPollRef.current);
    await fetchBindings();
    Alert.alert(
      'WhatsApp linked',
      `${channelName || 'WhatsApp'} is now connected to your real WhatsApp account.`,
      [{ text: 'OK', onPress: () => navigation.popToTop() }],
    );
  };

  // This account may already have a live Baileys session (re-opening the
  // screen, or the app itself just resumed one) — don't make the user
  // re-enter their phone number if it's already linked.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await whatsappStatus();
      if (!cancelled && res.success && res.data && res.data.authenticated) {
        setAlreadyConnected(true);
      }
      if (!cancelled) setCheckingExisting(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // QR mode: poll continuously and refresh the displayed image — Baileys
  // rotates the QR string every ~20-30s on its own, so a single fetch
  // would go stale before the user could scan it.
  useEffect(() => {
    if (mode !== 'qr' || checkingExisting || alreadyConnected) return;
    let cancelled = false;

    const pollQr = async () => {
      const res = await whatsappStatus();
      if (cancelled) return;
      if (res.success && res.data) {
        if (res.data.authenticated) {
          await handleAuthenticated();
          return;
        }
        if (res.data.qr_data_url) setQrImage(res.data.qr_data_url);
      }
      qrPollRef.current = setTimeout(pollQr, WHATSAPP_QR_POLL_MS);
    };
    pollQr();

    return () => { cancelled = true; clearTimeout(qrPollRef.current); };
  }, [mode, checkingExisting, alreadyConnected]);

  const pollStatus = async () => {
    if (Date.now() > pollDeadlineRef.current) {
      setError('Timed out waiting for WhatsApp to confirm the link. Request a new code and try again.');
      setCode(null);
      return;
    }
    const res = await whatsappStatus();
    if (res.success && res.data && res.data.authenticated) {
      await handleAuthenticated();
      return;
    }
    pollRef.current = setTimeout(pollStatus, WHATSAPP_POLL_MS);
  };

  const handleRequestCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      Alert.alert('Missing Number', 'Enter the WhatsApp phone number to link, e.g. +1 555 123 4567.');
      return;
    }
    // Must include the country code — a bare local number silently pairs
    // a different (wrong) account and can knock an already-linked real
    // session offline mid-handshake.
    if (!trimmed.startsWith('+')) {
      Alert.alert(
        'Include Country Code',
        'Enter the full number with its country code, e.g. +91 99449 46130, not just the local digits.',
      );
      return;
    }
    setRequesting(true);
    setError(null);
    setCode(null);
    try {
      const res = await whatsappPairCode(trimmed);
      if (res.success && res.data && res.data.code) {
        setCode(res.data.code);
        pollDeadlineRef.current = Date.now() + WHATSAPP_POLL_TIMEOUT_MS;
        pollRef.current = setTimeout(pollStatus, WHATSAPP_POLL_MS);
      } else {
        setError(res.error || 'Could not get a pairing code. Please try again.');
      }
    } catch {
      setError('Could not reach the WhatsApp gateway. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  if (checkingExisting) {
    return (
      <View style={[styles.manualContainer, styles.centeredContainer]}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={[styles.instructions, { marginTop: hp('2%') }]}>
          Checking WhatsApp connection…
        </Text>
      </View>
    );
  }

  if (alreadyConnected) {
    return (
      <View style={[styles.manualContainer, styles.centeredContainer]}>
        <MaterialCommunityIcons name="whatsapp" size={56} color="#25D366" />
        <Text style={[styles.instructions, { marginTop: hp('2%') }]}>
          {channelName || 'WhatsApp'} is already connected to your real WhatsApp account.
        </Text>
        <TouchableOpacity
          style={styles.verifyBtn}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
          <Text style={styles.verifyBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'qr') {
    return (
      <Animatable.View animation="fadeInUp" style={styles.manualContainer}>
        <Text style={styles.instructions}>
          Open WhatsApp → Settings → Linked Devices → Link a Device, then
          scan this QR code.
        </Text>
        <View style={styles.qrImageBox}>
          {qrImage ? (
            <Image source={{ uri: qrImage }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <ActivityIndicator size="large" color="#6C63FF" />
          )}
        </View>
        <View style={styles.waitingRow}>
          <ActivityIndicator size="small" color="#6C63FF" />
          <Text style={styles.waitingText}>Waiting for you to scan…</Text>
        </View>
        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => { clearTimeout(qrPollRef.current); setMode('phone'); }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="cellphone-key" size={18} color="#6C63FF" />
          <Text style={styles.switchBtnText}>Link with phone number instead</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </Animatable.View>
    );
  }

  return (
    <Animatable.View animation="fadeInUp" style={styles.manualContainer}>
      <View style={styles.iconRow}>
        <MaterialCommunityIcons name="whatsapp" size={48} color="#6C63FF" />
      </View>

      {!code ? (
        <>
          <Text style={styles.instructions}>
            Enter your WhatsApp phone number. We'll generate a real pairing
            code — enter it on your phone under WhatsApp Settings → Linked
            Devices → Link a Device → Link with phone number instead.
          </Text>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.textInput}
            placeholder="+1 555 123 4567"
            placeholderTextColor="#555"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.verifyBtn, requesting && styles.verifyBtnDisabled]}
            onPress={handleRequestCode}
            disabled={requesting}
            activeOpacity={0.7}
          >
            {requesting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="cellphone-key" size={20} color="#FFF" />
                <Text style={styles.verifyBtnText}>Send Pairing Code</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => { setMode('qr'); setError(null); }}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code-outline" size={18} color="#6C63FF" />
            <Text style={styles.switchBtnText}>Scan QR code instead</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.instructions}>
            Enter this code in WhatsApp → Settings → Linked Devices →
            Link a Device → Link with phone number instead:
          </Text>
          <Text style={styles.pairCodeDisplay}>{code}</Text>
          <View style={styles.waitingRow}>
            <ActivityIndicator size="small" color="#6C63FF" />
            <Text style={styles.waitingText}>Waiting for you to enter it on WhatsApp…</Text>
          </View>
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => { clearTimeout(pollRef.current); setCode(null); setError(null); }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color="#6C63FF" />
            <Text style={styles.switchBtnText}>Start over</Text>
          </TouchableOpacity>
        </>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </Animatable.View>
  );
};

const QRScannerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { channel, channelName, isGatewayQr } = route.params || {};

  const verifyPairCode = useChannelStore((s) => s.verifyPairCode);
  const fetchBindings = useChannelStore((s) => s.fetchBindings);

  const [manualCode, setManualCode] = useState('');
  const [senderId, setSenderId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [useCameraMode, setUseCameraMode] = useState(CameraScreen !== null);

  const handleVerify = async (code) => {
    const codeToVerify = code || manualCode.trim();
    if (!codeToVerify) {
      Alert.alert('Missing Code', 'Please enter a pairing code.');
      return;
    }

    setVerifying(true);
    try {
      const res = await verifyPairCode(codeToVerify, channel, senderId.trim() || undefined);
      if (res.success) {
        await fetchBindings();
        Alert.alert(
          'Paired',
          `${channelName || channel || 'Channel'} has been linked successfully.`,
          [{ text: 'OK', onPress: () => navigation.popToTop() }],
        );
      } else {
        Alert.alert('Failed', res.error || 'Invalid or expired pairing code. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const onQRCodeRead = (event) => {
    const scannedCode = event?.nativeEvent?.codeStringValue || event?.data || '';
    if (scannedCode) {
      setUseCameraMode(false);
      setManualCode(scannedCode);
      handleVerify(scannedCode);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {channelName ? `Pair ${channelName}` : 'Pair Channel'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {isGatewayQr ? (
        <WhatsAppGatewayPair channelName={channelName} navigation={navigation} />
      ) : useCameraMode && CameraScreen ? (
        <View style={styles.cameraContainer}>
          <CameraScreen
            scanBarcode
            onReadCode={onQRCodeRead}
            showFrame
            laserColor="#6C63FF"
            frameColor="#6C63FF"
            style={styles.camera}
          />
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => setUseCameraMode(false)}
            activeOpacity={0.7}
          >
            <Ionicons name="keypad-outline" size={18} color="#6C63FF" />
            <Text style={styles.switchBtnText}>Enter code manually</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Manual code entry fallback */
        <Animatable.View animation="fadeInUp" style={styles.manualContainer}>
          <View style={styles.iconRow}>
            <MaterialCommunityIcons name="qrcode-scan" size={48} color="#6C63FF" />
          </View>
          <Text style={styles.instructions}>
            Enter the pairing code shown on your desktop or web browser.
          </Text>

          <Text style={styles.inputLabel}>Pairing Code</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. A1B2C3"
            placeholderTextColor="#555"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
          />

          <Text style={styles.inputLabel}>Sender ID (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Phone number or username"
            placeholderTextColor="#555"
            value={senderId}
            onChangeText={setSenderId}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.verifyBtn, verifying && styles.verifyBtnDisabled]}
            onPress={() => handleVerify()}
            disabled={verifying}
            activeOpacity={0.7}
          >
            {verifying ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="check-decagram" size={20} color="#FFF" />
                <Text style={styles.verifyBtnText}>Verify</Text>
              </>
            )}
          </TouchableOpacity>

          {CameraScreen ? (
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => setUseCameraMode(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={18} color="#6C63FF" />
              <Text style={styles.switchBtnText}>Use camera to scan QR</Text>
            </TouchableOpacity>
          ) : null}
        </Animatable.View>
      )}
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
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  manualContainer: {
    flex: 1, paddingHorizontal: wp('6%'), paddingTop: hp('4%'),
  },
  centeredContainer: { justifyContent: 'center', alignItems: 'center' },
  iconRow: { alignItems: 'center', marginBottom: hp('2%') },
  instructions: {
    color: '#888', fontSize: wp('3.5%'), textAlign: 'center',
    lineHeight: wp('5.5%'), marginBottom: hp('3%'),
  },
  inputLabel: {
    color: '#CCC', fontSize: wp('3.2%'), fontWeight: '600',
    marginBottom: hp('0.5%'),
  },
  textInput: {
    backgroundColor: '#1A1A2E', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A3E',
    color: '#FFF', fontSize: wp('4%'),
    paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%'),
    marginBottom: hp('2%'),
  },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#6C63FF', borderRadius: 12,
    paddingVertical: hp('1.8%'), marginTop: hp('1%'),
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: { color: '#FFF', fontSize: wp('4%'), fontWeight: '700' },
  switchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: hp('2.5%'), paddingVertical: hp('1%'),
  },
  switchBtnText: { color: '#6C63FF', fontSize: wp('3.2%'), fontWeight: '600' },
  pairCodeDisplay: {
    color: '#FFF', fontSize: wp('9%'), fontWeight: '800', letterSpacing: 3,
    textAlign: 'center', marginVertical: hp('3%'),
  },
  qrImageBox: {
    alignSelf: 'center', width: wp('60%'), height: wp('60%'),
    marginVertical: hp('3%'), backgroundColor: '#FFF', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', padding: wp('3%'),
  },
  qrImage: { width: '100%', height: '100%' },
  waitingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  waitingText: { color: '#888', fontSize: wp('3.4%') },
  errorText: {
    color: '#FF6B6B', fontSize: wp('3.4%'), textAlign: 'center', marginTop: hp('2%'),
  },
});

export default QRScannerScreen;
