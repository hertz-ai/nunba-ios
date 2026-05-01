import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from './endpointResolver';

// WebSocket URL — configurable via AsyncStorage, not routable through REST cascade
let VISION_WS_URL = 'ws://azurekong.hertzai.com:8000/video';
(async () => {
  try {
    const custom = await AsyncStorage.getItem('hevolve_vision_ws_url');
    if (custom) VISION_WS_URL = custom;
  } catch (_) {}
})();

export const getVisionWsUrl = () => VISION_WS_URL;

export const getVisionStatus = async () => {
  try {
    const base = await getApiBaseUrl();
    const response = await fetch(`${base}/api/vision/health`);
    return response.json();
  } catch (e) {
    return { error: e.message };
  }
};
