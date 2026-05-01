/**
 * Unified Endpoint Resolver — local-first routing for all API calls.
 *
 * Priority: AsyncStorage override > Local HARTOS > LAN peer > Regional > Cloud
 *
 * All service files (chatApi, socialApi, vaultApi, etc.) use this instead
 * of hardcoding cloud URLs. Caches the resolved endpoint for 30s.
 *
 * Source tracking: every resolution returns { url, source } where source
 * is 'local' | 'lan' | 'regional' | 'cloud' for UI badges.
 */

import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLOUD_FALLBACK = 'https://azurekong.hertzai.com';
const CACHE_TTL_MS = 30_000; // 30 seconds

let _cached = null;     // { url, source, resolvedAt }
let _resolving = null;  // dedup concurrent calls

/**
 * Resolve the best API endpoint.
 * @returns {Promise<{url: string, source: string}>}
 */
export async function getApiBase() {
  // Return cache if fresh
  if (_cached && (Date.now() - _cached.resolvedAt) < CACHE_TTL_MS) {
    return { url: _cached.url, source: _cached.source };
  }

  // Dedup: if already resolving, wait for the same promise
  if (_resolving) return _resolving;

  _resolving = _doResolve();
  try {
    const result = await _resolving;
    return result;
  } finally {
    _resolving = null;
  }
}

async function _doResolve() {
  // 1. AsyncStorage override (developer/debug — highest priority)
  try {
    const override = await AsyncStorage.getItem('hevolve_api_base');
    if (override) {
      _cached = { url: override, source: 'override', resolvedAt: Date.now() };
      return { url: override, source: 'override' };
    }
  } catch (_) {}

  // 2. PeerLink — already handles local > LAN > regional > cloud ranking,
  //    health checks, and getBestPeer(). No need to duplicate any of that.
  try {
    const peer = await NativeModules.PeerLinkModule.getApiBase();
    if (peer && peer.url) {
      _cached = { url: peer.url, source: peer.source || 'lan', resolvedAt: Date.now() };
      return { url: peer.url, source: peer.source || 'lan' };
    }
  } catch (_) {
    // PeerLink not started yet or native module unavailable
  }

  // 3. Cloud fallback (PeerLink not available)
  _cached = { url: CLOUD_FALLBACK, source: 'cloud', resolvedAt: Date.now() };
  return { url: CLOUD_FALLBACK, source: 'cloud' };
}

/**
 * Get just the URL string (convenience).
 */
export async function getApiBaseUrl() {
  const { url } = await getApiBase();
  return url.replace(/\/+$/, '');
}

/**
 * Get the last resolved source without async call (for headers/badges).
 */
export function getLastSource() {
  return _cached?.source || null;
}

/**
 * Force re-resolve on next call (e.g. after network change).
 */
export function invalidateCache() {
  _cached = null;
}

export default { getApiBase, getApiBaseUrl, getLastSource, invalidateCache };
