/**
 * CreateCodingGoalScreen — closes coding-newgoal-fab gap.
 *
 * Surfaces a New Goal CTA from CodingAgentScreen.  Mirrors the
 * CreateCommunityScreen pattern (Stack.Screen with presentation:'modal',
 * no inline Modal — see #419) so the keyboard, safe-area, and back
 * affordance all behave correctly on Samsung + Xiaomi.
 *
 * POST /api/coding/goals via codingApi.createGoal({ title, description,
 * repo_url, status: 'active' }).  After success the parent
 * CodingAgentScreen reloads via its existing focus/refresh path.
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { codingApi } from '../../../services/socialApi';

const _toast = (msg) => {
  try {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    }
  } catch (_) {}
};

const CreateCodingGoalScreen = ({ navigation, route }) => {
  const onCreated = route?.params?.onCreated;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const close = () => { try { navigation.goBack(); } catch (_) {} };

  const submit = async () => {
    const t = title.trim();
    const d = description.trim();
    const r = repoUrl.trim();
    if (!t && !d) {
      _toast('Add a title or description');
      return;
    }
    setCreating(true);
    let created = null;
    try {
      const resp = await codingApi.createGoal({
        title: t,
        description: d,
        repo_url: r,
        status: 'active',
      });
      created = (resp && (resp.data || resp)) || null;
    } catch (e) {
      _toast('Could not create goal');
      setCreating(false);
      return;
    }
    try { if (typeof onCreated === 'function' && created) onCreated(created); } catch (_) {}
    try { _toast('Goal created'); } catch (_) {}
    close();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={close}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Coding Goal</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Add dark-mode to landing page"
            placeholderTextColor="#555"
            style={styles.input}
            maxLength={120}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What should the agent do?"
            placeholderTextColor="#555"
            style={[styles.input, styles.multiline]}
            multiline
            maxLength={1000}
          />

          <Text style={styles.label}>Repository URL (optional)</Text>
          <TextInput
            value={repoUrl}
            onChangeText={setRepoUrl}
            placeholder="https://github.com/org/repo"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            maxLength={300}
          />

          <TouchableOpacity
            style={[styles.submitBtn, creating && { opacity: 0.6 }]}
            disabled={creating}
            onPress={submit}
            activeOpacity={0.85}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.submitText}>Create Goal</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  scrollContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('6%') },
  label: { color: '#AAA', fontSize: wp('3.2%'), marginTop: hp('2%'), marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#141225', borderRadius: 10, paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('1.4%'), color: '#FFF', fontSize: wp('3.6%'),
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  multiline: { minHeight: hp('12%'), textAlignVertical: 'top' },
  submitBtn: {
    marginTop: hp('3%'), backgroundColor: '#6C63FF', borderRadius: 12,
    paddingVertical: hp('1.8%'), alignItems: 'center', justifyContent: 'center',
  },
  submitText: { color: '#FFF', fontSize: wp('4%'), fontWeight: '700' },
});

export default CreateCodingGoalScreen;
