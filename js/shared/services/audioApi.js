import AsyncStorage from '@react-native-async-storage/async-storage';

// WebSocket URL — configurable via AsyncStorage, not routable through REST cascade
let DIARIZATION_WS_URL = 'ws://azurekong.hertzai.com:8000/spkdn';
(async () => {
  try {
    const custom = await AsyncStorage.getItem('hevolve_diarization_ws_url');
    if (custom) DIARIZATION_WS_URL = custom;
  } catch (_) {}
})();

export const getDiarizationWsUrl = () => DIARIZATION_WS_URL;
