/**
 * CallChannelScreen — Phase 7d.B voice/video/screen-share UI.
 *
 * Plan reference: sunny-gliding-eich.md, Part F.11 + Part D.6.
 *
 * Two transports per Plan R.6:
 *   - mode='livekit' / 'livekit_pending'  → connect to the LiveKit
 *     SFU via @livekit/react-native (when token is signed) or render
 *     "infra not ready" banner (when SDK installed server-side but
 *     not yet wiring real frames — pending).
 *   - mode='p2p_mesh'  → flat / regional / Nunba bundled deploy,
 *     small group; the client opens direct WebRTC peer connections
 *     signaled over PeerLink.  React Native side TODO.
 *
 * For this iteration we ship the surface (route param wiring + UI
 * shell + token fetch + mute/leave/end controls) and rely on a
 * lazy `require('@livekit/react-native')` so the screen is importable
 * even when the LiveKit pod isn't installed — degrades gracefully
 * to a "this build doesn't have LiveKit; running in P2P mesh mode"
 * message.
 *
 * Native deps (added when ready):
 *   - iOS:  pod 'LiveKitClient' + react-native-webrtc + Broadcast
 *           Upload Extension target for screen share (Plan G.4).
 *   - Android: io.livekit:livekit-android + react-native-webrtc +
 *           CallForegroundService + MediaProjectionPermissionActivity
 *           (Plan H.2-H.4).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, ActivityIndicator, Alert,
  // NativeModules + DeviceEventEmitter are pulled with optional access
  // because the jest mock of `react-native` doesn't define them — the
  // `NativeModules?.CallNative` chain returns null in tests but the
  // real module on device.
  NativeModules,
  DeviceEventEmitter,
  Platform,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { callsApi } from '../../../services/socialApi';

// Lazy-load LiveKit so the screen works in builds without the pod.
let LiveKitRoom = null;
let LKRoom = null;
let LKRoomEvent = null;
let LKTrack = null;
try {
  // eslint-disable-next-line global-require
  const livekit = require('@livekit/react-native');
  LiveKitRoom  = livekit?.LiveKitRoom  || null;
  LKRoom       = livekit?.Room         || null;
  LKRoomEvent  = livekit?.RoomEvent    || null;
  LKTrack      = livekit?.Track        || null;
} catch (_) {
  // No LiveKit pod — degrade gracefully (tests + dev builds without pods).
}

// Native bridge for the Phase-7d foreground service + screen-capture
// permission relay (CallNativeModule.java).  Optional-chain so the jest
// mock of react-native (no NativeModules key) returns null cleanly.
const CallNative = NativeModules && NativeModules.CallNative
  ? NativeModules.CallNative
  : null;

// iOS CallKit bridge.  Same optional-chain pattern.
const CallKitBridge = NativeModules && NativeModules.CallKitBridge
  ? NativeModules.CallKitBridge
  : null;

// Watch sync bridge for relaying call-state mirror back to paired
// Wear OS watches when phone-side toggles flip mute/video.
const WearDataSyncModule = NativeModules && NativeModules.WearDataSyncModule
  ? NativeModules.WearDataSyncModule
  : null;

const CallChannelScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { call_id, parent_kind, parent_id, kind = 'voice' } = route.params || {};

  const [token, setToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);
  const [mode, setMode] = useState(null);  // 'livekit'|'livekit_pending'|'p2p_mesh'
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(kind === 'video');
  const [screenSharing, setScreenSharing] = useState(false);
  const ended = useRef(false);
  // Live LiveKit Room reference + foreground-service state.  Held in
  // refs (not state) because they're imperative side-effects, not
  // render-driving values, and we don't want toggles to re-create them.
  const roomRef = useRef(null);
  const fgsActive = useRef(false);
  const screenCaptureSubRef = useRef(null);

  // ── Token fetch + roster ─────────────────────────────────────────

  useEffect(() => {
    if (!call_id) {
      Alert.alert('Missing call', 'No call id was provided.');
      navigation.goBack();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Fetch token + initial roster in parallel.
        const [tokenRes, callRes] = await Promise.all([
          callsApi.token(call_id, {
            can_publish: true,
            can_publish_screen: kind === 'screen_share',
          }),
          callsApi.get(call_id),
        ]);
        if (cancelled) return;
        const tokenData = tokenRes?.data || tokenRes;
        const callData = callRes?.data || callRes;
        setToken(tokenData?.token || null);
        setLivekitUrl(tokenData?.url || null);
        setMode(tokenData?.mode || 'p2p_mesh');
        setParticipants(callData?.participants || []);
        // Fire join bookkeeping (idempotent on server).
        try { await callsApi.join(call_id, { device_kind: 'mobile' }); } catch (_) {}
      } catch (e) {
        Alert.alert('Could not join call',
          e?.error || e?.message || 'Try again later.');
        navigation.goBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [call_id, kind, navigation]);

  // ── Cleanup: leave on unmount ────────────────────────────────────

  useEffect(() => () => {
    if (call_id && !ended.current) {
      callsApi.leave(call_id).catch(() => {});
    }
    // iOS: end any orphan CallKit session bound to this call_id so
    // the user doesn't see "active call" lingering in the system
    // Phone app's recents after they hang up via in-app UI.  The
    // bridge resolves false (not reject) when no session exists,
    // so this is safe even if the user joined directly without a
    // CallKit ringer.
    if (Platform && Platform.OS === 'ios' && CallKitBridge
        && typeof CallKitBridge.endCallByCallId === 'function' && call_id) {
      try { CallKitBridge.endCallByCallId(String(call_id)).catch(() => {}); }
      catch (_) {}
    }
    // Android: clear watch mirror so the user lands back on Home on
    // their wrist instead of staring at stale call controls.
    if (Platform && Platform.OS === 'android' && WearDataSyncModule
        && typeof WearDataSyncModule.clearCallState === 'function') {
      try { WearDataSyncModule.clearCallState().catch(() => {}); } catch (_) {}
    }
  }, [call_id]);

  // ── Foreground service + LiveKit Room lifecycle ───────────────────
  //
  // When mode='livekit' AND we have a token AND the SDK is installed,
  // open a real Room on top of the existing UI.  Roster is updated
  // from the live SDK events on top of the REST snapshot — REST stays
  // the source of truth for user_id / agent_kind / device_kind, the
  // SDK adds is_muted / is_speaking deltas.
  //
  // We also start the Android foreground service so the call survives
  // backgrounding without the OS killing the audio capture.

  useEffect(() => {
    if (mode !== 'livekit' || !token || !livekitUrl) return undefined;

    let cancelled = false;
    let room = null;

    // 1. Start foreground service (Android only — CallNative no-ops on iOS).
    if (CallNative && typeof CallNative.startCallForegroundService === 'function') {
      try {
        CallNative.startCallForegroundService(
          String(call_id || 'active'),
          String(kind || 'voice'),
          /* includeCamera */ kind === 'video',
          /* includeScreen */ false,
        );
        fgsActive.current = true;
      } catch (_) {
        // Foreground-service start failed — call still works while in
        // foreground, just won't survive backgrounding cleanly.
      }
    }

    // 2. Connect a Room when the SDK is present and Room class is exported.
    if (LKRoom && LKRoomEvent) {
      try {
        room = new LKRoom({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const onParticipantChange = () => {
          if (cancelled || !room) return;
          // Build a delta from live participants (sid → {is_muted,is_speaking}).
          const live = {};
          try {
            const all = [...(room.remoteParticipants?.values?.() || [])];
            for (const p of all) {
              const audioTrack = (p.audioTrackPublications &&
                [...p.audioTrackPublications.values()][0]) || null;
              live[p.identity || p.sid] = {
                is_muted: audioTrack ? Boolean(audioTrack.isMuted) : false,
                is_speaking: Boolean(p.isSpeaking),
              };
            }
            // Local participant too — so the user sees their own mute
            // state reflected immediately.
            const lp = room.localParticipant;
            if (lp) {
              const audioTrack = (lp.audioTrackPublications &&
                [...lp.audioTrackPublications.values()][0]) || null;
              live[lp.identity || lp.sid] = {
                is_muted: audioTrack ? Boolean(audioTrack.isMuted) : muted,
                is_speaking: Boolean(lp.isSpeaking),
              };
            }
          } catch (_) { /* best effort */ }
          // Merge onto existing roster keyed by user_id / id.
          setParticipants((prev) => prev.map((p) => {
            const k = p.user_id || p.id;
            const delta = live[k];
            return delta ? { ...p, ...delta } : p;
          }));
        };

        room.on(LKRoomEvent.ParticipantConnected, onParticipantChange);
        room.on(LKRoomEvent.ParticipantDisconnected, onParticipantChange);
        room.on(LKRoomEvent.TrackMuted, onParticipantChange);
        room.on(LKRoomEvent.TrackUnmuted, onParticipantChange);
        room.on(LKRoomEvent.ActiveSpeakersChanged, onParticipantChange);

        room.connect(livekitUrl, token, { autoSubscribe: true })
          .then(() => {
            if (cancelled || !room) return;
            // Initial publish state — mic on, camera matches the user's
            // chosen mode.  Tests don't reach this path because
            // LKRoom is null in jest, so this is production-only.
            const lp = room.localParticipant;
            if (lp) {
              try { lp.setMicrophoneEnabled(!muted); } catch (_) {}
              try { lp.setCameraEnabled(videoOn && kind !== 'voice'); } catch (_) {}
            }
            onParticipantChange();
          })
          .catch(() => {
            // Connection failed — keep the UI alive on the REST roster.
          });
      } catch (_) {
        room = null;
        roomRef.current = null;
      }
    }

    return () => {
      cancelled = true;
      if (room) {
        try { room.disconnect(); } catch (_) {}
      }
      roomRef.current = null;
      if (CallNative && fgsActive.current
          && typeof CallNative.stopCallForegroundService === 'function') {
        try { CallNative.stopCallForegroundService(); } catch (_) {}
        fgsActive.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token, livekitUrl, call_id, kind]);

  // ── Controls ─────────────────────────────────────────────────────

  // ── Watch state-push helper ─────────────────────────────────────
  //
  // After any phone-side toggle (mute / video / screen / hangup) we
  // push the new state to paired Wear OS watches so the watch's
  // optimistic flip is replaced by the authoritative value.  Without
  // this, mute-via-phone leaves the watch's mute icon out of sync
  // until the user re-toggles from the watch.
  //
  // No-op on iOS (no Wear pairing surface) and when WearDataSyncModule
  // isn't installed (older builds).
  const pushCallStateToWatch = useCallback((overrides = {}) => {
    if (!WearDataSyncModule
        || typeof WearDataSyncModule.relayCallState !== 'function') return;
    if (!Platform || Platform.OS !== 'android') return;
    const payload = JSON.stringify({
      call_id: String(call_id || ''),
      kind: String(kind || 'voice'),
      is_incoming: false,
      is_active: true,
      is_muted: muted,
      is_speaker_on: false,
      participant_count: participants.length,
      ...overrides,
    });
    try { WearDataSyncModule.relayCallState(payload).catch(() => {}); }
    catch (_) {}
  }, [call_id, kind, muted, participants.length]);

  const handleMute = useCallback(() => {
    // Lift the side-effect out of the setState updater so React strict
    // mode doesn't run setMicrophoneEnabled twice on the same toggle,
    // and the SDK call always sees the new value (`!next` is the
    // post-toggle "mic enabled" boolean).
    const next = !muted;
    setMuted(next);
    const room = roomRef.current;
    if (room && room.localParticipant) {
      try { room.localParticipant.setMicrophoneEnabled(!next); } catch (_) {}
    }
    // Sync mirror back to watch — pass override so the push uses
    // the new `next` value rather than the pre-toggle `muted`.
    pushCallStateToWatch({ is_muted: next });
  }, [muted, pushCallStateToWatch]);

  const handleVideo = useCallback(() => {
    const next = !videoOn;
    setVideoOn(next);
    const room = roomRef.current;
    if (room && room.localParticipant) {
      try { room.localParticipant.setCameraEnabled(next); } catch (_) {}
    }
    // Tell the foreground service whether camera is now active so
    // Android 14 service-type stays consistent with what we publish.
    if (CallNative
        && typeof CallNative.updateCallForegroundService === 'function'
        && fgsActive.current) {
      try {
        CallNative.updateCallForegroundService(
          String(call_id || 'active'),
          String(kind || 'voice'),
          /* includeCamera */ next,
          /* includeScreen */ screenSharing,
        );
      } catch (_) {}
    }
  }, [videoOn, call_id, kind, screenSharing]);

  const handleScreenShare = useCallback(() => {
    const wasSharing = screenSharing;
    setScreenSharing((s) => !s);
    const room = roomRef.current;
    // iOS: SDK handles RPSystemBroadcastPickerView under the hood when
    //   prepareScreenCaptureAsync is called from JS.  Nothing extra to do
    //   here on iOS once the Broadcast Upload Extension target is in the
    //   app bundle.
    // Android: we must request MediaProjection consent via the native
    //   activity, then hand the resultCode to the LiveKit SDK so it can
    //   start the screen track.
    if (!wasSharing) {
      // Update FGS to include mediaProjection BEFORE the system prompt
      // is shown — Android 14 requires the type to be declared before
      // the projection starts.
      if (CallNative
          && typeof CallNative.updateCallForegroundService === 'function'
          && fgsActive.current) {
        try {
          CallNative.updateCallForegroundService(
            String(call_id || 'active'),
            String(kind || 'voice'),
            /* includeCamera */ videoOn,
            /* includeScreen */ true,
          );
        } catch (_) {}
      }
      if (CallNative && typeof CallNative.requestScreenCapture === 'function') {
        // Subscribe ONCE; the native module emits when the user grants/denies.
        if (!screenCaptureSubRef.current && DeviceEventEmitter) {
          screenCaptureSubRef.current = DeviceEventEmitter.addListener(
            'callScreenCapture',
            (ev) => {
              if (!ev || !ev.granted) {
                setScreenSharing(false);
                return;
              }
              const r = roomRef.current;
              if (r && r.localParticipant
                  && typeof r.localParticipant.setScreenShareEnabled === 'function') {
                try { r.localParticipant.setScreenShareEnabled(true); } catch (_) {}
              }
            },
          );
        }
        try { CallNative.requestScreenCapture(); } catch (_) {}
      } else if (room && room.localParticipant
                 && typeof room.localParticipant.setScreenShareEnabled === 'function') {
        // No native bridge (e.g. iOS where the SDK handles it directly).
        try { room.localParticipant.setScreenShareEnabled(true); } catch (_) {}
      }
    } else {
      // Stopping share — drop the SDK track first then narrow FGS types.
      if (room && room.localParticipant
          && typeof room.localParticipant.setScreenShareEnabled === 'function') {
        try { room.localParticipant.setScreenShareEnabled(false); } catch (_) {}
      }
      if (CallNative
          && typeof CallNative.updateCallForegroundService === 'function'
          && fgsActive.current) {
        try {
          CallNative.updateCallForegroundService(
            String(call_id || 'active'),
            String(kind || 'voice'),
            /* includeCamera */ videoOn,
            /* includeScreen */ false,
          );
        } catch (_) {}
      }
    }
  }, [screenSharing, videoOn, call_id, kind]);

  // Cleanup the screen-capture event listener when the screen unmounts.
  useEffect(() => () => {
    if (screenCaptureSubRef.current) {
      try { screenCaptureSubRef.current.remove(); } catch (_) {}
      screenCaptureSubRef.current = null;
    }
  }, []);

  // ── Wear OS call-action subscription ─────────────────────────────
  //
  // The watch's CallNotificationScreen + CallControlsScreen send their
  // taps via WearCallActionSender.kt → MessageClient → phone-side
  // WearDataSyncService.handleCallAction → LocalBroadcastManager →
  // WearDataSyncModule re-emits as DeviceEvent 'wearCallAction'.  We
  // subscribe here so an active CallChannelScreen can react to a
  // watch's hangup / mute / speaker tap on the same call.
  useEffect(() => {
    if (!DeviceEventEmitter || !DeviceEventEmitter.addListener) return undefined;
    const sub = DeviceEventEmitter.addListener('wearCallAction', (ev) => {
      if (!ev || !ev.action) return;
      // Only react to actions on the call we're currently in.
      if (ev.call_id && call_id && ev.call_id !== call_id) return;
      switch (ev.action) {
        case 'mute':
          if (!muted) handleMute();
          break;
        case 'unmute':
          if (muted) handleMute();
          break;
        case 'hangup':
        case 'decline':
          ended.current = true;
          (async () => { try { await callsApi.leave(call_id); } catch (_) {} })();
          navigation.goBack();
          break;
        case 'accept':
          // Already in the call screen — just mark the bookkeeping joined.
          callsApi.join(call_id, { device_kind: 'mobile' }).catch(() => {});
          break;
        case 'speaker':
          // No iOS/Android JS-side speaker control wired yet; SDK
          // handles audio routing.  Logged for now.
          break;
        default:
          break;
      }
    });
    return () => { try { sub.remove(); } catch (_) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call_id, muted]);

  const handleHangup = useCallback(async () => {
    ended.current = true;
    try {
      await callsApi.leave(call_id);
    } catch (_) {}
    navigation.goBack();
  }, [call_id, navigation]);

  // ── Renderers ────────────────────────────────────────────────────

  const renderParticipantTile = (p) => {
    const initials = (p.user_id || '?').slice(0, 2).toUpperCase();
    const isAgent = p.agent_kind === 'agent';
    return (
      <View key={p.id || p.user_id} style={styles.tile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
          {isAgent ? (
            <View style={styles.agentBadge}>
              <Ionicons name="flash" size={10} color="#000000" />
            </View>
          ) : null}
        </View>
        <Text style={styles.tileName} numberOfLines={1}>
          {p.user_id?.slice(0, 8) || 'Participant'}
        </Text>
        <View style={styles.tileMeta}>
          {p.is_muted ? (
            <Ionicons name="mic-off" size={14} color="#888" />
          ) : null}
          {p.device_kind === 'agent_bridge' ? (
            <Text style={styles.tileSubtle}>agent · bridged</Text>
          ) : null}
        </View>
      </View>
    );
  };

  // ── Layout ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.subtle}>Connecting to call…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // The actual LiveKit room — when the pod is installed AND the
  // server returned a real signed token (mode='livekit').  Wraps
  // the participant grid + audio/video tracks via @livekit/react-native.
  const renderLiveKitRoom = () => {
    if (!LiveKitRoom || mode !== 'livekit' || !token || !livekitUrl) {
      return null;
    }
    return (
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        connect
        audio={!muted}
        video={videoOn}
        options={{ adaptiveStream: true, dynacast: true }}
      />
    );
  };

  // Pending / P2P mesh fallback — show the local UI grid only.
  // The roster stays visible via REST polling so users see who's in
  // the call even when no LiveKit room is rendered.
  const renderFallbackBanner = () => {
    if (mode === 'livekit') return null;
    const reason = mode === 'livekit_pending'
      ? 'Voice infra is configured but not yet ready (livekit-api SDK pending).'
      : 'Running in P2P mesh mode — clients connect directly via PeerLink.';
    return (
      <View style={styles.banner}>
        <Ionicons name="information-circle-outline" size={16} color="#FFD740" />
        <Text style={styles.bannerText}>{reason}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleHangup} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {parent_kind === 'community' ? '#' : ''}
            {parent_id ? `${parent_id.slice(0, 8)}` : 'Call'}
          </Text>
          <Text style={styles.headerSub}>
            {kind} · {participants.length} participant
            {participants.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {renderFallbackBanner()}

      {renderLiveKitRoom()}

      <View style={styles.grid}>
        {participants.map(renderParticipantTile)}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.ctrlBtn, muted && styles.ctrlBtnActive]}
          onPress={handleMute}
          accessibilityLabel={muted ? 'Unmute' : 'Mute'}
        >
          <Ionicons
            name={muted ? 'mic-off' : 'mic'}
            size={22}
            color={muted ? '#FF6B6B' : '#FFF'}
          />
        </TouchableOpacity>

        {kind !== 'voice' && (
          <TouchableOpacity
            style={[styles.ctrlBtn, !videoOn && styles.ctrlBtnActive]}
            onPress={handleVideo}
            accessibilityLabel={videoOn ? 'Stop video' : 'Start video'}
          >
            <MaterialCommunityIcons
              name={videoOn ? 'video' : 'video-off'}
              size={22}
              color={videoOn ? '#FFF' : '#FF6B6B'}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.ctrlBtn, screenSharing && styles.ctrlBtnPrimary]}
          onPress={handleScreenShare}
          accessibilityLabel="Share screen"
        >
          <MaterialCommunityIcons
            name="monitor-share"
            size={22}
            color={screenSharing ? '#000000' : '#FFF'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.hangupBtn}
          onPress={handleHangup}
          accessibilityLabel="Hang up"
        >
          <Ionicons name="call" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  subtle: { color: '#888', marginTop: 8, fontSize: wp('3.4%') },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%'),
  },
  headerBtn: { padding: 4, marginRight: 12 },
  headerTitle: { color: '#FFF', fontSize: wp('4.4%'), fontWeight: '700' },
  headerSub: { color: '#888', fontSize: wp('3%') },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFD74022',
    marginHorizontal: wp('4%'), marginVertical: hp('1%'),
    padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#FFD740',
  },
  bannerText: { color: '#FFD740', fontSize: wp('3%'), flex: 1 },

  grid: {
    flex: 1, flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: wp('3%'), gap: wp('2%'),
    alignContent: 'flex-start',
  },
  tile: {
    width: '47%', aspectRatio: 1, borderRadius: 12,
    backgroundColor: '#141225',
    alignItems: 'center', justifyContent: 'center',
    padding: wp('3%'),
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#6C63FF22',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#6C63FF', fontSize: wp('5%'), fontWeight: '700' },
  agentBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: '#FFD740', borderRadius: 10,
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#141225',
  },
  tileName: { color: '#FFF', fontSize: wp('3.4%'), fontWeight: '600', marginTop: 8 },
  tileMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  tileSubtle: { color: '#888', fontSize: wp('2.6%') },

  controls: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 16, paddingVertical: hp('2.5%'),
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1, borderColor: '#141225',
  },
  ctrlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnActive: { backgroundColor: '#3A2020' },
  ctrlBtnPrimary: { backgroundColor: '#6C63FF' },
  hangupBtn: {
    width: 64, height: 48, borderRadius: 24,
    backgroundColor: '#FF4757',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
  },
});

export default CallChannelScreen;
