import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
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

const QRScannerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { channel, channelName } = route.params || {};

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
      <StatusBar barStyle="light-content" backgroundColor="#0F0E17" />

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

      {/* Camera scanner (if available and active) */}
      {useCameraMode && CameraScreen ? (
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
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  manualContainer: {
    flex: 1, paddingHorizontal: wp('6%'), paddingTop: hp('4%'),
  },
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
});

export default QRScannerScreen;
