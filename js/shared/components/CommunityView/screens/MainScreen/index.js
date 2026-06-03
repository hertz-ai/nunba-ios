import React, { useEffect, useRef } from 'react';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Feed from '../../components/feed';
import { onboardingApi } from '../../../../services/socialApi';
import useNotificationStore from '../../../../notificationStore';

const MainScreen = () => {
  const navigation = useNavigation();
  const initNotifications = useNotificationStore((s) => s.init);
  // Guards user-reported bug: tapping QuickAccessBar tiles (Games / More
  // / etc.) BEFORE the async onboarding check resolves caused MainScreen
  // to forcibly navigate('Onboarding') AFTER the user had already left
  // — they saw a transition flash back to the feed.  Only run the
  // onboarding navigate while the screen is still focused, and only if
  // the user hasn't navigated away during the await.
  const userNavigatedAwayRef = useRef(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) userNavigatedAwayRef.current = true;
  }, [isFocused]);

  useEffect(() => {
    let mounted = true;
    const checkOnboarding = async () => {
      try {
        const res = await onboardingApi.getProgress();
        if (!mounted) return;
        if (userNavigatedAwayRef.current) return;
        if (res.data && !res.data.dismissed && !res.data.completed) {
          navigation.navigate('Onboarding');
        }
      } catch (e) {
        // Onboarding check failed, skip silently
      }
    };
    checkOnboarding();

    // Initialize real-time listener via native WAMP/crossbar bridge
    initNotifications();

    return () => { mounted = false; };
  }, []);

  return (
    <>
      <Feed />
    </>
  );
};

export default MainScreen;
