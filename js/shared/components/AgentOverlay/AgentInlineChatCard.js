/**
 * AgentInlineChatCard -- Renders agent UI components as styled cards
 * inline between chat messages.
 *
 * Listens for 'onAgentInlineChatCard' events from AgentOverlayBridge
 * and renders: product_card, cart, checkout, comparison, form.
 *
 * Usage in chat screen:
 *   import { AgentInlineChatCard } from '../AgentOverlay/AgentInlineChatCard';
 *   // In FlatList renderItem, when item.type === 'agent_card':
 *   <AgentInlineChatCard component={item.component} />
 *
 *   // Or use the hook to collect incoming cards:
 *   const cards = useAgentInlineCards();
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  DeviceEventEmitter,
  Linking,
  TextInput,
} from 'react-native';

// ---- Shared style tokens (glass/dark aesthetic) ----

const COLORS = {
  bg: 'rgba(20, 20, 30, 0.92)',
  surface: 'rgba(40, 40, 55, 0.85)',
  accent: '#64C8FF',
  accentDim: 'rgba(100, 200, 255, 0.15)',
  text: '#FFFFFF',
  textMuted: 'rgba(200, 200, 200, 0.7)',
  border: 'rgba(255, 255, 255, 0.08)',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FFC107',
  gold: 'rgba(255, 215, 0, 0.9)',
};

// ---- Hook: collect inline cards from event emitter ----

export function useAgentInlineCards() {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onAgentInlineChatCard', (component) => {
      setCards((prev) => [
        ...prev,
        { id: `card-${Date.now()}-${Math.random()}`, component },
      ]);
    });
    // Auto-dismiss oauth_link cards when the OAuth callback completes.
    // The native browser → /api/oauth/<type>/callback close-page posts
    // back via deepLinkService → DeviceEventEmitter('onAgentOAuthComplete').
    // We drop matching oauth_link cards from the list; the upstream UX
    // (success toast) is fired separately by the same emitter.
    const oauthSub = DeviceEventEmitter.addListener('onAgentOAuthComplete', (event) => {
      if (!event || !event.channel_type) return;
      setCards((prev) => prev.filter(
        (c) => !(
          c.component
          && c.component.type === 'oauth_link'
          && c.component.channel_type === event.channel_type
        ),
      ));
    });
    return () => { sub.remove(); oauthSub.remove(); };
  }, []);

  const clearCards = useCallback(() => setCards([]), []);
  return { cards, clearCards };
}

// ---- Main Component ----

export function AgentInlineChatCard({ component }) {
  if (!component) return null;
  const type = component.type || 'card';

  switch (type) {
    case 'product_card':
      return <ProductCard data={component} />;
    case 'cart':
      return <CartCard data={component} />;
    case 'checkout':
      return <CheckoutCard data={component} />;
    case 'comparison':
      return <ComparisonCard data={component} />;
    case 'form':
      return <FormCard data={component} />;
    case 'qr_pair':
      return <QRPairCard data={component} />;
    case 'oauth_link':
      return <OAuthLinkCard data={component} />;
    case 'banner':
      return <BannerCard data={component} />;
    case 'toast':
      return <ToastCard data={component} />;
    default:
      return <GenericCard data={component} />;
  }
}

// ---- Product Card ----

function ProductCard({ data }) {
  return (
    <View style={styles.card}>
      {data.image ? (
        <Image
          source={{ uri: data.image }}
          style={styles.productImage}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.cardBody}>
        <Text style={styles.title}>{data.name || 'Product'}</Text>
        {data.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {data.description}
          </Text>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.price}>{data.price || 'Free'}</Text>
          {data.rating ? (
            <Text style={styles.rating}>
              {'★ ' + data.rating}
            </Text>
          ) : null}
        </View>
        {data.buy_action ? (
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => postAction(data.buy_action)}
          >
            <Text style={styles.btnText}>Buy</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ---- Cart Card ----

function CartCard({ data }) {
  const items = data.items || [];
  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.title}>
          {'\uD83D\uDED2 Cart (' + items.length + ' items)'}
        </Text>
        {items.map((item, i) => (
          <View key={i} style={styles.listRow}>
            <Text style={styles.listItemText}>{item.name || 'Item'}</Text>
            <Text style={styles.listItemAccent}>{item.price || ''}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.rowEnd}>
          <Text style={styles.totalText}>
            {'Total: ' + (data.total || 0) + ' ' + (data.currency || 'Spark')}
          </Text>
        </View>
        {data.checkout_action ? (
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => postAction(data.checkout_action)}
          >
            <Text style={styles.btnText}>Checkout</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ---- Checkout Card ----

function CheckoutCard({ data }) {
  const items = data.items || [];
  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.desc}>
          {items.length + ' items — ' + (data.total || 0) + ' ' + (data.currency || 'Spark')}
        </Text>
        {data.confirm_action ? (
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => postAction(data.confirm_action)}
          >
            <Text style={styles.btnText}>Confirm Payment</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ---- Comparison Card ----

function ComparisonCard({ data }) {
  const apps = data.apps || [];
  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.title}>Feature Comparison</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {apps.map((app, i) => (
            <View key={i} style={styles.comparisonItem}>
              <Text style={styles.comparisonName}>{app.name || 'App'}</Text>
              {app.rating ? (
                <Text style={styles.comparisonRating}>{'★ ' + app.rating}</Text>
              ) : null}
              {app.price ? (
                <Text style={styles.comparisonPrice}>{app.price}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
        {data.winner ? (
          <Text style={styles.winnerText}>{'Winner: ' + data.winner}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ---- Form Card ----

function FormCard({ data }) {
  const [values, setValues] = useState({});
  const fields = data.fields || [];

  const onSubmit = () => {
    const action = data.action || '/api/a2ui';
    postAction(action, values);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.title}>{data.title || 'Form'}</Text>
        {fields.map((field, i) => {
          const name = field.name || field.label || `field_${i}`;
          return (
            <View key={i} style={{ marginTop: 8 }}>
              {field.label ? (
                <Text style={styles.fieldLabel}>{field.label}</Text>
              ) : null}
              <TextInput
                style={styles.textInput}
                placeholder={field.placeholder || ''}
                placeholderTextColor="rgba(200,200,200,0.4)"
                value={values[name] || field.value || ''}
                onChangeText={(text) =>
                  setValues((prev) => ({ ...prev, [name]: text }))
                }
                secureTextEntry={field.type === 'password'}
                keyboardType={
                  field.type === 'number' ? 'numeric' :
                  field.type === 'email' ? 'email-address' : 'default'
                }
              />
            </View>
          );
        })}
        <TouchableOpacity style={styles.btnPrimary} onPress={onSubmit}>
          <Text style={styles.btnText}>{data.submit_label || 'Submit'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---- QR pair card (channel onboarding via auth_method='qr_session') ----
//
// Driven by HARTOS's `agent_ui_update({type: 'qr_pair', qr, channel,
// title, help})` emitted from `_wire_qr_pair_emitter` after register_channel
// succeeds.  Same Liquid UI surface the FormCard uses — single emit pipe,
// new payload kind.  User scans with their existing client app
// (WhatsApp Linked devices, Telegram Devices, Discord Authorize) →
// adapter completes the handshake → server emits a "connected" event
// that auto-dismisses this card.
//
// QR rendering: lazy-import `react-native-qrcode-svg` so jest renders
// without the native dep + builds without the pod when the screen
// isn't on the user's path (matches the @livekit/react-native lazy
// pattern in CallChannelScreen.js).
function QRPairCard({ data }) {
  const qr = (data && data.qr) || '';
  const channelType = (data && (data.channel || data.channel_type)) || '';
  const title = (data && data.title) || 'Scan to connect';
  const help = (data && data.help) || (
    'Open the app on your phone, find Linked devices, and scan this code.'
  );
  let QRCode = null;
  try {
    // eslint-disable-next-line global-require
    QRCode = require('react-native-qrcode-svg').default;
  } catch (_) { /* native dep absent — show fallback */ }
  // PR P.3 — Cancel reuses the same dismissal channel as the success
  // path (onAgentOAuthComplete with ok:false) so useAgentInlineCards
  // drops the card via its existing matcher.  Single dismissal pipe.
  const onCancel = useCallback(() => {
    if (channelType) {
      DeviceEventEmitter.emit('onAgentOAuthComplete', {
        channel_type: channelType, ok: false, message: 'cancelled',
      });
    }
  }, [channelType]);
  return (
    <View style={styles.card}>
      <View style={[styles.cardBody, { alignItems: 'center' }]}>
        <Text style={styles.title}>{title}</Text>
        <View
          style={{
            marginTop: 12,
            backgroundColor: '#FFFFFF',
            padding: 16,
            borderRadius: 12,
          }}
        >
          {QRCode && qr ? (
            <QRCode value={qr} size={220} />
          ) : (
            <Text
              style={{
                color: '#888',
                fontSize: 12,
                width: 220,
                height: 220,
                textAlign: 'center',
                textAlignVertical: 'center',
              }}
            >
              {qr ? 'QR renderer unavailable' : 'Generating QR…'}
            </Text>
          )}
        </View>
        <Text style={[styles.desc, { marginTop: 14, textAlign: 'center' }]}>
          {help}
        </Text>
        {channelType ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cancel pairing"
            style={styles.btnSecondary}
            onPress={onCancel}
          >
            <Text style={styles.btnSecondaryText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ---- OAuth click-through card (channel onboarding via OAuth 2.0) ----
//
// Driven by HARTOS's `agent_ui_update({type: 'oauth_link', url, channel_type,
// display_name, color, icon, external_url, cta_label})` emitted from
// _handle_connect_channel_tool when the operator has set
// HARTOS_OAUTH_CLIENT_<TYPE>.  Tap → Linking.openURL() opens the
// authorize URL in the OS browser.  After provider consent, browser
// lands on /api/oauth/<type>/callback close-page which posts
// {oauth_complete} back; our deepLinkService re-emits as
// DeviceEventEmitter('onAgentOAuthComplete') and the parent hook
// auto-removes this card.  Single populator into register_channel —
// same binding-write path the paste form goes through (no parallel
// infra).
function OAuthLinkCard({ data }) {
  const url = (data && data.url) || '';
  const channelType = (data && data.channel_type) || '';
  const displayName = (data && data.display_name) || channelType || 'provider';
  const color = (data && data.color) || COLORS.accent;
  const ctaLabel = (data && data.cta_label) || `Connect with ${displayName}`;
  const externalUrl = data && data.external_url;
  const onConnect = useCallback(() => {
    if (url) Linking.openURL(url).catch(() => {});
  }, [url]);
  const onOpenPortal = useCallback(() => {
    if (externalUrl) Linking.openURL(externalUrl).catch(() => {});
  }, [externalUrl]);
  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.title}>{`Connect ${displayName}`}</Text>
        <Text style={styles.desc}>
          {`Sign in to ${displayName} to authorize this connection. `
            + 'A new browser tab will open. After you approve, the channel '
            + 'will be connected automatically.'}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          style={[
            styles.btnPrimary,
            { backgroundColor: color, alignSelf: 'stretch', alignItems: 'center' },
          ]}
          onPress={onConnect}
          disabled={!url}
        >
          <Text style={[styles.btnText, { color: '#FFFFFF' }]}>{ctaLabel}</Text>
        </TouchableOpacity>
        {externalUrl ? (
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel={`Open ${displayName} developer portal`}
            style={styles.btnSecondary}
            onPress={onOpenPortal}
          >
            <Text style={styles.btnSecondaryText}>
              {`Manage app at ${displayName}`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ---- Channel-health banner (PR Q) ----
//
// Driven by HARTOS's ``channel_unhealthy`` fleet command: when the
// server-side health watchdog detects a token expired / 401 / adapter
// disconnected, it emits a fleet command which fleetCommandHandler.js
// dispatches as an ``agent_ui_update({type: 'banner', ...})``.  Tap
// "Reconnect" → fires the existing ``reconnect_channel`` agent tool,
// which routes back through Connect_Channel's standard flow (form /
// QR / OAuth depending on the channel).  Single dismissal pipe with
// the rest of the channel-onboarding cards — taps the same
// ``onAgentOAuthComplete`` channel + the same useAgentInlineCards
// removal matcher, just on a different ``channel_type``.
function BannerCard({ data }) {
  const channelType = (data && (data.channel || data.channel_type)) || '';
  const severity = (data && data.severity) || 'warning';
  const text = (data && data.text) || `${channelType || 'A channel'} needs attention.`;
  const actionLabel = (data && (data.action_label || data.actionLabel)) || 'Reconnect';
  const action = (data && data.action) || (channelType ? `reconnect_channel:${channelType}` : '');
  const onAction = useCallback(() => {
    if (!action) return;
    // The action is "tool_name:arg" — emit onAgentRequest so the
    // chat layer kicks the named agent tool with the parsed arg.
    const [tool, arg] = String(action).split(':', 2);
    DeviceEventEmitter.emit('onAgentRequest', {
      text: arg ? `${tool} ${arg}` : tool,
      agent_action: tool,
      channel_type: arg || channelType,
    });
  }, [action, channelType]);
  const onDismiss = useCallback(() => {
    if (!channelType) return;
    // Share the OAuth-complete dismissal channel for visual unity —
    // useAgentInlineCards already matches on (oauth_link OR banner +
    // matching channel_type) when this card is built with that id.
    DeviceEventEmitter.emit('onAgentOAuthComplete', {
      channel_type: channelType, ok: false, message: 'dismissed',
    });
  }, [channelType]);
  // Colour cues per severity, matching the existing palette.
  const accent = severity === 'error' ? COLORS.error
                : severity === 'success' ? COLORS.success
                : COLORS.warning;
  return (
    <View
      style={[
        styles.card,
        { borderLeftWidth: 4, borderLeftColor: accent },
      ]}
    >
      <View style={styles.cardBody}>
        <Text style={[styles.title, { color: accent }]}>
          {channelType ? `${channelType.toUpperCase()} — ${severity}` : severity.toUpperCase()}
        </Text>
        <Text style={styles.desc}>{text}</Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 12,
          }}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Dismiss banner"
            style={[styles.btnSecondary, { marginRight: 8, marginTop: 0 }]}
            onPress={onDismiss}
          >
            <Text style={styles.btnSecondaryText}>Dismiss</Text>
          </TouchableOpacity>
          {action ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              style={[styles.btnPrimary, { backgroundColor: accent, marginTop: 0 }]}
              onPress={onAction}
            >
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                {actionLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ---- Toast (PR P.4) ----
//
// Lightweight one-line notification, no actions.  Driven by
// register_channel when an adapter probe fails post-registration:
// emits ``agent_ui_update({type: 'toast', severity, text, channel_type})``
// so the user sees actionable feedback in chat instead of having to
// hunt the Channels admin page for the error.  Auto-dismisses after
// 4s via the same onAgentOAuthComplete pipe BannerCard uses — keeps
// the inline-card dismissal contract uniform.
function ToastCard({ data }) {
  const channelType = (data && (data.channel || data.channel_type)) || '';
  const severity = (data && data.severity) || 'info';
  const text = (data && data.text) || '';
  const accent = severity === 'error' ? COLORS.error
                : severity === 'success' ? COLORS.success
                : severity === 'warning' ? COLORS.warning
                : COLORS.accent;
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    const id = setTimeout(() => {
      if (!mountedRef.current) return;
      if (channelType) {
        DeviceEventEmitter.emit('onAgentOAuthComplete', {
          channel_type: channelType, ok: severity !== 'error', message: text,
        });
      }
    }, 4000);
    return () => { mountedRef.current = false; clearTimeout(id); };
  }, [channelType, severity, text]);
  return (
    <View
      style={[
        styles.card,
        { borderLeftWidth: 4, borderLeftColor: accent, paddingVertical: 4 },
      ]}
    >
      <View style={styles.cardBody}>
        <Text style={[styles.desc, { color: accent }]}>{text}</Text>
      </View>
    </View>
  );
}

// ---- Generic fallback ----

function GenericCard({ data }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.title}>{data.title || data.type || 'Agent'}</Text>
        <Text style={styles.desc}>
          {data.content || data.message || JSON.stringify(data).substring(0, 200)}
        </Text>
      </View>
    </View>
  );
}

// ---- Network helper (best-effort POST) ----

function postAction(actionUrl, body) {
  try {
    // Attempt to resolve relative URLs against backend
    const url = actionUrl.startsWith('http')
      ? actionUrl
      : actionUrl; // Relative URL -- native module or fetch interceptor resolves
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).catch(() => {});
  } catch (e) {
    // Best-effort
  }
}

// ---- Styles ----

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 6,
    marginHorizontal: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cardBody: {
    padding: 14,
  },
  productImage: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  desc: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  rowEnd: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  rating: {
    fontSize: 13,
    color: COLORS.gold,
    marginLeft: 10,
  },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  btnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
  btnSecondary: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.surface,
  },
  btnSecondaryText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  listItemText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  listItemAccent: {
    fontSize: 13,
    color: COLORS.accent,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  totalText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  comparisonItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    minWidth: 130,
    alignItems: 'center',
  },
  comparisonName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  comparisonRating: {
    fontSize: 12,
    color: COLORS.gold,
    marginTop: 4,
  },
  comparisonPrice: {
    fontSize: 12,
    color: COLORS.accent,
    marginTop: 2,
  },
  winnerText: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '600',
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});

export default AgentInlineChatCard;
