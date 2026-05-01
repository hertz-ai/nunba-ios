/**
 * AgentOverlayBridge — Connects WAMP agent.ui.update events to
 * floating overlay rendering on Android.
 *
 * Two rendering modes:
 * 1. INLINE: Cards rendered inside chat RecyclerView (product_card, comparison, etc.)
 * 2. FLOATING: System-level overlay that works OVER ANY APP (like lyrics, PiP video)
 *    Uses Android TYPE_APPLICATION_OVERLAY via AgentOverlayService
 *
 * Events arrive via:
 * - WAMP subscription: com.hartos.event.agent.ui.update (via AutobahnConnectionManager)
 * - DeviceEventEmitter: 'onAgentUIUpdate' (bridged from Java native module)
 *
 * Component types rendered:
 * - product_card: image + name + price + rating + buy button
 * - cart: items list + total + checkout
 * - checkout: payment form
 * - payment_status: success/pending/error animation
 * - order_tracking: step progress
 * - comparison: side-by-side app comparison
 * - progress: progress bar
 * - agent_action: action status with icon
 * - notification: toast banner
 * - lyrics: floating lyrics display (same overlay system)
 */

import { NativeModules, NativeEventEmitter, DeviceEventEmitter, Platform } from 'react-native';

const { AgentOverlayModule } = NativeModules || {};

// ─── Event Listener ────────────────────────────────────────────

let _subscription = null;

/**
 * Start listening for agent UI update events.
 * Call this once at app startup (e.g., in App.js componentDidMount).
 */
export function startAgentOverlayListener() {
  if (_subscription) return; // Already listening

  _subscription = DeviceEventEmitter.addListener(
    'onAgentUIUpdate',
    (event) => {
      try {
        const component = typeof event === 'string' ? JSON.parse(event) : event;
        handleAgentUIUpdate(component);
      } catch (e) {
        console.warn('AgentOverlay: failed to parse event', e);
      }
    }
  );

  console.log('AgentOverlay: listener started');
}

/**
 * Stop listening for agent UI update events.
 */
export function stopAgentOverlayListener() {
  if (_subscription) {
    _subscription.remove();
    _subscription = null;
  }
}

// ─── Component Handler ─────────────────────────────────────────

/**
 * Route an agent UI component to the appropriate renderer.
 *
 * @param {Object} component - The component from HARTOS agent_ui_update
 *   {type, _agent_id, _ts, ...props}
 */
function handleAgentUIUpdate(component) {
  const type = component.type || 'notification';
  const agentId = component._agent_id || component.agent_id || 'agent';

  // Determine rendering mode: floating overlay vs inline chat
  const FLOATING_TYPES = new Set([
    'notification', 'progress', 'agent_action', 'payment_status',
    'lyrics', 'order_tracking', 'approval', 'metric', 'code',
    'markdown', 'media', 'chart', 'list',
  ]);
  const INLINE_TYPES = new Set([
    'product_card', 'cart', 'checkout', 'comparison', 'form',
  ]);
  const NAVIGATE_TYPES = new Set(['navigate']);

  if (NAVIGATE_TYPES.has(type)) {
    // Emit navigation event for React Native navigation handler
    DeviceEventEmitter.emit('onAgentNavigate', {
      target: component.target || '',
      params: component.params || {},
      transition: component.transition || 'default',
      title: component.title || component.target || '',
      _agent_id: agentId,
      _ts: component._ts,
    });
    // Also show brief floating notification
    showFloatingOverlay({
      type: 'notification',
      title: agentId,
      message: 'Navigating to ' + (component.title || component.target || '...'),
      severity: 'info',
      _ts: component._ts,
    });
  } else if (FLOATING_TYPES.has(type)) {
    showFloatingOverlay(component);
  } else if (INLINE_TYPES.has(type)) {
    // Emit to chat view for inline rendering
    DeviceEventEmitter.emit('onAgentInlineChatCard', component);
    // Also show a brief floating notification
    showFloatingOverlay({
      type: 'notification',
      title: agentId,
      message: getComponentSummary(component),
      severity: 'info',
      _ts: component._ts,
    });
  } else {
    // Default: floating overlay
    showFloatingOverlay(component);
  }
}

// ─── Floating Overlay (System-level, works over ANY app) ──────

/**
 * Show a floating overlay using Android's TYPE_APPLICATION_OVERLAY.
 * Same system as floating video/lyrics — works while using any other app.
 *
 * @param {Object} component - The UI component to render
 */
function showFloatingOverlay(component) {
  if (Platform.OS !== 'android') {
    // iOS: use in-app overlay (no system-level float without jailbreak)
    DeviceEventEmitter.emit('onAgentOverlayIOS', component);
    return;
  }

  // Use native module to show Android system overlay
  if (AgentOverlayModule && AgentOverlayModule.showOverlay) {
    AgentOverlayModule.showOverlay(JSON.stringify(component));
  } else {
    // Fallback: emit as in-app event for React Native rendering
    DeviceEventEmitter.emit('onAgentFloatingFallback', component);
  }
}

/**
 * Dismiss the current floating overlay.
 */
export function dismissFloatingOverlay() {
  if (Platform.OS === 'android' && AgentOverlayModule && AgentOverlayModule.dismissOverlay) {
    AgentOverlayModule.dismissOverlay();
  }
}

/**
 * Check if overlay permission is granted (Android SYSTEM_ALERT_WINDOW).
 */
export async function checkOverlayPermission() {
  if (Platform.OS !== 'android') return true;
  if (AgentOverlayModule && AgentOverlayModule.hasOverlayPermission) {
    return await AgentOverlayModule.hasOverlayPermission();
  }
  return false;
}

/**
 * Request overlay permission (opens Android settings).
 */
export function requestOverlayPermission() {
  if (Platform.OS === 'android' && AgentOverlayModule && AgentOverlayModule.requestOverlayPermission) {
    AgentOverlayModule.requestOverlayPermission();
  }
}

// ─── Component Summary (for notifications) ─────────────────────

function getComponentSummary(component) {
  const type = component.type || '';
  switch (type) {
    case 'product_card':
      return `${component.name || 'Product'} — ${component.price || 'Free'}`;
    case 'cart':
      return `Cart: ${(component.items || []).length} items, ${component.total || 0} ${component.currency || 'Spark'}`;
    case 'checkout':
      return `Checkout: ${component.total || 0} ${component.currency || 'Spark'}`;
    case 'comparison':
      return `Comparing ${(component.apps || []).length} apps`;
    case 'payment_status':
      return `Payment ${component.status || 'pending'}`;
    case 'order_tracking':
      return `Order ${component.order_id || ''}: ${component.status || ''}`;
    case 'agent_action':
      return component.description || component.action_type || 'Working...';
    case 'approval':
      return `Approval: ${component.description || component.action || 'pending'}`;
    case 'chart':
      return `Chart: ${component.title || 'data'}`;
    case 'code':
      return `Code: ${component.filename || component.language || 'snippet'}`;
    case 'markdown':
      return (component.content || '').substring(0, 80);
    case 'media':
      return `Media: ${component.alt || component.title || component.media_type || 'content'}`;
    case 'metric':
      return `${component.label || 'Metric'}: ${component.value || 0}${component.unit || ''}`;
    case 'form':
      return `Form: ${component.title || 'input needed'}`;
    case 'list':
      return `List: ${(component.items || []).length} items`;
    case 'navigate':
      return `Navigate: ${component.title || component.target || ''}`;
    default:
      return component.message || component.content || component.title || type;
  }
}

// ─── Process chat response for ui_components (fallback path) ──────

/**
 * Fallback: if a chat response includes ui_components in the HTTP JSON
 * (e.g., from a non-native HTTP client), route them through the same
 * handleAgentUIUpdate adapter.
 *
 * NOTE: When using the native Android app, the local 0.8B model emits
 * directly via DeviceEventEmitter('onAgentUIUpdate') — same path as
 * WAMP server events. This function is only needed for pure HTTP callers
 * that don't go through the native bridge (e.g., web, curl, tests).
 *
 * The adapter (handleAgentUIUpdate) is source-agnostic. It doesn't know
 * or care whether the component came from server WAMP, local 0.8B,
 * peer node, or this fallback function.
 */
export function processChatResponseUI(chatResponse) {
  if (!chatResponse) return;
  const components = chatResponse.ui_components;
  if (!components || !Array.isArray(components) || components.length === 0) return;

  const agentId = chatResponse.agent_id || chatResponse.source || 'local';
  components.forEach((comp) => {
    if (comp && comp.type) {
      comp._agent_id = comp._agent_id || agentId;
      comp._ts = comp._ts || Date.now() / 1000;
      handleAgentUIUpdate(comp);
    }
  });
}

// ─── Export for use in chat view ────────────────────────────────

export { handleAgentUIUpdate, getComponentSummary };
