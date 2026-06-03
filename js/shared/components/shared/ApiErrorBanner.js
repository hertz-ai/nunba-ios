/**
 * ApiErrorBanner — global toast for server errors.
 *
 * Subscribes to DeviceEventEmitter "ApiError" events (emitted by
 * services/socialApi.js get/post/patch/del helpers on non-OK responses)
 * and surfaces a dismissible banner at the top of the screen.
 *
 * Why this exists: HARTOS occasionally returns 5xx on discovery
 * endpoints (e.g. /communities, /posts).  Before this banner, those
 * failures were invisible — the screen just rendered an EmptyState
 * and the user assumed there was simply no content.  Now they see
 * "Something's off on our end — pull to refresh" and know the issue
 * is server-side, not a fresh-account effect.
 *
 * Dedup: same (status, path) within 5 s is suppressed so a screen
 * that triggers 3 parallel GETs doesn't show 3 toasts.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  DeviceEventEmitter,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const DEDUP_WINDOW_MS = 5000;
const AUTO_DISMISS_MS = 6000;

const messageFor = (status) => {
  if (status >= 500) return "Something's off on our end. Pull to refresh.";
  if (status === 401 || status === 403) return 'Session expired — sign in again.';
  if (status === 404) return "Couldn't find what you asked for.";
  if (status >= 400) return 'Bad request — try again in a moment.';
  return 'Network glitch. Pull to refresh.';
};

const ApiErrorBanner = () => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;
  const dedupRef = useRef(new Map()); // key → ts
  const dismissTimerRef = useRef(null);

  useEffect(() => {
    const show = (msg) => {
      setMessage(msg);
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => hide(), AUTO_DISMISS_MS);
    };
    const hide = () => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    };

    const sub = DeviceEventEmitter.addListener('ApiError', (payload) => {
      const status = payload?.status || 0;
      const path = payload?.path || '';
      const key = `${status}:${path}`;
      const now = Date.now();
      const lastTs = dedupRef.current.get(key) || 0;
      if (now - lastTs < DEDUP_WINDOW_MS) return;
      dedupRef.current.set(key, now);
      // Prune stale entries opportunistically so the Map doesn't grow forever.
      if (dedupRef.current.size > 50) {
        for (const [k, ts] of dedupRef.current.entries()) {
          if (now - ts > DEDUP_WINDOW_MS) dedupRef.current.delete(k);
        }
      }
      show(messageFor(status));
    });

    return () => {
      sub.remove();
      clearTimeout(dismissTimerRef.current);
    };
  }, [opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, { opacity }]}
    >
      <View style={styles.banner}>
        <MaterialCommunityIcons name="cloud-off-outline" size={18} color="#FFFFFF" />
        <Text style={styles.text} numberOfLines={2}>{message}</Text>
        <TouchableOpacity
          onPress={() => {
            Animated.timing(opacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start(() => setVisible(false));
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Dismiss"
        >
          <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    paddingHorizontal: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B91C1C',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ApiErrorBanner;
