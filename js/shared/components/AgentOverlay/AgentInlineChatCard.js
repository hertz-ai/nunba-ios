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
    return () => sub.remove();
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
