import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import Feed from '../../components/feed';
import { onboardingApi } from '../../../../services/socialApi';
import useNotificationStore from '../../../../notificationStore';

const MainScreen = () => {
  const navigation = useNavigation();
  const initNotifications = useNotificationStore((s) => s.init);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const res = await onboardingApi.getProgress();
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
  }, []);

  return (
    <>
      <Feed />
    </>
  );
};

export default MainScreen;
