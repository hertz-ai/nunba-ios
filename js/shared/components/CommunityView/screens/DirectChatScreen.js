import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { authApi, conversationsApi } from '../../../services/socialApi';
import EmptyState from '../../shared/EmptyState';
import { flatListVirtualizationProps } from '../../shared/listPerf';

// A 1:1 conversation from /api/social/conversations (Start Chat on an
// Encounters match, Message on a friend). Same look as CustomBotChatScreen.
// ConversationHistory is the external-channel log and ignores
// conversation_id, so DMs need their own screen.

const BUBBLE_HEIGHT = 80;
// No live push yet: the server notifies members, but not over a stream this
// screen subscribes to, so new messages arrive by polling.
export const POLL_MS = 4000;

// socialApi returns the {success, data, error} envelope and throws only on
// network failure; normalise both into one shape.
const call = (promise) =>
  promise.catch((e) => ({ success: false, error: e?.message, network: true }));

// The server's own text for a switched-off feature is fine for logs, not
// for people.
export const friendlyError = (res, fallback) => {
  const text = res?.error || '';
  if (/feature flag is off/i.test(text)) {
    return "Messaging isn't switched on yet. Try again later.";
  }
  if (/not a conversation member/i.test(text)) {
    return "You're not part of this conversation.";
  }
  if (res?.network) {
    return 'No connection. Check your internet and try again.';
  }
  return fallback;
};

const Bubble = ({ item, onRetry }) => {
  const mine = item.mine;
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowUser : styles.bubbleRowBot]}>
      <TouchableOpacity
        activeOpacity={item.failed ? 0.6 : 1}
        disabled={!item.failed}
        onPress={() => onRetry(item)}
        accessibilityLabel={item.failed ? 'Message not sent. Tap to retry.' : undefined}
        style={[
          styles.bubble,
          mine ? styles.bubbleUser : styles.bubbleBot,
          item.pending && styles.bubblePending,
          item.failed && styles.bubbleFailed,
        ]}>
        <Text style={[styles.bubbleText, mine ? styles.bubbleTextUser : styles.bubbleTextBot]}>
          {item.content}
        </Text>
      </TouchableOpacity>
      {item.failed ? (
        <Text style={styles.failedText}>Not sent · Tap to retry</Text>
      ) : null}
    </View>
  );
};

const DirectChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route?.params || {};
  const conversationId = params.conversation_id || params.conversationId;
  const name = params.name || 'Chat';
  const avatar = params.avatar_url || null;

  const [myId, setMyId] = useState(null);
  const [serverMessages, setServerMessages] = useState([]);
  // Messages typed here that the server hasn't confirmed yet (sending or failed).
  const [local, setLocal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(null); // a refusal that stops the whole chat
  const [pending, setPending] = useState('');
  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const lastCountRef = useRef(0);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    call(authApi.me()).then((r) => {
      if (mountedRef.current && r?.data?.id) setMyId(r.data.id);
    });
  }, []);

  const scrollToEnd = () =>
    requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }));

  const load = useCallback(async () => {
    if (!conversationId) {
      setLoading(false);
      setBlocked("Couldn't open this conversation.");
      return;
    }
    const res = await call(conversationsApi.messages(conversationId));
    if (!mountedRef.current) return;
    setLoading(false);
    if (res?.success && Array.isArray(res.data)) {
      setBlocked(null);
      // The server sends newest first; a chat reads oldest first.
      const ordered = [...res.data].reverse();
      setServerMessages(ordered);
      if (ordered.length !== lastCountRef.current) {
        lastCountRef.current = ordered.length;
        scrollToEnd();
      }
    } else if (!res?.network) {
      // A poll on a flaky network keeps what's on screen; a refusal
      // (flag off, not a member) replaces it with the reason.
      setBlocked(friendlyError(res, "Couldn't load this conversation."));
    }
  }, [conversationId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const deliver = useCallback(async (item) => {
    const res = await call(conversationsApi.send(conversationId, item.content));
    if (!mountedRef.current) return;
    if (res?.success && res.data?.id) {
      setLocal((prev) => prev.filter((m) => m.id !== item.id));
      setServerMessages((prev) =>
        prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data]);
      lastCountRef.current += 1;
    } else {
      setLocal((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, pending: false, failed: true } : m)));
      const reason = friendlyError(res, null);
      if (reason && !res?.network) setBlocked(reason);
    }
  }, [conversationId]);

  const send = useCallback(() => {
    const content = pending.trim();
    if (!content || !conversationId) return;
    const item = { id: `local-${Date.now()}`, content, mine: true, pending: true };
    setLocal((prev) => [...prev, item]);
    setPending('');
    scrollToEnd();
    deliver(item);
  }, [pending, conversationId, deliver]);

  const retry = useCallback((item) => {
    setLocal((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, pending: true, failed: false } : m)));
    deliver(item);
  }, [deliver]);

  const messages = [
    ...serverMessages.map((m) => ({ ...m, mine: !!myId && m.author_id === myId })),
    ...local,
  ];

  const renderItem = ({ item }) => <Bubble item={item} onRetry={retry} />;
  const canSend = !!pending.trim() && !blocked && !!conversationId;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarLetter}>{(name?.[0] || '?').toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.headerSubtitle}>Direct message</Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {blocked ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color="#FFB4B4" />
          <Text style={styles.bannerText}>{blocked}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#6C63FF" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(it) => String(it.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              blocked ? null : (
                <EmptyState
                  icon="chatbubbles-outline"
                  title={`Say hi to ${name}`}
                  subtitle="Only the two of you can see this conversation."
                />
              )
            }
            {...flatListVirtualizationProps(BUBBLE_HEIGHT)}
          />
        )}

        <View style={styles.composer}>
          <TextInput
            value={pending}
            onChangeText={setPending}
            placeholder={blocked ? 'Messaging unavailable' : `Message ${name}…`}
            placeholderTextColor="#666"
            style={styles.input}
            multiline
            maxLength={2000}
            editable={!blocked}
          />
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={send}
            disabled={!canSend}
            accessibilityLabel="Send message">
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp('3%'), paddingVertical: hp('1.2%'),
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  backButton: { padding: 6, marginRight: 6 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18, marginRight: 10,
    backgroundColor: '#1A1A1A',
  },
  headerAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  headerAvatarLetter: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  headerTitle: { color: '#FFF', fontSize: wp('4.5%'), fontWeight: '700' },
  headerSubtitle: { color: '#888', fontSize: wp('3%'), marginTop: 2 },
  headerSpacer: { width: 32 },
  banner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: wp('3%'), marginTop: hp('1%'),
    padding: 10, borderRadius: 12, backgroundColor: '#2A1418',
  },
  bannerText: { color: '#FFB4B4', fontSize: wp('3.4%'), marginLeft: 8, flex: 1 },
  body: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: wp('3%'), paddingBottom: hp('2%'), flexGrow: 1 },
  bubbleRow: { marginVertical: 4 },
  bubbleRowUser: { alignItems: 'flex-end' },
  bubbleRowBot: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleUser: { backgroundColor: '#6C63FF', borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: '#1C1B2E', borderBottomLeftRadius: 4 },
  bubblePending: { opacity: 0.6 },
  bubbleFailed: { backgroundColor: '#4A2A3A' },
  bubbleText: { fontSize: wp('3.7%'), lineHeight: 20 },
  bubbleTextUser: { color: '#FFF' },
  bubbleTextBot: { color: '#E3E3E3' },
  failedText: { color: '#FF8A8A', fontSize: wp('2.9%'), marginTop: 3 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: wp('2.5%'), borderTopWidth: 1, borderTopColor: '#1A1A1A',
    backgroundColor: '#0A0A0A',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: '#141225', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    color: '#FFF', fontSize: wp('3.8%'),
    marginRight: 8,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#2A2A3A' },
});

export default DirectChatScreen;
