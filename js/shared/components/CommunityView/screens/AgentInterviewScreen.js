/**
 * AgentInterviewScreen - Chat UI for interviewing a hive agent.
 * Uses inverted FlatList for chat-bottom layout.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import useExperimentStore from '../../../experimentStore';
import { colors } from '../../../theme/colors';

const ChatBubble = ({ message, index }) => {
  const isUser = message.role === 'user';
  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAgent,
      ]}
    >
      {!isUser && (
        <View style={styles.agentIcon}>
          <MaterialCommunityIcons name="robot" size={16} color={colors.accent} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAgent,
        ]}
      >
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
};

export default function AgentInterviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId, agentName } = route.params || {};
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  const messages = useExperimentStore((s) => s.interviewMessages);
  const interviewLoading = useExperimentStore((s) => s.interviewLoading);
  const sendInterview = useExperimentStore((s) => s.sendInterview);
  const clearInterview = useExperimentStore((s) => s.clearInterview);

  // Clear messages when leaving
  useEffect(() => {
    return () => clearInterview();
  }, [clearInterview]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || interviewLoading) return;
    setInputText('');
    sendInterview(postId, trimmed);
  }, [inputText, interviewLoading, postId, sendInterview]);

  // Inverted FlatList shows newest at bottom, so data must be reversed
  const reversedMessages = [...messages].reverse();

  const renderItem = useCallback(
    ({ item, index }) => <ChatBubble message={item} index={index} />,
    [],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            Interview: {agentName || 'Agent'}
          </Text>
          <Text style={styles.subtitle}>Ask questions to understand the agent</Text>
        </View>
        {interviewLoading && (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} />
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="chat-question-outline"
              size={48}
              color="#333"
            />
            <Text style={styles.emptyTitle}>Start the interview</Text>
            <Text style={styles.emptySubtitle}>
              Ask this agent about its reasoning, progress, or next steps.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={reversedMessages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            inverted
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Typing indicator */}
        {interviewLoading && messages.length > 0 && (
          <View style={styles.typingRow}>
            <View style={styles.agentIcon}>
              <MaterialCommunityIcons name="robot" size={14} color={colors.accent} />
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.typingText}>Thinking...</Text>
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question..."
            placeholderTextColor="#555"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!interviewLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || interviewLoading) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || interviewLoading}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() && !interviewLoading ? '#fff' : '#555'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0E17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#1A1932',
  },
  backBtn: {
    marginRight: wp(3),
  },
  title: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '700',
  },
  subtitle: {
    color: '#888',
    fontSize: wp(2.8),
    marginTop: 1,
  },
  chatArea: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
  },

  // Bubbles
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAgent: {
    justifyContent: 'flex-start',
  },
  agentIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1932',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bubble: {
    maxWidth: wp(72),
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: '#6C63FF',
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    backgroundColor: '#1A1932',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2A2950',
  },
  bubbleText: {
    color: '#ddd',
    fontSize: wp(3.2),
    lineHeight: wp(4.6),
  },
  bubbleTextUser: {
    color: '#fff',
  },

  // Typing
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingBottom: 6,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1932',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2A2950',
  },
  typingText: {
    color: '#888',
    fontSize: wp(2.8),
  },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderTopWidth: 1,
    borderTopColor: '#1A1932',
    backgroundColor: '#0F0E17',
  },
  input: {
    flex: 1,
    backgroundColor: '#1A1932',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: '#fff',
    fontSize: wp(3.2),
    maxHeight: hp(12),
    borderWidth: 1,
    borderColor: '#2A2950',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#1A1932',
  },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(10),
  },
  emptyTitle: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: wp(3),
    marginTop: 6,
    textAlign: 'center',
    lineHeight: wp(4.4),
  },
});
