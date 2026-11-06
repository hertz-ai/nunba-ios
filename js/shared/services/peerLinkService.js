/**
 * PeerLink Service — React Native interface to PeerLinkModule.
 *
 * Provides:
 * - Connection management (start, stop, connect to peer)
 * - Channel messaging (compute, dispatch, events, gossip)
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
  getStatus,
  getDiscoveredPeers,
  isReady,
  onPeerLinkStatus,
  onPeerLinkEvent,
  onHivemindResponse,
};
