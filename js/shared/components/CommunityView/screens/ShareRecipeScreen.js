/**
 * ShareRecipeScreen — closes the recipes-fab gap (2026-06-20).
 *
 * RecipesScreen had no Create/Share CTA: header had only back+title,
 * empty state had no action, no FAB existed.  Backend write path
 * (`recipesApi.share` → POST /recipes/share) was already wired in
 * services/socialApi.js but unreachable from the UI.
 *
 * Mirrors CreateCommunityScreen's modal-form pattern (#419) so we get
 * back-button + safe-area + keyboard avoidance for free, and stay
 * consistent with the rest of CommunityView's create flows.  Caller
 * (RecipesScreen) passes an optional `onShared` callback used to
 * prepend the new recipe into the list without waiting for a refetch.
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
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { recipesApi } from '../../../services/socialApi';

const _toast = (msg) => {
  try {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    }
  } catch (_) {}
};

const ShareRecipeScreen = ({ navigation, route }) => {
  const onShared = route?.params?.onShared;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => { try { navigation.goBack(); } catch (_) {} };

  const submit = async () => {
    const trimmedName = (name || '').trim();
    const trimmedDesc = (description || '').trim();
    const trimmedContent = (content || '').trim();
    if (!trimmedName) {
      _toast('Recipe name is required');
      return;
    }
    if (!trimmedContent) {
      _toast('Recipe code/content is required');
      return;
    }
    const tagsArr = (tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);
    setSubmitting(true);
    try {
      const res = await recipesApi.share({
        name: trimmedName,
        description: trimmedDesc,
        tags: tagsArr,
        content: trimmedContent,
      });
      if (!res || typeof res !== 'object') {
        _toast('Share failed: empty server response');
        setSubmitting(false);
        return;
      }
      if (res.error && !res.id && !(res.data && res.data.id)) {
        _toast(`Share failed: ${res.error || 'server error'}`);
        setSubmitting(false);
        return;
      }
      const created = (res.data || res) || null;
      if (typeof onShared === 'function' && created) {
        try { onShared(created); } catch (_) {}
      }
      try { _toast(`Shared "${trimmedName}"`); } catch (_) {}
      setSubmitting(false);
      setTimeout(() => { try { navigation.goBack(); } catch (_) {} }, 50);
    } catch (e) {
      const msg = (e && (e.message || String(e))) || 'Network error';
      try { _toast(`Share failed: ${msg}`); } catch (_) {}
      setSubmitting(false);
    }
  };

  const canSubmit = !!name.trim() && !!content.trim() && !submitting;

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
        <Text style={styles.headerTitle}>Share a recipe</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            Share a reusable recipe — others can fork it into their own collection.
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Recipe name"
            placeholderTextColor="#666"
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            maxLength={64}
            accessibilityLabel="Recipe name"
          />
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What does it do? (optional)"
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
            maxLength={280}
            accessibilityLabel="Recipe description"
          />
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="Tags (comma-separated, up to 5)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={120}
            accessibilityLabel="Recipe tags"
          />
          <TextInput
            style={[styles.input, styles.codeArea]}
            value={content}
            onChangeText={setContent}
            placeholder="Recipe code or content"
            placeholderTextColor="#666"
            multiline
            numberOfLines={8}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Recipe content"
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={close}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, !canSubmit && {opacity: 0.6}]}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Share recipe">
              {submitting
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={styles.btnPrimaryText}>Share</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  body: { flex: 1 },
  scroll: { padding: wp('5%'), paddingBottom: 40 },
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
  codeArea: {
    minHeight: 160,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
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
  btnPrimary: { backgroundColor: '#0078ff' },
  btnPrimaryText: { color: '#FFF', fontWeight: '700' },
});

export default ShareRecipeScreen;
