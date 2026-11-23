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
  NativeModules,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { messageFor } from '../../services/apiErrorMessages';

const DEDUP_WINDOW_MS = 5000;
// 2026-06-20: 401/403 spam was unbearable — every fresh screen mount
// hit a new path and each (status, path) was unique, so the per-path
// 5s dedup never suppressed them.  Users saw the red "Session expired"
// banner pop on every navigation.  A global window covering ALL paths
// for auth errors fixes the spam without hiding legitimate per-endpoint
// errors (404, 5xx still dedup per-path on the 5s window).
const AUTH_GLOBAL_DEDUP_MS = 30000;
const AUTO_DISMISS_MS = 6000;
const isAuthError = (s) => s === 401 || s === 403;

// messageFor lives in services/apiErrorMessages (pure, no RN imports) so it
// can be unit-tested; this component cannot be loaded under jest.

const ApiErrorBanner = () => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const dedupRef = useRef(new Map()); // key → ts
  // 2026-06-20: single global timestamp for 401/403 across all paths.
  // Per-path dedup wasn't enough — every screen mount hit a fresh path.
  const lastAuthErrorTsRef = useRef(0);
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
      const now = Date.now();
      // Auth errors (401/403) get a global rate limit — once shown,
      // suppress ALL auth errors (regardless of path) for 30s.  This
      // prevents the "every screen mount = new toast" spam pattern.
      if (isAuthError(status)) {
        if (now - lastAuthErrorTsRef.current < AUTH_GLOBAL_DEDUP_MS) return;
        lastAuthErrorTsRef.current = now;
        setShowSignIn(true);
        show(messageFor(status));
        return;
      }
      // Non-auth errors: per (status, path) dedup unchanged.
      const key = `${status}:${path}`;
      const lastTs = dedupRef.current.get(key) || 0;
      if (now - lastTs < DEDUP_WINDOW_MS) return;
      dedupRef.current.set(key, now);
      if (dedupRef.current.size > 50) {
        for (const [k, ts] of dedupRef.current.entries()) {
          if (now - ts > DEDUP_WINDOW_MS) dedupRef.current.delete(k);
        }
      }
      setShowSignIn(false);
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
        {showSignIn ? (
          <TouchableOpacity
            onPress={() => {
              try {
                if (NativeModules.OnboardingModule && NativeModules.OnboardingModule.openLogin) {
                  NativeModules.OnboardingModule.openLogin();
                }
              } catch (e) { /* native may not expose openLogin yet */ }
              Animated.timing(opacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
              }).start(() => setVisible(false));
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.signInBtn}
            accessibilityLabel="Sign in"
          >
            <Text style={styles.signInText}>Sign in</Text>
          </TouchableOpacity>
        ) : null}
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
  signInBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default ApiErrorBanner;
