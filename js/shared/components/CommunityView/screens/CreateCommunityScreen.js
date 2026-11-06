/**
 * CreateCommunityScreen — #419 fix.  Replaces the inline Modal that
 * CommunitiesScreen used to render; that Modal silently refused to
 * open on Samsung S23 Ultra (live-verified 2026-06-16) despite
 * onPress reaching JS — probably an RN 0.68.8 Modal regression when
 * the host SafeAreaView re-renders.  Promoting Create to a regular
 * Stack.Screen with presentation:'modal' (matching InvitesScreen +
 * InstitutionSignupScreen) sidesteps the issue and gives us the back
 * button + safe-area handling for free.
 *
 * Caller (CommunitiesScreen):
 *   navigation.navigate('CreateCommunity', {
 *     onCreated: (created) => prependCommunity(created),
 *   });
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { communitiesApi } from '../../../services/socialApi';

const _toast = (msg) => {
  try {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    }
  } catch (_) {}
};

const CreateCommunityScreen = ({ navigation, route }) => {
  const onCreated = route?.params?.onCreated;
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const close = () => { try { navigation.goBack(); } catch (_) {} };

  // 2026-06-18: submit() hardened after a user report that tapping
  // Create with title+description "app restarted" — RN's auto-recovery
  // from an unhandled JS error.  Wrap EVERY step (api call, onCreated
  // callback, toast, navigation.goBack) in its own try/catch so a
  // throw in any one path can't crash the bundle.  Also stop ordering
  // setCreating(false) after close() — a setState on an unmounting
  // component logs "can't update state on unmounted" and in dev
  // tears down the React tree.
  const submit = async () => {
    let trimmedName = '';
    let description = '';
    try {
      trimmedName = (name || '').trim();
      description = (desc || '').trim();
    } catch (_) { /* string ops can't throw, but be defensive */ }
    if (!trimmedName) {
      _toast('Community name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await communitiesApi.create({ name: trimmedName, description });
      // Server-error contract: socialApi synthesizes a 599 Response with
      // body '{}' on failover; parsed `res` is then {}.  Treat empty /
      // error-shaped responses as user-facing failures, not crashes.
      if (!res || (typeof res !== 'object')) {
        _toast('Create failed: empty server response');
        setCreating(false);
        return;
      }
      if (res.error && !res.id && !(res.data && res.data.id)) {
        _toast(`Create failed: ${res.error || 'server error'}`);
        setCreating(false);
        return;
      }
      const created = (res.data || res) || null;
      // 2026-06-18: only consider it "created" if the backend handed
      // us a real id.  An empty {} from socialApi's 599 failover would
      // otherwise sail through this and toast a false success — that
      // bug shipped to a user once, do not repeat it.
      if (!created || !created.id) {
        _toast('Create failed: backend did not return a community id');
        setCreating(false);
        return;
      }
      if (typeof onCreated === 'function') {
        try {
          onCreated({ ...created, is_member: true, member_count: created.member_count || 1 });
        } catch (_) { /* parent unmounted or callback threw — ignore */ }
      }
      try { _toast(`Created h/${trimmedName}`); } catch (_) {}
      setCreating(false);
      // Navigate INTO the freshly-created community instead of just
      // going back to the list.  goBack first to pop the modal so the
      // back stack is clean, then push the detail screen.
      setTimeout(() => {
        try { navigation.goBack(); } catch (_) {}
        try {
          navigation.navigate('CommunityDetail', {
            community_id: created.id,
            community: created,
          });
        } catch (_) { /* route may not exist in older builds — silent */ }
      }, 50);
    } catch (e) {
      const msg = (e && (e.message || String(e))) || 'Network error';
      try { _toast(`Create failed: ${msg}`); } catch (_) {}
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={close}
          style={styles.headerBtn}
          hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create a community</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}>
        <Text style={styles.hint}>
          Name becomes the handle h/{name.trim() || 'name'}.
        </Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="builders"
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          maxLength={32}
          accessibilityLabel="Community name"
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={desc}
          onChangeText={setDesc}
          placeholder="What's this community about? (optional)"
          placeholderTextColor="#666"
          multiline
          numberOfLines={3}
          maxLength={280}
          accessibilityLabel="Community description"
        />
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={close}
            disabled={creating}
            accessibilityLabel="Cancel">
            <Text style={styles.btnGhostText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, (creating || !name.trim()) && {opacity: 0.6}]}
            onPress={submit}
            disabled={creating || !name.trim()}
            accessibilityLabel="Create community">
            {creating
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={styles.btnPrimaryText}>Create</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  headerBtn: { width: 40, alignItems: 'center' },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: { flex: 1, padding: wp('5%') },
  hint: { color: '#888', fontSize: 13, marginBottom: 14 },
  input: {
    backgroundColor: '#141225',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  btn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    marginLeft: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  btnGhost: { backgroundColor: '#1A1A1A' },
  btnGhostText: { color: '#FFF', fontWeight: '600' },
  btnPrimary: { backgroundColor: '#6C63FF' },
  btnPrimaryText: { color: '#FFF', fontWeight: '700' },
});

export default CreateCommunityScreen;
