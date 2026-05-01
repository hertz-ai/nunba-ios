import { useEffect } from 'react';
import useDeviceCapabilityStore from '../deviceCapabilityStore';
import { isFeatureAvailable } from '../services/featureGates';

/**
 * Hook for accessing device capability info throughout the app.
 * Auto-initializes on first use.
 */
const useDeviceCapability = () => {
  const store = useDeviceCapabilityStore();

  useEffect(() => {
    if (!store.initialized) {
      store.initialize();
    }
  }, [store.initialized]);

  return {
    deviceType: store.deviceType,
    capabilities: store.capabilities,
    initialized: store.initialized,
    isTV: store.deviceType === 'tv',
    isPhone: store.deviceType === 'phone',
    isTablet: store.deviceType === 'tablet',
    isFeatureAvailable: (featureName) =>
      isFeatureAvailable(featureName, store.deviceType, store.capabilities),
  };
};

export default useDeviceCapability;
