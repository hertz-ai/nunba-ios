import { useEffect, useRef, useCallback, useMemo } from 'react';
import useContextAwarenessStore from '../contextAwarenessStore';
import useDeviceCapabilityStore from '../deviceCapabilityStore';
import { isFeatureAvailable } from '../services/featureGates';

const REFRESH_INTERVAL = 300000; // 5 minutes

const useContextualInsights = () => {
  const signals = useContextAwarenessStore((s) => s.signals);
  const timeOfDay = useContextAwarenessStore((s) => s.timeOfDay);
  const greeting = useContextAwarenessStore((s) => s.greeting);
  const refreshing = useContextAwarenessStore((s) => s.refreshing);
  const refreshAllSignals = useContextAwarenessStore((s) => s.refreshAllSignals);
  const celebrationEvent = useContextAwarenessStore((s) => s.celebrationEvent);

  // Subscribe to device capabilities reactively
  const deviceType = useDeviceCapabilityStore((s) => s.deviceType);
  const capabilities = useDeviceCapabilityStore((s) => s.capabilities);

  const intervalRef = useRef(null);

  const refresh = useCallback(() => {
    refreshAllSignals();
  }, [refreshAllSignals]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  // Memoize filtered signals to avoid new array reference every render
  const filteredSignals = useMemo(() =>
    signals.filter((s) => {
      if (s.type === 'encounters_nearby' && !isFeatureAvailable('encounters', deviceType, capabilities)) {
        return false;
      }
      if (s.type === 'kids_review' && !isFeatureAvailable('dragDrop', deviceType, capabilities)) {
        return false;
      }
      return true;
    }),
    [signals, deviceType, capabilities]
  );

  return {
    signals: filteredSignals,
    timeOfDay,
    greeting,
    refreshing,
    refresh,
    celebrationEvent,
  };
};

export default useContextualInsights;
