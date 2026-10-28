import { NativeModules } from 'react-native';
import { getAuthHeaders, getUserId } from './apiHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import endpointResolver from './endpointResolver';

// #266 — Deploy-mode-aware base URL resolution.  Lazy per-request
// via endpointResolver (PeerLink local > LAN > regional > cloud,
// 30s in-memory cache).  Legacy AsyncStorage path preserved as
// fallback for the rare case the resolver is unavailable.
let CHAT_BASE_URL = 'https://mailer.hertzai.com';
(async () => {
  try {
    const custom = await AsyncStorage.getItem('hevolve_api_base');
    if (custom) CHAT_BASE_URL = custom;
  } catch (_) {}
})();

const _resolveChatBase = async () => {
  try {
    const base = await endpointResolver.getApiBaseUrl();
    if (base) return base;
  } catch (_) {
    // Fall through to legacy.
  }
  return CHAT_BASE_URL;
};

export const setBaseUrl = (custom) => {
  if (custom) CHAT_BASE_URL = custom;
};

const buildUrl = (path, params, base) => {
  let url = `${base}${path}`;
  if (params && Object.keys(params).length > 0) {
    const query = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    if (query) {
      url += `?${query}`;
    }
  }
  return url;
};

// Auth lives in services/apiHelpers.js — see the note in socialApi.js.
// getAuthHeaders carries the credential the resolved node can verify (#111).
const getHeaders = getAuthHeaders;

const get = async (path, params) => {
  const [headers, base] = await Promise.all([
    getHeaders(),
    _resolveChatBase(),
  ]);
  const url = buildUrl(path, params, base);
  const response = await fetch(url, { method: 'GET', headers });
  return response.json();
};

const post = async (path, body) => {
  const [headers, base] = await Promise.all([
    getHeaders(),
    _resolveChatBase(),
  ]);
  const url = buildUrl(path, undefined, base);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
};

export const chatApi = {
  chat: (data) => post('/chat', data),
  // data shape: { text, user_id, agent_id, agent_type, conversation_id, video_req, prompt_id, create_agent, autonomous_creation }

  getPrompts: (userId) => get('/prompts', { user_id: userId }),
  // returns: { prompts: [...], success: true }

  customGpt: (data) => post('/chat/custom_gpt', data),

  // List the user's custom bots (the "Your HevolveAI Agents" rail on
  // the Android Agents-tab — backed by HARTOS /getprompt_userid/ and
  // wired into the Java GetPromptListApi.getCustomChats).
  // Returns: array of { name, prompt, image_url, prompt_id, ... }
  getCustomBots: (userId) => get('/getprompt_userid/', { user_id: userId }),

  health: () => get('/backend/health'),
};

export default chatApi;
