import React, { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Feed from '../../components/feed';
import { onboardingApi } from '../../../../services/socialApi';
import useNotificationStore from '../../../../notificationStore';

const MainScreen = () => {
  const navigation = useNavigation();
  const initNotifications = useNotificationStore((s) => s.init);

  // 2026-06-16 race fix (recurring): the previous guard used a state-
  // derived ref (`userNavigatedAwayRef` driven by `useIsFocused()`)
  // that updated ASYNC after a tap moved the user away.  Sequence
  // that lost the race: t=0 mount → t=50 user taps More → t=80
  // navigation.navigate('AllFeatures') → t=200 onboarding API
  // resolves → useEffect for isFocused HAS NOT yet flipped the ref
  // → guard reads false → navigate('Onboarding') fires → user is
  // POPPED back to People feed.  React-navigation exposes
  // `navigation.isFocused()` which queries the live focus state at
  // call time — race-free.  Also defer the API call past first
  // interaction so taps win the JS thread.
  useEffect(() => {
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      (async () => {
        try {
          const res = await onboardingApi.getProgress();
          if (cancelled) return;
          // Live query — true ONLY if we're STILL on People tab right
          // now.  If the user tapped away in the meantime, this returns
          // false and we silently bail.
          if (!navigation.isFocused()) return;
          // HARTOS OnboardingService.get_progress: tutorial_dismissed is set
          // once the tour is closed or finished, completed_at once every
          // server step is done.
          if (res.data && !res.data.tutorial_dismissed && !res.data.completed_at) {
            navigation.navigate('Onboarding');
          }
        } catch (e) {
          // Onboarding check failed — silent
        }
      })();
    });
    // initNotifications is cheap; let it run on mount.
    initNotifications();
    return () => {
      cancelled = true;
      try { handle?.cancel?.(); } catch (_) {}
    };
  }, []);

  return (
    <>
      <Feed />
    </>
  );
};

export default MainScreen;
