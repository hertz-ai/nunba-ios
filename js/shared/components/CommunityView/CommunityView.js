import React, { useRef, useEffect } from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {StatusBar, DeviceEventEmitter} from 'react-native';
import HomeRoutes from './router/home.routes';
import LiquidOverlay from '../shared/LiquidOverlay';
import NunbaKeyboard from '../shared/NunbaKeyboard';
import useDeviceCapabilityStore from '../../deviceCapabilityStore';
import TVHomeScreen from './screens/TVHomeScreen';
import AgentConsentOverlay from './components/AgentConsentOverlay';
import SecureInputOverlay from './components/SecureInputOverlay';
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
    const navSub = DeviceEventEmitter.addListener('navigateTo', (payload) => {
      const screen = payload && payload.screen;
      if (!screen) return;
      // navigationRef may not be ready on the very first tap if the
      // user is fast — defer to next tick so NavigationContainer mounts.
      const go = () => {
        try {
          if (navigationRef.current && navigationRef.current.isReady()) {
            navigationRef.current.navigate(screen);
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

    return () => {
      navSub.remove();
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
    </NavigationContainer>
  );
};

export default CommunityView;
