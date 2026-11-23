// The optional LiveKit SDK, loaded lazily so the call screen still works in
// builds without the native pod (and in jest, where the real package is
// untransformed source).  Each export is null when the SDK is unavailable.
let sdk = null;
try {
  // eslint-disable-next-line global-require
  sdk = require('@livekit/react-native');
} catch (_) {
  // No LiveKit pod: callers degrade to the REST roster.
}

export const LiveKitRoom = sdk?.LiveKitRoom || null;
export const Room = sdk?.Room || null;
export const RoomEvent = sdk?.RoomEvent || null;
export const Track = sdk?.Track || null;
