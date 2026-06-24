/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import {
  NativeModules,
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import i18next from 'i18next';

import { verifyOtp, isVerifySuccess } from '../../services/signupApi';

const { OnboardingModule } = NativeModules;

// React Native port of Android's SignUpOTPVerification Activity. iOS has no
// SMS User Consent API (the Android auto-read), so the field just uses
// textContentType="oneTimeCode" — iOS surfaces the received code in the
// QuickType bar automatically and the user taps it in.
const OtpVerification = ({ navigation, route, rootNavigation }) => {
  const params = route?.params || {};
  // The verify identifier: phone, or the email when the server said the OTP
  // went by email (verification_method === 'email').
  const identifier =
    params.verificationMethod === 'email' && params.email
      ? String(params.email).trim()
      : params.identifier;

  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  const onVerify = async () => {
    if (!otp || otp.length < 4) {
      alert('Enter the 4-digit code');
      return;
    }
    setBusy(true);
    try {
      const res = await verifyOtp({ identifier, otp });
      if (isVerifySuccess(res)) {
        // Persist what we got back, mirroring the Android Activity: token is
        // the Bearer for every future call; user_id marks the account as
        // logged in; name/email/phone keep the profile in sync.
        if (typeof OnboardingModule?.setAccessToken === 'function' && res.access_token) {
          OnboardingModule.setAccessToken(res.access_token).catch(() => {});
        }
        if (typeof OnboardingModule?.setUser_id === 'function' && res.user_id != null) {
          OnboardingModule.setUser_id(String(res.user_id)).catch(() => {});
        }
        if (typeof OnboardingModule?.createStudentNameAndEmail === 'function') {
          OnboardingModule.createStudentNameAndEmail(
            res.name ?? params.name ?? '',
            res.email_address ?? params.email ?? '',
            res.phone_number ?? params.identifier ?? '',
          );
        }
        // Signup complete — leave the (independent) signup nav tree and enter
        // the app at MainScreen, like Android's navigateToTeachOrRevisionActivity.
        // rootNavigation is the OUTER App.tsx stack, passed in by SignUpCombined
        // (this screen's own `navigation` is the inner NavigationIndependentTree
        // and can't see MainScreen). reset() so Back can't return to signup.
        const goToApp = () => {
          if (rootNavigation && typeof rootNavigation.reset === 'function') {
            rootNavigation.reset({ index: 0, routes: [{ name: 'MainScreen' }] });
          } else {
            alert(
              'Verified, but could not open the app automatically. Please relaunch.',
            );
          }
        };
        Alert.alert('Verified', 'You are signed up.', [
          { text: 'OK', onPress: goToApp },
        ]);
      } else {
        // Server reports failure via `detail` ("Wrong OTP" / "OTP Expired").
        alert(res.detail || 'Verification failed. Please try again.');
      }
    } catch (e) {
      alert(
        'Could not verify the code. Check your connection and try again.\n' +
          (e?.message || ''),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{i18next.t('Verify your number')}</Text>
      <Text style={styles.subtitle}>
        Enter the 4-digit code sent to {identifier || 'your number'}
      </Text>

      <TextInput
        style={styles.otpInput}
        value={otp}
        onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 4))}
        placeholder="••••"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoFocus
        maxLength={4}
      />

      <TouchableOpacity
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={onVerify}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.btnText}>{i18next.t('Verify')}</Text>
        )}
      </TouchableOpacity>

      {navigation?.canGoBack?.() && (
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={busy}>
          <Text style={styles.backText}>Change number</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: wp('8%'),
  },
  title: {
    marginTop: hp('14%'),
    fontFamily: 'Roboto-Medium',
    fontSize: wp('6%'),
    color: '#000000',
  },
  subtitle: {
    marginTop: hp('2%'),
    marginBottom: hp('6%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4%'),
    color: '#676767',
    textAlign: 'center',
  },
  otpInput: {
    width: wp('55%'),
    textAlign: 'center',
    letterSpacing: wp('4%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('8%'),
    color: '#000000',
    borderBottomWidth: hp('0.2%'),
    borderBottomColor: '#0078FF',
    marginBottom: hp('6%'),
    paddingVertical: hp('1%'),
  },
  btn: {
    width: wp('55%'),
    height: hp('5.7%'),
    backgroundColor: '#0078FF',
    borderRadius: hp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.3%'),
    color: '#FFFFFF',
  },
  backText: {
    marginTop: hp('3%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4%'),
    color: '#0078FF',
  },
});

export default OtpVerification;
