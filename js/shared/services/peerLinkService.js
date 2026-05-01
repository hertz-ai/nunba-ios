/**
 * PeerLink Service — React Native interface to PeerLinkModule.
 *
 * Provides:
 * - Connection management (start, stop, connect to peer)
 * - Channel messaging (compute, dispatch, events, gossip)
 * - Agent dispatch (conversation, recipe, fleet, learning)
 * - Status monitoring
 *
 * PeerLink replaces Crossbar for LAN connections and provides
 * direct WebSocket to HARTOS with multiplexed channels.
 */
import { NativeModules, NativeEventEmitter, DeviceEventEmitter } from 'react-native';

const { PeerLinkModule } = NativeModules;

let isInitialized = false;
let statusListeners = [];

/**
 * Start PeerLink discovery and connection.
 * Call this once during app initialization (App.js).
 */
export async function startPeerLink() {
  if (!PeerLinkModule) {
    console.warn('PeerLinkModule not available');
    return false;
  }
  try {
    const result = await PeerLinkModule.start();
    isInitialized = true;
    return result;
  } catch (e) {
    console.warn('PeerLink start failed:', e.message);
    return false;
  }
}

/**
 * Stop PeerLink.
 */
export async function stopPeerLink() {
  if (!PeerLinkModule) return;
  try {
    await PeerLinkModule.stop();
    isInitialized = false;
  } catch (e) {
    console.warn('PeerLink stop failed:', e.message);
  }
}

/**
 * Connect to a specific HARTOS peer by address.
 */
export async function connectToPeer(address, port = 5460) {
  if (!PeerLinkModule) return false;
  try {
    return await PeerLinkModule.connectToPeer(address, port);
  } catch (e) {
    console.warn('PeerLink connect failed:', e.message);
    return false;
  }
}

/**
 * Send a message on a specific PeerLink channel.
 * @param {string} channel - Channel name (compute, dispatch, events, gossip, etc.)
 * @param {object} data - JSON data to send
 */
export async function sendOnChannel(channel, data) {
  if (!PeerLinkModule) return false;
  try {
    return await PeerLinkModule.send(channel, JSON.stringify(data));
  } catch (e) {
    console.warn(`PeerLink send on ${channel} failed:`, e.message);
    return false;
  }
}

/**
 * Send a chat message via PeerLink compute channel.
 * Falls back to existing WAMP if PeerLink unavailable.
 */
export async function sendChat(message, userId) {
  if (!PeerLinkModule) return false;
  try {
    return await PeerLinkModule.sendChat(message, userId);
  } catch (e) {
    console.warn('PeerLink chat failed:', e.message);
    return false;
  }
}

/**
 * Send a voice query via PeerLink compute channel.
 */
export async function sendVoiceQuery(text, userId) {
  if (!PeerLinkModule) return false;
  try {
    return await PeerLinkModule.sendVoiceQuery(text, userId);
  } catch (e) {
    console.warn('PeerLink voice query failed:', e.message);
    return false;
  }
}

/**
 * Dispatch an agent task (conversation, recipe, fleet, learning).
 * @param {string} agentType - Agent type: "conversation", "recipe", "fleet", "learning"
 * @param {object} input - Agent input data
 */
export async function runAgent(agentType, input) {
  if (!PeerLinkModule) return null;
  try {
    const result = await PeerLinkModule.runAgent(agentType, JSON.stringify(input));
    return typeof result === 'string' ? JSON.parse(result) : result;
  } catch (e) {
    console.warn(`Agent ${agentType} failed:`, e.message);
    return { error: e.message };
  }
}

/**
 * Dispatch a fleet/agent command.
 */
export async function dispatchAgentTask(task) {
  if (!PeerLinkModule) return false;
  try {
    return await PeerLinkModule.dispatchAgentTask(JSON.stringify(task));
  } catch (e) {
    console.warn('Agent dispatch failed:', e.message);
    return false;
  }
}

/**
 * Get PeerLink connection status.
 */
export async function getStatus() {
  if (!PeerLinkModule) {
    return { isStarted: false, isConnected: false, isHandshakeComplete: false, currentUrl: '', discoveredPeers: 0 };
  }
  try {
    return await PeerLinkModule.getStatus();
  } catch (e) {
    return { isStarted: false, isConnected: false, error: e.message };
  }
}

/**
 * Get discovered HARTOS peers.
 */
export async function getDiscoveredPeers() {
  if (!PeerLinkModule) return [];
  try {
    return await PeerLinkModule.getDiscoveredPeers();
  } catch (e) {
    return [];
  }
}

/**
 * Check if PeerLink is ready (connected + handshake complete).
 */
export async function isReady() {
  if (!PeerLinkModule) return false;
  try {
    return await PeerLinkModule.isReady();
  } catch (e) {
    return false;
  }
}

// --- Event listeners ---

/**
 * Listen for PeerLink status changes.
 */
export function onPeerLinkStatus(callback) {
  return DeviceEventEmitter.addListener('onPeerLinkStatus', callback);
}

/**
 * Listen for agent responses (from PeerLink dispatch channel).
 */
export function onAgentResponse(callback) {
  return DeviceEventEmitter.addListener('onAgentResponse', callback);
}

/**
 * Listen for PeerLink events (generic).
 */
export function onPeerLinkEvent(callback) {
  return DeviceEventEmitter.addListener('onPeerLinkEvent', callback);
}

/**
 * Listen for HiveMind responses.
 */
export function onHivemindResponse(callback) {
  return DeviceEventEmitter.addListener('onHivemindResponse', callback);
}

export default {
  startPeerLink,
  stopPeerLink,
  connectToPeer,
  sendOnChannel,
  sendChat,
  sendVoiceQuery,
  runAgent,
  dispatchAgentTask,
  getStatus,
  getDiscoveredPeers,
  isReady,
  onPeerLinkStatus,
  onAgentResponse,
  onPeerLinkEvent,
  onHivemindResponse,
};
