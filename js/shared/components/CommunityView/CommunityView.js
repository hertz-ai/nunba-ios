import React, { useRef, useEffect } from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {StatusBar} from 'react-native';
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

    // Trigger daily checkin on app open
    marketingNotificationService.triggerDailyCheckin();

    // Check re-engagement status
    marketingNotificationService.checkReengagement();

    return () => {
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
        <StatusBar barStyle="light-content" backgroundColor="#0F0E17" />
        <HomeRoutes />
        <AgentConsentOverlay />
        <SecureInputOverlay />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={{...linkingConfig, enabled: false}}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0E17" />
      <HomeRoutes />
      <LiquidOverlay />
      <NunbaKeyboard />
      <AgentConsentOverlay />
      <SecureInputOverlay />
    </NavigationContainer>
  );
};

export default CommunityView;
