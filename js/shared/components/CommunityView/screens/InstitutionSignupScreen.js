/**
 * InstitutionSignupScreen — RN parity for the web SPA's
 * landing-page/src/pages/signuplite.js.
 *
 * B2B onboarding flow distinct from the regular SignUpCombined path.
 * Collects:
 *   - Name
 *   - Email
 *   - Phone (with Send OTP + Verify OTP — phone must be verified
 *     before the Register button is enabled)
 *   - Date of Birth
 *   - Number of Agent Users
 *   - Terms & Conditions checkbox
 *
 * Backend (legacy mailer.hertzai.com — see #262 / NUNBA_PARITY.md):
 *   POST /send_otp        — phone verification SMS
 *   POST /validate_otp    — confirm OTP
 *   POST /createclient    — institution record creation
 *
 * Service: services/socialApi.js → mailerApi.{sendOtp, validateOtp,
 *   createClient}.  The mailer base URL stays legacy — the B2B path
 *   moves to HARTOS auth in a follow-up redesign (deferred per
 *   NUNBA_PARITY.md "Bucket B remaining" notes).
 *
 * Web → RN translation notes:
 *   - useNavigate() → useNavigation().goBack() and SignUpCombined
 *     for next-step navigation.
 *   - <input type="checkbox"> → TouchableOpacity around MaterialIcons.
 *   - Snackbar/Alert → inline banner + Alert.alert for fatal errors.
 *   - ReactGA tracking (web-only) — dropped.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { useNavigation } from '@react-navigation/native';
import { mailerApi } from '../../../services/socialApi';

const ACCENT = '#00e89d';
const ACCENT_BLUE = '#0078ff';
const ACCENT_AMBER = '#ffcc00';
const ERR = '#ff6b6b';
const MUTED = '#888';

const isPhoneShape = (s) => /^\d{10}$/.test(s || '');

const InstitutionSignupScreen = () => {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [dob, setDob] = useState('');
  const [agentUsers, setAgentUsers] = useState('');
  const [tcAccepted, setTcAccepted] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSendOtp = useCallback(async () => {
    if (!isPhoneShape(phone)) {
      setMessage({
        type: 'error',
        text: 'Please enter a 10-digit phone number.',
      });
      return;
    }
    setSendingOtp(true);
    setMessage(null);
    try {
      const res = await mailerApi.sendOtp({ phone_number: phone });
      // Treat any successful response as OTP-sent (server returns
      // either {success: true} or a free-form payload).
      setOtpSent(true);
      setMessage({ type: 'success', text: 'OTP sent.' });
      // If the server returned a structured error in-band, surface it.
      if (res && res.detail) {
        const m = String(res.detail).match(/(\d{10}) already registered/);
        if (m) {
          setMessage({
            type: 'error',
            text: 'Phone number is already registered. Please sign in.',
          });
          setOtpSent(false);
        } else {
          setMessage({ type: 'error', text: res.detail });
          setOtpSent(false);
        }
      }
    } catch (e) {
      setMessage({
        type: 'error',
        text: e?.message || 'Failed to send OTP.',
      });
    } finally {
      setSendingOtp(false);
    }
  }, [phone]);

  const handleVerifyOtp = useCallback(async () => {
    if (!otp) {
      setMessage({ type: 'error', text: 'Enter the OTP first.' });
      return;
    }
    setVerifyingOtp(true);
    setMessage(null);
    try {
      const res = await mailerApi.validateOtp({
        phone_number: phone,
        otp,
      });
      const status = (res && (res.status || res.data?.status)) || null;
      if (status === 'verified') {
        setPhoneVerified(true);
        setMessage({ type: 'success', text: 'Phone verified.' });
      } else {
        setMessage({
          type: 'error',
          text: 'OTP did not verify. Please try again.',
        });
      }
    } catch (e) {
      setMessage({
        type: 'error',
        text: e?.message || 'OTP verification failed.',
      });
    } finally {
      setVerifyingOtp(false);
    }
  }, [otp, phone]);

  const submitDisabled =
    submitting ||
    !phoneVerified ||
    !tcAccepted ||
    !name.trim() ||
    !email.trim();

  const handleSubmit = useCallback(async () => {
    if (submitDisabled) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await mailerApi.createClient({
        name,
        phone_number: phone,
        email_address: email,
        num_of_students: agentUsers ? parseInt(agentUsers, 10) : 0,
      });
      const clientId = res && (res.client_id || res.data?.client_id);
      if (clientId) {
        Alert.alert(
          'Institution registered',
          'Your account is set up. You can now sign in.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ],
        );
      } else {
        setMessage({
          type: 'error',
          text:
            (res && (res.detail || res.error)) ||
            'Registration failed. Please try again.',
        });
      }
    } catch (e) {
      setMessage({
        type: 'error',
        text: e?.message || 'Registration failed.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [agentUsers, email, name, navigation, phone, submitDisabled]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="institution-signup-screen"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="institution-signup-back"
            style={styles.iconButton}
          >
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.heading}>Create Institution Account</Text>
          <View style={styles.iconButton} />
        </View>
        <Text style={styles.subtle}>
          Sign up your school, business, or agent fleet. Personal accounts
          should use the regular signup flow instead.
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
            >
              <MaterialIcons name="close" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="User Name"
          placeholderTextColor={MUTED}
          autoCapitalize="words"
          testID="institution-signup-name"
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="username@example.com"
          placeholderTextColor={MUTED}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          testID="institution-signup-email"
        />

        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit phone"
            placeholderTextColor={MUTED}
            keyboardType="phone-pad"
            editable={!phoneVerified}
            maxLength={10}
            testID="institution-signup-phone"
          />
          {phoneVerified ? (
            <View style={styles.verifiedBadge}>
              <MaterialIcons name="verified" size={20} color={ACCENT} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : (
            isPhoneShape(phone) && (
              <TouchableOpacity
                onPress={handleSendOtp}
                disabled={sendingOtp}
                style={[
                  styles.button,
                  styles.gradientButton,
                  sendingOtp && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={otpSent ? 'Resend OTP' : 'Send OTP'}
                testID="institution-signup-send-otp"
              >
                <Text style={styles.gradientButtonText}>
                  {sendingOtp ? '…' : otpSent ? 'Resend' : 'Send OTP'}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {otpSent && !phoneVerified && (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter OTP"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              maxLength={6}
              testID="institution-signup-otp"
            />
            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={verifyingOtp}
              style={[
                styles.button,
                styles.gradientButton,
                verifyingOtp && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Verify OTP"
              testID="institution-signup-verify-otp"
            >
              <Text style={styles.gradientButtonText}>
                {verifyingOtp ? '…' : 'Verify'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Date of Birth</Text>
        <TextInput
          style={styles.input}
          value={dob}
          onChangeText={setDob}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={MUTED}
          autoCapitalize="none"
          autoCorrect={false}
          testID="institution-signup-dob"
        />

        <Text style={styles.label}>Number of Agent Users</Text>
        <TextInput
          style={styles.input}
          value={agentUsers}
          onChangeText={setAgentUsers}
          placeholder="e.g. 50"
          placeholderTextColor={MUTED}
          keyboardType="number-pad"
          testID="institution-signup-agent-users"
        />

        <TouchableOpacity
          onPress={() => setTcAccepted((v) => !v)}
          style={styles.tcRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: tcAccepted }}
          accessibilityLabel="Accept terms and conditions"
          testID="institution-signup-tc"
        >
          <MaterialIcons
            name={tcAccepted ? 'check-box' : 'check-box-outline-blank'}
            size={22}
            color={tcAccepted ? ACCENT : MUTED}
          />
          <Text style={styles.tcLabel}>
            I accept the{' '}
            <Text style={styles.tcLink}>Terms & Conditions</Text>.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitDisabled}
          style={[
            styles.button,
            styles.gradientButton,
            styles.submitButton,
            submitDisabled && styles.buttonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Register institution account"
          testID="institution-signup-submit"
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Registering…' : 'Register'}
          </Text>
        </TouchableOpacity>

        <View style={styles.signinRow}>
          <Text style={styles.signinPrompt}>Already have an account?</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('SignUpCombined')}
            accessibilityRole="button"
            testID="institution-signup-signin"
          >
            <Text style={styles.signinLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: wp('4%'), paddingBottom: hp('6%') },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('0.5%'),
  },
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
  label: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: wp('3.2%'),
    fontWeight: '600',
    marginTop: hp('1%'),
    marginBottom: hp('0.4%'),
  },
  input: {
    backgroundColor: '#2a2a3e',
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.1%'),
    fontSize: wp('3.4%'),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.1%'),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  gradientButton: {
    // Visual stand-in for the linear-gradient on web (RN solid color
    // — gradient lib not added to keep zero new deps).
    backgroundColor: ACCENT,
  },
  gradientButtonText: { color: '#FFF', fontWeight: '700', fontSize: wp('3.2%') },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { color: ACCENT, fontSize: wp('3%'), fontWeight: '600' },
  tcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: hp('1.5%'),
  },
  tcLabel: { color: 'rgba(255,255,255,0.7)', fontSize: wp('3.2%'), flex: 1 },
  tcLink: { color: ACCENT_AMBER, fontWeight: '600' },
  submitButton: {
    marginTop: hp('2%'),
    paddingVertical: hp('1.4%'),
  },
  submitButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: wp('3.6%'),
  },
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: hp('2%'),
  },
  signinPrompt: { color: MUTED, fontSize: wp('3.2%') },
  signinLink: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: wp('3.2%'),
  },
  iconButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});

export default InstitutionSignupScreen;
