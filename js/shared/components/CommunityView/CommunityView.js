import React, { useRef, useEffect } from 'react';
import {NavigationContainer, CommonActions} from '@react-navigation/native';
import {StatusBar, DeviceEventEmitter, BackHandler, NativeModules} from 'react-native';
import HomeRoutes from './router/home.routes';
import LiquidOverlay from '../shared/LiquidOverlay';
import NunbaKeyboard from '../shared/NunbaKeyboard';
import useDeviceCapabilityStore from '../../deviceCapabilityStore';
import TVHomeScreen from './screens/TVHomeScreen';
import AgentConsentOverlay from './components/AgentConsentOverlay';
import SecureInputOverlay from './components/SecureInputOverlay';
import ApiErrorBanner from '../shared/ApiErrorBanner';
// Deep link + marketing flywheel integration
import { linkingConfig } from '../../services/deepLinkService';
import deepLinkService from '../../services/deepLinkService';
import marketingNotificationService from '../../services/marketingNotificationService';
import channelConversationService from '../../services/channelConversationService';
import notificationRouter from '../../services/notificationRouter';
import useNotificationStore from '../../notificationStore';
import useUserStore from '../../userStore';

const CommunityView = () => {
  const deviceType = useDeviceCapabilityStore((s) => s.deviceType);
  const isTV = deviceType === 'tv';
  const navigationRef = useRef(null);

  // Initialize all services once navigation is ready
  useEffect(() => {
    // Initialize deep link service with navigation ref
    deepLinkService.init(navigationRef, true);

    // Initialize marketing flywheel
    marketingNotificationService.init();

    // Initialize channel conversation system
    channelConversationService.init();

    // Initialize notification router (depends on channels + marketing)
    notificationRouter.init();

    // Initialize notification store (existing WAMP bridge)
    useNotificationStore.getState().init();

    // Fetch the current user (/auth/me) once so role-gated widgets
    // (MarketingFunnelCard, AdminModerationQueue, etc.) can render
    // correctly on first paint instead of flashing the wrong state.
    useUserStore.getState().init();

    // Native → JS navigation bridge.  Android BottomNavigationActivity
    // calls emitNavigateTo("Notifications") when the user taps the
    // Alerts tab (R.id.notifications) — and the same pattern is reused
    // by any future native nav entry point.  Without this listener the
    // event was being emitted into the void, leaving the user on the
    // People grid even though the bottom-nav highlight moved to Alerts.
    // Verified on-device 2026-05-28 Galaxy S23 Ultra.
    //
    // After navigation completes we call BottomNavBridge.ackNavigateTo()
    // to stop the native-side retry loop.  Without the ack, the native
    // side kept re-emitting "navigateTo" every 250 ms for 8 s — any
    // subsequent JS navigation (Back, tile tap) inside that window was
    // overridden back to the originally-requested screen (#390).
    // 2026-06-20 (#422 follow-up): the previous "stale-event guard"
    // ALSO swallowed legitimate People-tab presses when the user was
    // already on a child screen.  Reported symptom: from Notifications,
    // tapping the People bottom-nav stayed on Notifications until the
    // user pressed the in-screen back arrow.  The first emit after a
    // tap and a stale retry-loop emit look identical at the JS layer
    // (same `screen` field, no sequence number) — the only difference
    // is timing.  Switching from "swallow when on child" to a per-
    // screen "recent-ack" dedup: ack immediately, then process the
    // navigation.  Repeat emits for the same screen within the 8 s
    // retry window are recognised as retries and dropped.
    const recentAckRef = { current: Object.create(null) };
    const RETRY_DEDUP_MS = 1500; // Java retries 250ms × 32, this dedups them
    const navSub = DeviceEventEmitter.addListener('navigateTo', (payload) => {
      const screen = payload && payload.screen;
      if (!screen) return;
      // Dedup: if we already acked this screen recently, the native
      // side just hasn't seen the ack yet — drop the retry.
      const lastAt = recentAckRef.current[screen] || 0;
      if (Date.now() - lastAt < RETRY_DEDUP_MS) {
        try { NativeModules.BottomNavBridge?.ackNavigateTo?.(); } catch (_) {}
        return;
      }
      const startedAt = Date.now();
      const go = () => {
        try {
          const ref = navigationRef.current;
          if (ref && ref.isReady()) {
            // Mark as recently-acked BEFORE navigating so any retry
            // that fires during the navigate() round-trip gets deduped.
            recentAckRef.current[screen] = Date.now();
            try { NativeModules.BottomNavBridge?.ackNavigateTo?.(); } catch (_) {}
            // 2026-06-20: empirical test on Xiaomi showed that
            // navigate('MainScreen') from a pushed Notifications
            // screen DID NOT pop back — Notifications stayed visible
            // 1.5 s after the People tab tap.  Explicit popToTop()
            // is deterministic: if we're already at top, it's a
            // no-op; if there are pushed routes, they get popped in
            // one shot.  Fall back to navigate() for unknown screen
            // names that aren't the root.
            try {
              const rootState = navigationRef.current.getRootState();
              const rootRoute = rootState?.routes?.[0];
              const topRoute = rootRoute?.name;
              if (screen === topRoute || screen === 'MainScreen') {
                // Reset to the root route the stack already has, key and
                // all.  A route without a key gets a new one, and a new key
                // builds the screen again: every People tap rebuilt the whole
                // feed, and a More tap right after it waited 1.7 s.
                navigationRef.current.dispatch(
                  CommonActions.reset({ index: 0, routes: [rootRoute || { name: screen }] })
                );
              } else {
                navigationRef.current.navigate(screen);
              }
            } catch (_e) {
              // Fallback to navigate() if reset fails for any reason.
              navigationRef.current.navigate(screen);
            }
          } else if (Date.now() - startedAt < 2000) {
            setTimeout(go, 100);
          } else {
            // Give up: navigation never became ready inside the 2 s
            // window — ack so the native loop stops.
            try { NativeModules.BottomNavBridge?.ackNavigateTo?.(); } catch (_) {}
          }
        } catch (_e) { /* ignore */ }
      };
      go();
    });

    // Trigger daily checkin on app open
    marketingNotificationService.triggerDailyCheckin();

    // Check re-engagement status
    marketingNotificationService.checkReengagement();

    // Hardware-back fallback: react-navigation v7's useBackButton DOES
    // auto-register a BackHandler that calls canGoBack/goBack, but a
    // live test on Galaxy S23 Ultra 2026-06-01 showed back from any
    // pushed screen (Notifications / GameHub / Profile / …) still exits
    // the app to launcher — strongly implying canGoBack() returned false
    // even when the stack visibly held [MainScreen, Pushed].  Inspect
    // the state tree directly via getRootState() and decide from the
    // route count, which is the ground truth.  Stays additive — the
    // upstream BackHandler still gets its chance to fire first; this
    // one only consumes the event if there's somewhere to pop to.
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      const nav = navigationRef.current;
      if (!nav) return false;
      try {
        const state = (typeof nav.getRootState === 'function')
          ? nav.getRootState()
          : null;
        if (typeof nav.canGoBack === 'function' && nav.canGoBack()) {
          nav.goBack();
          return true;
        }
        if (state && Array.isArray(state.routes) && (state.index > 0 || state.routes.length > 1)) {
          nav.goBack();
          return true;
        }
        // dispatch the GO_BACK action directly — bypasses any wrapper
        // that might be filtering canGoBack/goBack incorrectly.
        if (typeof nav.dispatch === 'function') {
          try {
            nav.dispatch(CommonActions.goBack());
            return true;
          } catch (_eDispatch) { /* swallow */ }
        }
      } catch (e) {
        console.warn('[CommunityView] BackHandler error', e && e.message);
      }
      return false;
    });

    return () => {
      navSub.remove();
      backSub.remove();
      deepLinkService.destroy();
      marketingNotificationService.destroy();
      channelConversationService.destroy();
      notificationRouter.destroy();
    };
  }, []);

  // On TV: render the leanback-style TVHomeScreen directly as the main experience
  if (isTV) {
    return (
      <NavigationContainer ref={navigationRef} linking={{...linkingConfig, enabled: false}}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <HomeRoutes />
        <AgentConsentOverlay />
        <SecureInputOverlay />
        <ApiErrorBanner />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={{...linkingConfig, enabled: false}}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <HomeRoutes />
      <LiquidOverlay />
      <NunbaKeyboard />
      <AgentConsentOverlay />
      <SecureInputOverlay />
      <ApiErrorBanner />
    </NavigationContainer>
  );
};

export default CommunityView;
