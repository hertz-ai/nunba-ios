import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, Animated,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { chatApi } from '../../../services/chatApi';
import { NativeModules } from 'react-native';
import EmptyState from '../../shared/EmptyState';
import { flatListVirtualizationProps } from '../../shared/listPerf';

const BUBBLE_HEIGHT = 80;

const userIdOrZero = () => {
  try {
    const m = NativeModules?.ActivityStarterModule;
    if (m && typeof m.getUser_Id === 'function') {
      const id = m.getUser_Id();
      return Number(id) || 0;
    }
  } catch (_) {}
  return 0;
};

const TypingDots = () => {
  const dots = [useRef(new Animated.Value(0.3)).current,
                useRef(new Animated.Value(0.3)).current,
                useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={styles.typingRow}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[styles.typingDot, { opacity: d }]} />
      ))}
    </View>
  );
};

const Bubble = ({ item }) => {
  const isUser = item.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}>
          {item.text}
        </Text>
      </View>
    </View>
  );
};

const CustomBotChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route?.params || {};
  const botId = params.botId || params.bot_id || 'default';
  const botName = params.botName || params.name || 'Assistant';
  const botImage = params.botImage || params.image || null;

  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const conversationId = `custom_bot_${botId}`;

  const send = useCallback(async () => {
    const text = pending.trim();
    if (!text || sending) return;
    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPending('');
    setSending(true);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    });

    try {
      const userId = userIdOrZero();
      const res = await chatApi.customGpt({
        user_id: userId,
        conversation_id: conversationId,
        bot_id: botId,
        message: text,
        text,
      });
      if (!mountedRef.current) return;
      const botMsg = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: res?.message || res?.text || res?.response || res?.answer || 'OK',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    } catch (e) {
      if (!mountedRef.current) return;
      const errMsg = {
        id: `b-${Date.now()}-err`,
        role: 'bot',
        text: 'Could not reach the bot. Check your connection and try again.',
        created_at: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [pending, sending, conversationId, botId]);

  const renderItem = ({ item }) => <Bubble item={item} />;

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
          {botImage ? (
            <Image source={{ uri: botImage }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarLetter}>{(botName?.[0] || '?').toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>{botName}</Text>
            <Text style={styles.headerSubtitle}>
              {sending ? 'Typing…' : 'Online'}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title={`Start chatting with ${botName}`}
              subtitle="Ask anything — your conversation stays private to you."
            />
          }
          {...flatListVirtualizationProps(BUBBLE_HEIGHT)}
        />

        {sending ? <TypingDots /> : null}

        <View style={styles.composer}>
          <TextInput
            value={pending}
            onChangeText={setPending}
            placeholder={`Message ${botName}…`}
            placeholderTextColor="#666"
            style={styles.input}
            multiline
            maxLength={2000}
            editable={!sending}
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!pending.trim() || sending) && styles.sendButtonDisabled]}
            onPress={send}
            disabled={!pending.trim() || sending}
            accessibilityLabel="Send message">
            {sending
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Ionicons name="send" size={20} color="#FFF" />}
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
  body: { flex: 1 },
  listContent: { padding: wp('3%'), paddingBottom: hp('2%'), flexGrow: 1 },
  bubbleRow: { marginVertical: 4, flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowBot: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleUser: { backgroundColor: '#6C63FF', borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: '#1C1B2E', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: wp('3.7%'), lineHeight: 20 },
  bubbleTextUser: { color: '#FFF' },
  bubbleTextBot: { color: '#E3E3E3' },
  typingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp('4%'), paddingVertical: 4,
  },
  typingDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#6C63FF', marginRight: 5,
  },
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

export default CustomBotChatScreen;
