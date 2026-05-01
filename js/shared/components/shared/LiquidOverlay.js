/**
 * LiquidOverlay -- floating bottom sheet for agent-served dynamic UI.
 *
 * Combines:
 *  - Chat input (send messages to agents)
 *  - LiquidUI rendering (agent responses can include dynamic_layout JSON rendered natively)
 *  - Bottom sheet dismiss (swipe down)
 *
 * Dependencies:
 *  - react-native-raw-bottom-sheet (v3)
 *  - react-native-vector-icons/MaterialCommunityIcons
 *  - zustand (liquidOverlayStore)
 *  - chatApi (services/chatApi)
 *  - theme/colors
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Keyboard,
  Platform,
  Animated,
  Dimensions,
  NativeModules,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import useLiquidOverlayStore from '../../liquidOverlayStore';
import useNunbaKeyboardStore from '../../nunbaKeyboardStore';
import useSecureInputStore from '../../secureInputStore';
import chatApi from '../../services/chatApi';
import realtimeService from '../../services/realtimeService';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  GRADIENTS,
  getAgentPalette,
} from '../../theme/colors';

// Attempt to import SocialLiquidUI -- it may not exist yet.
let SocialLiquidUI = null;
try {
  SocialLiquidUI = require('./SocialLiquidUI').default;
} catch (_) {
  // SocialLiquidUI not available; dynamic layouts will render as raw JSON fallback.
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple unique-id generator (no uuid dependency). */
let _idCounter = 0;
const generateId = () =>
  `conv_${Date.now()}_${++_idCounter}_${Math.random().toString(36).slice(2, 8)}`;

/** Resolve the native user id via the same pattern as socialApi.js / chatApi.js. */
const getUserId = () =>
  new Promise((resolve, reject) => {
    try {
      NativeModules.OnboardingModule.getUser_id((userId) => {
        resolve(userId);
      });
    } catch (err) {
      reject(err);
    }
  });

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.85);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Gradient-ish fallback (no react-native-linear-gradient). Renders a
 *  solid View using the *first* colour of the gradient array. */
const GradientView = ({ gradientColors, style, children }) => (
  <View
    style={[
      style,
      { backgroundColor: (gradientColors && gradientColors[0]) || colors.accent },
    ]}>
    {children}
  </View>
);

/** Three pulsing dots indicating the agent is thinking. */
const ThinkingDots = React.memo(() => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 150);
    const a3 = pulse(dot3, 300);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.thinkingRow}>
      {[dot1, dot2, dot3].map((opacity, i) => (
        <Animated.View
          key={i}
          style={[styles.thinkingDot, { opacity }]}
        />
      ))}
    </View>
  );
});

/** Single chat message bubble. */
const MessageBubble = React.memo(({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <View
      style={[
        styles.bubbleWrapper,
        isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant,
      ]}>
      {isUser ? (
        <GradientView
          gradientColors={GRADIENTS.primary}
          style={[styles.bubble, styles.bubbleUser]}>
          <Text style={styles.bubbleTextUser}>{msg.text}</Text>
        </GradientView>
      ) : (
        <View style={[styles.bubble, styles.bubbleAssistant, msg.isDraft && styles.bubbleDraft]}>
          <Text style={styles.bubbleTextAssistant}>{msg.text}</Text>
          {msg.isDraft ? (
            <Text style={styles.draftBadge}>draft -- refining...</Text>
          ) : null}
        </View>
      )}
    </View>
  );
});

/** Welcome / empty state. */
const WelcomeState = React.memo(({ agentName }) => {
  const palette = getAgentPalette(agentName);
  return (
    <View style={styles.welcomeContainer}>
      {/* Emblem */}
      <View style={[styles.welcomeEmblem, { backgroundColor: palette.bg }]}>
        <Icon name="creation" size={40} color={palette.accent} />
      </View>

      {/* Heading -- would be gradient text if we had LinearGradient + MaskedView */}
      <Text style={styles.welcomeTitle}>Create your Hyve</Text>

      <Text style={styles.welcomeSubtitle}>
        {agentName} is your guardian angel.{'\n'}Ask anything, build agents, or
        explore ideas.
      </Text>

      {/* Privacy trust indicator */}
      <Text style={[styles.welcomeCtaText, { fontSize: 10, opacity: 0.6, textAlign: 'center', marginTop: 4 }]}>
        Encrypted · AI learns locally · No single entity controls the model
      </Text>

      {/* CTA hint */}
      <View style={styles.welcomeCta}>
        <Icon
          name="message-text-outline"
          size={18}
          color={colors.textSecondary}
        />
        <Text style={styles.welcomeCtaText}>Start a conversation</Text>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const LiquidOverlay = () => {
  const sheetRef = useRef(null);
  const flatListRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [userId, setUserId] = useState(null);

  // Zustand store
  const visible = useLiquidOverlayStore((s) => s.visible);
  const layout = useLiquidOverlayStore((s) => s.layout);
  const layoutData = useLiquidOverlayStore((s) => s.layoutData);
  const agentName = useLiquidOverlayStore((s) => s.agentName);
  const agentPromptId = useLiquidOverlayStore((s) => s.agentPromptId);
  const messages = useLiquidOverlayStore((s) => s.messages);
  const isLoading = useLiquidOverlayStore((s) => s.isLoading);
  const conversationId = useLiquidOverlayStore((s) => s.conversationId);
  const dismiss = useLiquidOverlayStore((s) => s.dismiss);
  const pushMessage = useLiquidOverlayStore((s) => s.pushMessage);
  const replaceDraft = useLiquidOverlayStore((s) => s.replaceDraft);
  const setLoading = useLiquidOverlayStore((s) => s.setLoading);
  const setConversationId = useLiquidOverlayStore((s) => s.setConversationId);
  const showLayout = useLiquidOverlayStore((s) => s.show);
  const showNunbaKeyboard = useNunbaKeyboardStore((s) => s.show);

  // Agent palette for avatar colour
  const palette = useMemo(() => getAgentPalette(agentName), [agentName]);

  // ── Resolve user_id once ──
  useEffect(() => {
    getUserId()
      .then((id) => setUserId(id))
      .catch(() => {
        // Fallback: anonymous / device-id based
        setUserId('anon_' + Date.now());
      });
  }, []);

  // ── Open / close bottom sheet in response to store.visible ──
  useEffect(() => {
    if (visible && sheetRef.current) {
      sheetRef.current.open();
    } else if (!visible && sheetRef.current) {
      sheetRef.current.close();
    }
  }, [visible]);

  // ── Auto-scroll when messages change ──
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd?.({ animated: true });
      }, 150);
    }
  }, [messages.length, isLoading]);

  // ── Draft-replacement: listen for expert WAMP responses ──
  // When the backend returns a draft (0.8B fast response) with a
  // speculation_id, the expert model later publishes the refined
  // response over WAMP. This listener replaces the draft bubble
  // in-place, preventing the "two bubbles" confusion.
  useEffect(() => {
    const unsub = realtimeService.on('chat_response', (data) => {
      if (!data) return;
      const specId = data.speculation_id;
      const text =
        (Array.isArray(data.text) ? data.text[0] : data.text) ||
        data.response ||
        '';
      if (specId && text) {
        replaceDraft(specId, text, data.source || 'expert');
        setLoading(false);
      }
    });
    return unsub;
  }, [replaceDraft, setLoading]);

  // ── Handle send ──
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    Keyboard.dismiss();
    setInputText('');

    // Ensure we have a conversation id
    let convId = conversationId;
    if (!convId) {
      convId = generateId();
      setConversationId(convId);
    }

    // 1. Push user message into store
    pushMessage({ role: 'user', text, ts: Date.now() });

    // 2. Call the chat API
    setLoading(true);
    try {
      const payload = {
        text,
        user_id: userId,
        conversation_id: convId,
        casual_conv: !agentPromptId,
      };
      if (agentPromptId) {
        payload.prompt_id = agentPromptId;
      }

      const res = await chatApi.chat(payload);

      // 3a. Push assistant text.
      // Draft-first: when the backend returns speculation_id + expert_pending,
      // tag the message as a draft so the expert WAMP response can replace it
      // in-place instead of appending a second bubble.
      const assistantText =
        res?.response ||
        res?.text ||
        res?.message ||
        res?.answer ||
        (typeof res === 'string' ? res : 'I could not generate a response.');
      const assistantMsg = {
        role: 'assistant',
        text: assistantText,
        ts: Date.now(),
      };
      if (res?.speculation_id && res?.expert_pending) {
        assistantMsg.speculationId = res.speculation_id;
        assistantMsg.isDraft = true;
      }
      pushMessage(assistantMsg);

      // 3b. Agent-driven secret request — open SecureInputOverlay
      if (res?.secret_request) {
        useSecureInputStore.getState().requestSecret(res.secret_request);
      }

      // 3c. If the response carries a dynamic_layout, surface it
      if (res?.dynamic_layout) {
        showLayout(
          res.dynamic_layout,
          res.dynamic_data || res.layout_data || {},
          agentName,
        );
      }
    } catch (err) {
      pushMessage({
        role: 'assistant',
        text: 'Something went wrong. Please try again.',
        ts: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }, [
    inputText,
    isLoading,
    conversationId,
    userId,
    agentPromptId,
    agentName,
    pushMessage,
    setLoading,
    setConversationId,
    showLayout,
  ]);

  // ── Render a single list item ──
  const renderItem = useCallback(({ item }) => <MessageBubble msg={item} />, []);

  const keyExtractor = useCallback(
    (item, index) => `${item.role}_${item.ts}_${index}`,
    [],
  );

  // ── Build the data array: optional dynamic layout card + messages ──
  const listData = useMemo(() => {
    // Dynamic layout is rendered as a header, not inside the FlatList data,
    // so we just return messages here.
    return messages;
  }, [messages]);

  // ── Header: dynamic LiquidUI layout above the messages ──
  const ListHeaderComponent = useMemo(() => {
    if (!layout) return null;
    if (SocialLiquidUI) {
      return (
        <View style={styles.liquidLayoutCard}>
          <SocialLiquidUI layout={layout} data={layoutData} />
        </View>
      );
    }
    // Fallback: raw JSON preview
    return (
      <View style={styles.liquidLayoutCard}>
        <Text style={styles.liquidFallbackLabel}>Dynamic Layout</Text>
        <Text style={styles.liquidFallbackJson} numberOfLines={12}>
          {JSON.stringify(layout, null, 2)}
        </Text>
      </View>
    );
  }, [layout, layoutData]);

  // ── Empty list component (welcome state) ──
  const ListEmptyComponent = useMemo(() => {
    if (layout) return null; // layout is showing, don't show welcome
    return <WelcomeState agentName={agentName} />;
  }, [agentName, layout]);

  // ── Footer: thinking dots ──
  const ListFooterComponent = useMemo(() => {
    if (!isLoading) return null;
    return (
      <View style={styles.bubbleWrapper}>
        <View style={[styles.bubble, styles.bubbleAssistant]}>
          <ThinkingDots />
        </View>
      </View>
    );
  }, [isLoading]);

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  return (
    <RBSheet
      ref={sheetRef}
      height={SHEET_HEIGHT}
      openDuration={300}
      closeDuration={250}
      closeOnPressMask={true}
      closeOnPressBack={true}
      draggable={true}
      dragOnContent={false}
      onClose={dismiss}
      customStyles={{
        wrapper: styles.sheetWrapper,
        container: styles.sheetContainer,
        draggableIcon: styles.dragHandle,
      }}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Agent avatar */}
          <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
            <Text style={[styles.avatarLetter, { color: palette.accent }]}>
              {(agentName || 'N').charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {agentName || 'Nunba'}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Your guardian angel
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            if (sheetRef.current) sheetRef.current.close();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Icon name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />

      {/* ── Input bar ── */}
      <View
        style={[
          styles.inputBar,
          Platform.OS === 'ios' && { paddingBottom: spacing.lg },
        ]}>
        <TouchableOpacity
          style={styles.kbToggle}
          activeOpacity={0.7}
          onPress={() => {
            showNunbaKeyboard({
              onChangeText: setInputText,
              onSubmit: (t) => { setInputText(t); handleSend(); },
              initialText: inputText,
              placeholder: 'Ask Nunba anything...',
            });
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="keyboard-variant" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.inputPill}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Nunba anything..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!isLoading}
            multiline={false}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleSend}
          disabled={isLoading || !inputText.trim()}>
          <GradientView
            gradientColors={GRADIENTS.primary}
            style={[
              styles.sendBtn,
              (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
            ]}>
            <Icon
              name="send"
              size={20}
              color={colors.textOnDark}
            />
          </GradientView>
        </TouchableOpacity>
      </View>
    </RBSheet>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ── Sheet chrome ──
  sheetWrapper: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    ...shadows.xl,
  },
  dragHandle: {
    backgroundColor: colors.textMuted,
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  headerTextBlock: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  // ── Divider ──
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },

  // ── Message list ──
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexGrow: 1,
  },

  // ── Bubbles ──
  bubbleWrapper: {
    marginBottom: spacing.sm,
  },
  bubbleWrapperUser: {
    alignItems: 'flex-end',
  },
  bubbleWrapperAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
  },
  bubbleUser: {
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.surfaceOverlay,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderBottomLeftRadius: borderRadius.sm,
  },
  bubbleTextUser: {
    color: colors.textOnDark,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  bubbleTextAssistant: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  bubbleDraft: {
    borderColor: colors.accent,
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  draftBadge: {
    color: colors.accent,
    fontSize: fontSize.xs - 1,
    fontStyle: 'italic',
    marginTop: 4,
    opacity: 0.7,
  },

  // ── Thinking dots ──
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 5,
  },
  thinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginHorizontal: 2,
  },

  // ── Welcome / empty state ──
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  welcomeEmblem: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  welcomeTitle: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  welcomeSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.6,
    marginBottom: spacing.lg,
  },
  welcomeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceOverlay,
  },
  welcomeCtaText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginLeft: spacing.xs,
  },

  // ── Dynamic layout card ──
  liquidLayoutCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  liquidFallbackLabel: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  liquidFallbackJson: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: fontSize.xs * 1.5,
  },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  kbToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  inputPill: {
    flex: 1,
    height: 44,
    backgroundColor: colors.card,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  textInput: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});

export default LiquidOverlay;
