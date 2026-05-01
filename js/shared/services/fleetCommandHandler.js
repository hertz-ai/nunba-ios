/**
 * Fleet Command Handler — Cross-Device Agent Communication
 *
 * Listens for fleet commands via:
 *   1. WAMP subscription (real-time, when connected)
 *   2. FCM data message (background delivery)
 *   3. Polling fallback (every 30s when WAMP disconnected)
 *
 * Dispatches tts_stream and agent_consent commands to appropriate handlers.
 *
 * Usage:
 *   import { initFleetCommandHandler, stopFleetCommandHandler } from './fleetCommandHandler';
 *   initFleetCommandHandler();  // Call once in App.js after device registration
 */

import { DeviceEventEmitter, NativeModules, AppState } from 'react-native';
import useFleetCommandStore from '../fleetCommandStore';
import useDeviceCapabilityStore from '../deviceCapabilityStore';
import useLiquidOverlayStore from '../liquidOverlayStore';
import { ackFleetCommand, pollFleetCommands } from './deviceApi';
import deepLinkService from './deepLinkService';

const { WearDataSyncModule } = NativeModules;

let fleetListener = null;
let pollInterval = null;
let appStateListener = null;
let initialized = false;

const POLL_INTERVAL_MS = 30000;

// ── TTS Handler ──

const handleTTSStream = async (params, commandId) => {
  const { text, voice, lang, relay_to_device_id, agent_id } = params;
  if (!text) return;

  const store = useFleetCommandStore.getState();
  store.setActiveTTS({ commandId, text, voice, lang, agentId: agent_id });

  try {
    // Play locally on this device
    const TTSManager = require(
      '../components/CommunityView/components/KidsLearning/shared/TTSManager'
    ).default;
    await TTSManager.speak(text, { voice: voice || 'default' });

    // If relay requested, send audio to watch via Data Layer
    if (relay_to_device_id && WearDataSyncModule) {
      try {
        const { kidsMediaApi } = require('./kidsMediaApi');
        const result = await kidsMediaApi.quickTTS({
          text,
          voice: voice || 'default',
          engine: 'pocket_tts',
        });
        if (result && result.audio_base64) {
          await WearDataSyncModule.relayTTSAudio(
            text,
            result.audio_base64,
            agent_id || '',
          );
        }
      } catch (relayErr) {
        console.warn('FleetCommand: TTS relay to watch failed:', relayErr);
      }
    }

    if (commandId) {
      ackFleetCommand(commandId, true, 'played').catch(() => {});
    }
  } catch (err) {
    console.warn('FleetCommand: TTS playback failed:', err);
    if (commandId) {
      ackFleetCommand(commandId, false, err.message || 'playback_failed').catch(() => {});
    }
  } finally {
    store.clearTTS();
  }
};

// ── Consent Handler ──

const handleAgentConsent = async (params, commandId) => {
  const { action, agent_id, description, timeout_s } = params;
  if (!action) return;

  const store = useFleetCommandStore.getState();
  store.addConsent({
    commandId,
    action,
    agentId: agent_id || '',
    description: description || '',
    timeoutS: timeout_s || 60,
  });

  // Also relay consent to watch if WearDataSyncModule is available
  if (WearDataSyncModule) {
    try {
      await WearDataSyncModule.relayConsentRequest(
        action,
        agent_id || '',
        description || '',
        timeout_s || 60,
      );
    } catch (err) {
      console.warn('FleetCommand: consent relay to watch failed:', err);
    }
  }
};

// ── Agentic UI Handlers ──
//
// ANY HARTOS agent (speech therapy, marketing, learning, recipe, fleet, etc.)
// can publish fleet.command with cmd_type: ui_navigate | ui_overlay_show |
// ui_overlay_dismiss to drive the phone UI.
//
// Single responsibility: each handler delegates to the sole owner of that
// UI concern — deepLinkService for navigation, liquidOverlayStore for overlays.
// No parallel paths, no duplicated state.
//
// NOT for consent flows: use cmd_type 'agent_consent' instead. The consent
// path has countdown/auto-deny/TV D-pad support that the generic overlay
// lacks. See AgentConsentOverlay.js.

// Screen allowlist for ui_navigate — agents can only navigate to curated
// screens, never to admin/internal/modal-blocking screens. Any screen in
// deepLinkService.RESOURCE_ROUTE_MAP is automatically allowed; add others
// here explicitly.
const NAVIGATION_EXTRA_ALLOWED = new Set([
  // Top-level feature screens (reachable from NavPills)
  'GameHub', 'KidsHub', 'Encounters', 'ResonanceDashboard', 'Achievements',
  'Challenges', 'Experiments', 'ExperimentDiscovery', 'Campaigns',
  'Regions', 'Communities', 'Notifications', 'Search', 'Profile',
  // Detail screens (also reachable from resource routes)
  'PostDetail', 'CommunityDetail', 'RecipeDetail', 'ChallengeDetail',
  'CampaignDetail', 'RegionDetail', 'AgentHiveDetail', 'Season',
  // Kids/game flows
  'KidsGame', 'GameCreator', 'CustomGames', 'KidsProgress',
  // Social + agent
  'AgentHive', 'AgentEvolution', 'Recipes', 'Tasks', 'CodingAgent',
  'Mindstory', 'FederatedFeed', 'AllFeatures',
  'ChannelBindings', 'ChannelSetup', 'ConversationHistory',
]);

const isScreenAllowed = (screen) => {
  if (!screen) return false;
  if (NAVIGATION_EXTRA_ALLOWED.has(screen)) return true;
  // Also accept screens from deepLinkService's resource map (PostDetail, etc.)
  try {
    const { RESOURCE_ROUTE_MAP } = require('./deepLinkService');
    if (RESOURCE_ROUTE_MAP) {
      for (const key of Object.keys(RESOURCE_ROUTE_MAP)) {
        if (RESOURCE_ROUTE_MAP[key]?.screen === screen) return true;
      }
    }
  } catch (_) {}
  return false;
};

const handleUINavigate = async (params, commandId) => {
  const { screen, params: screenParams } = params;
  if (!screen) {
    if (commandId) ackFleetCommand(commandId, false, 'missing screen').catch(() => {});
    return;
  }
  if (!isScreenAllowed(screen)) {
    if (commandId) ackFleetCommand(commandId, false, `screen_not_allowed:${screen}`).catch(() => {});
    console.warn('FleetCommand: ui_navigate rejected — screen not in allowlist:', screen);
    return;
  }
  try {
    if (!deepLinkService.isNavigationReady()) {
      throw new Error('Navigation not ready');
    }
    const result = deepLinkService.navigate(screen, screenParams || {});
    if (result.error) throw new Error(result.error);
    if (commandId) ackFleetCommand(commandId, true, `navigated:${screen}`).catch(() => {});
  } catch (err) {
    console.warn('FleetCommand: ui_navigate failed:', err.message);
    if (commandId) ackFleetCommand(commandId, false, err.message).catch(() => {});
  }
};

const handleUIOverlayShow = async (params, commandId) => {
  const { layout, data, agent_name } = params;
  if (!layout || typeof layout !== 'object' || Array.isArray(layout) || !layout.type) {
    if (commandId) ackFleetCommand(commandId, false, 'invalid layout (must be object with type)').catch(() => {});
    return;
  }
  // LiquidOverlay is not mounted on TV — agents targeting TV should use
  // ui_navigate to a dedicated screen instead of showing an overlay.
  try {
    const { deviceType } = useDeviceCapabilityStore.getState();
    if (deviceType === 'tv') {
      if (commandId) ackFleetCommand(commandId, false, 'overlay_not_supported_on_tv').catch(() => {});
      return;
    }
  } catch (_) {
    // If deviceType can't be determined, allow the overlay (default to phone)
  }
  try {
    useLiquidOverlayStore.getState().show(layout, data || {}, agent_name || 'Agent');
    if (commandId) ackFleetCommand(commandId, true, 'overlay_shown').catch(() => {});
  } catch (err) {
    console.warn('FleetCommand: ui_overlay_show failed:', err.message);
    if (commandId) ackFleetCommand(commandId, false, err.message).catch(() => {});
  }
};

const handleUIOverlayDismiss = async (params, commandId) => {
  try {
    useLiquidOverlayStore.getState().dismiss();
    if (commandId) ackFleetCommand(commandId, true, 'overlay_dismissed').catch(() => {});
  } catch (err) {
    console.warn('FleetCommand: ui_overlay_dismiss failed:', err.message);
    if (commandId) ackFleetCommand(commandId, false, err.message).catch(() => {});
  }
};

// ── Command Dispatcher ──
//
// Registry-based: every cmd_type maps to exactly one handler.
// Adding a new cmd_type is a single line here — no switch statement.
// Exported for test injection.

export const COMMAND_HANDLERS = {
  tts_stream: handleTTSStream,
  agent_consent: handleAgentConsent,
  ui_navigate: handleUINavigate,
  ui_overlay_show: handleUIOverlayShow,
  ui_overlay_dismiss: handleUIOverlayDismiss,
};

const dispatchCommand = (data) => {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const cmdType = parsed.cmd_type;
    const params = parsed.params || parsed;
    const commandId = parsed.id || parsed.command_id || '';

    const store = useFleetCommandStore.getState();
    store.addToHistory({ cmdType, commandId, params, receivedAt: Date.now() });

    const handler = COMMAND_HANDLERS[cmdType];
    if (handler) {
      handler(params, commandId);
    } else {
      console.warn('FleetCommand: unknown command type:', cmdType);
    }
  } catch (err) {
    console.warn('FleetCommand: dispatch error:', err);
  }
};

// ── Polling Fallback ──

const startPolling = () => {
  stopPolling();
  pollInterval = setInterval(async () => {
    const deviceId = useDeviceCapabilityStore.getState().deviceId;
    if (!deviceId) return;

    try {
      const result = await pollFleetCommands(deviceId);
      if (result && result.success && Array.isArray(result.data)) {
        result.data.forEach(dispatchCommand);
      }
    } catch (err) {
      // Silent — polling is best-effort
    }
  }, POLL_INTERVAL_MS);
};

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

// ── Lifecycle ──

export const initFleetCommandHandler = () => {
  if (initialized) return;
  initialized = true;

  // Listen for fleet commands from native (WAMP + FCM)
  fleetListener = DeviceEventEmitter.addListener('fleetCommand', (event) => {
    const data = event && event.data ? event.data : event;
    dispatchCommand(data);
  });

  // Start polling as fallback
  startPolling();

  // Pause polling when app is backgrounded, resume when foregrounded
  appStateListener = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      startPolling();
    } else {
      stopPolling();
    }
  });
};

export const stopFleetCommandHandler = () => {
  if (fleetListener) {
    fleetListener.remove();
    fleetListener = null;
  }
  stopPolling();
  if (appStateListener) {
    appStateListener.remove();
    appStateListener = null;
  }
  initialized = false;
};
