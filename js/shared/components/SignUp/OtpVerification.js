/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import {
  NativeModules,
  DeviceEventEmitter,
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

import { verifyOtp, isVerifySuccess, linkHevolveAccount } from '../../services/signupApi';

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

  // Session-expiry re-login (App.tsx's 'SessionExpired' handler) reuses this
  // same screen as a plain top-level route — no rootNavigation prop, no
  // signup account to create. Verifying just refreshes the token in place.
  const isRelogin = params.mode === 'relogin';

  const onVerify = async () => {
    if (!otp || otp.length < 4) {
      alert('Enter the 4-digit code');
      return;
    }
    setBusy(true);
    try {
      const res = await verifyOtp({ identifier, otp });
      if (isVerifySuccess(res)) {
        // 2026-08-18 — for an email-verified account (verificationMethod
        // === 'email'), the server's own varify_otp response has been
        // observed echoing the verification identifier (the email) back
        // in its `phone_number` field. Blindly trusting res.phone_number
        // then persists the EMAIL into the phone slot, which silently
        // corrupts every downstream link-hevolve call (phone_number sent
        // as an email string) and is what produced the "Invalid or
        // expired token" failures on channel binding — the auto-refresh
        // path (ensureFreshHartosToken) re-derives phone from this same
        // stored value, so a bad phone here breaks refresh indefinitely,
        // not just once. params.identifier is the phone the user actually
        // typed on the previous screen and is never email-shaped, so it's
        // the trustworthy fallback — and now the preferred value whenever
        // the server's response looks like an email rather than a phone.
        const serverPhone = res.phone_number;
        const phone =
          serverPhone && !String(serverPhone).includes('@')
            ? serverPhone
            : (params.identifier ?? '');

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
            phone,
          );
        }
        // Bridge into a HARTOS-native token for /api/social/* calls. Best
        // effort — if this fails, socialApi.js's existing 401 handling
        // (SessionExpired) is the fallback, same as before this bridge
        // existed, so a failure here shouldn't block sign-in.
        const email = res.email_address ?? params.email ?? '';
        // TEMP DIAGNOSTIC (2026-07-08) — remove once on-device auth bridge
        // is confirmed working. Surfaces link-hevolve's actual outcome
        // instead of silently swallowing it, per debugging item #0.
        let hartosDebug = '<not attempted>';
        if (res.user_id != null && email) {
          try {
            const linked = await linkHevolveAccount({
              hevolveUserId: res.user_id,
              phoneNumber: phone,
              name: res.name ?? params.name ?? '',
              email,
            });
            if (linked?.token && typeof OnboardingModule?.setHartosToken === 'function') {
              await OnboardingModule.setHartosToken(linked.token).catch(() => {});
            }
            hartosDebug = linked?.token ? `ok tail=${String(linked.token).slice(-8)}` : 'ok but no token in response';
          } catch (e) {
            hartosDebug = `FAILED: ${e?.message}`;
            // Non-fatal — see comment above.
          }
        }
        // Lets socialApi.js's 'SessionExpired' debounce clear so a later
        // token expiry can trigger re-login again.
        try { DeviceEventEmitter.emit('authChanged'); } catch (_) {}
        const goToApp = () => {
          if (isRelogin) {
            // Registered as a top-level App.tsx route (see 'SessionExpired'
            // handler) — this screen's own `navigation` IS the shared stack,
            // so just return to whatever screen 401'd instead of resetting.
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
            } else if (typeof navigation?.reset === 'function') {
              navigation.reset({ index: 0, routes: [{ name: 'MainScreen' }] });
            }
            return;
          }
          // Signup complete — leave the (independent) signup nav tree and enter
          // the app at MainScreen, like Android's navigateToTeachOrRevisionActivity.
          // rootNavigation is the OUTER App.tsx stack, passed in by SignUpCombined
          // (this screen's own `navigation` is the inner NavigationIndependentTree
          // and can't see MainScreen). reset() so Back can't return to signup.
          if (rootNavigation && typeof rootNavigation.reset === 'function') {
            rootNavigation.reset({ index: 0, routes: [{ name: 'MainScreen' }] });
          } else {
            alert(
              'Verified, but could not open the app automatically. Please relaunch.',
            );
          }
        };
        // TEMP DIAGNOSTIC (2026-07-06) — remove once the token-expiry loop
        // is root-caused. Shows what the server actually returned so we
        // can tell apart "no token issued" from "token issued but rejected".
        const tokTail = res.access_token ? String(res.access_token).slice(-8) : '<none>';
        Alert.alert(
          'Verified',
          `${isRelogin ? 'You are signed back in.' : 'You are signed up.'}\n\n[debug] access_token=${tokTail} expires_in=${res.expires_in}\n[debug] hartos link: ${hartosDebug}`,
          [{ text: 'OK', onPress: goToApp }],
        );
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
