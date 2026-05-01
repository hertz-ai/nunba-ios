import { create } from 'zustand';
import { NativeModules, Platform } from 'react-native';

const { DeviceCapabilityModule } = NativeModules;

const useDeviceCapabilityStore = create((set, get) => ({
  deviceType: 'phone',
  deviceId: null,
  deviceName: '',
  capabilities: {
    hasCamera: true,
    hasTouchscreen: true,
    hasMicrophone: true,
    hasGPS: true,
    hasDpad: false,
    hasVibrator: true,
    hasBluetooth: true,
    hasTelephony: true,
    hasNFC: false,
    hasOpenGLES3: true,
    screenWidthDp: 360,
    screenHeightDp: 640,
    screenDensity: 2,
    isTV: false,
    brand: '',
    model: '',
    sdkVersion: 24,
  },
  initialized: false,

  // Actions
  setDeviceType: (type) => set({ deviceType: type }),
  setCapabilities: (caps) => set({ capabilities: caps }),

  initialize: async () => {
    if (get().initialized) return;
    try {
      if (DeviceCapabilityModule) {
        const [deviceType, capabilities, deviceId, deviceName] = await Promise.all([
          DeviceCapabilityModule.getDeviceType(),
          DeviceCapabilityModule.getCapabilities(),
          DeviceCapabilityModule.getDeviceId(),
          DeviceCapabilityModule.getDeviceName(),
        ]);
        set({
          deviceType,
          deviceId,
          deviceName,
          capabilities: { ...get().capabilities, ...capabilities },
          initialized: true,
        });
      } else {
        // Fallback for when NativeModule is not available (e.g., testing)
        set({ initialized: true });
      }
    } catch (error) {
      console.warn('DeviceCapability init failed:', error);
      set({ initialized: true });
    }
  },

  // Computed getters
  get isTV() { return get().deviceType === 'tv'; },
  get isPhone() { return get().deviceType === 'phone'; },
  get isTablet() { return get().deviceType === 'tablet'; },
}));

export default useDeviceCapabilityStore;
