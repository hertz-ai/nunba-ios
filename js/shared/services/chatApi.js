import { NativeModules } from 'react-native';
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

const getAccessToken = () =>
  new Promise((resolve, reject) => {
    try {
      NativeModules.OnboardingModule.getAccessToken((token) => {
        resolve(token);
      });
    } catch (err) {
      reject(err);
    }
  });

const getHeaders = async () => {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

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

  health: () => get('/backend/health'),
};

export default chatApi;
