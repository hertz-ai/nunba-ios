import AsyncStorage from '@react-native-async-storage/async-storage';

// WebSocket URL — configurable via AsyncStorage.
//
// #266 note: deliberately NOT routed through endpointResolver.
// The diarization service is cloud-only (no local HARTOS or LAN
// equivalent), and endpointResolver returns HTTP bases (`https://`)
// not WebSocket URLs.  Override via the
// `hevolve_diarization_ws_url` AsyncStorage key when self-hosting.
let DIARIZATION_WS_URL = 'ws://azurekong.hertzai.com:8000/spkdn';
(async () => {
  try {
    const custom = await AsyncStorage.getItem('hevolve_diarization_ws_url');
    if (custom) DIARIZATION_WS_URL = custom;
  } catch (_) {}
})();

export const getDiarizationWsUrl = () => DIARIZATION_WS_URL;
