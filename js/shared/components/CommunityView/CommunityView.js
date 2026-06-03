import React, { useRef, useEffect } from 'react';
import {NavigationContainer} from '@react-navigation/native';
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
    const navSub = DeviceEventEmitter.addListener('navigateTo', (payload) => {
      const screen = payload && payload.screen;
      if (!screen) return;
      const go = () => {
        try {
          if (navigationRef.current && navigationRef.current.isReady()) {
            navigationRef.current.navigate(screen);
            try { NativeModules.BottomNavBridge?.ackNavigateTo?.(); } catch (_) {}
          } else {
            setTimeout(go, 100);
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
            const { CommonActions } = require('@react-navigation/native');
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
