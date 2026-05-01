import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configurable via AsyncStorage('hevolve_api_base'). Default: production.
let CHAT_BASE_URL = 'https://mailer.hertzai.com';
(async () => {
  try {
    const custom = await AsyncStorage.getItem('hevolve_api_base');
    if (custom) CHAT_BASE_URL = custom;
  } catch (_) {}
})();

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

const buildUrl = (path, params) => {
  let url = `${CHAT_BASE_URL}${path}`;
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
  const headers = await getHeaders();
  const url = buildUrl(path, params);
  const response = await fetch(url, { method: 'GET', headers });
  return response.json();
};

const post = async (path, body) => {
  const headers = await getHeaders();
  const url = buildUrl(path);
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
