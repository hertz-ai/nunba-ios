/**
 * Feature gates - maps features to required device capabilities.
 * Used to hide/adapt UI elements based on what the current device supports.
 */

const FEATURE_GATES = {
  camera: {
    requires: ['hasCamera'],
    description: 'Camera capture and image upload',
  },
  imageUpload: {
    requires: ['hasCamera'],
    description: 'Upload images from camera',
  },
  audioRecord: {
    requires: ['hasMicrophone'],
    description: 'Record audio / voice input',
  },
  geolocation: {
    requires: ['hasGPS'],
    excludeDevices: ['tv'],
    description: 'GPS-based features (encounters, maps)',
  },
  dragDrop: {
    requires: ['hasTouchscreen'],
    adaptOnTV: true,
    description: 'Drag and drop interactions (adapted to select-place on TV)',
  },
  screenCapture: {
    excludeDevices: ['tv'],
    description: 'Screen recording and projection',
  },
  encounters: {
    requires: ['hasGPS'],
    excludeDevices: ['tv'],
    description: 'Location-based encounters',
  },
  stories: {
    requires: ['hasTouchscreen'],
    excludeDevices: ['tv'],
    description: 'Swipe-based stories',
  },
  speech: {
    requires: ['hasMicrophone'],
    description: 'Speech recognition and voice commands',
  },
  vibration: {
    requires: ['hasVibrator'],
    description: 'Haptic feedback',
  },
  tracing: {
    requires: ['hasTouchscreen'],
    excludeDevices: ['tv'],
    description: 'Drawing/tracing game template',
  },
  openglAvatar: {
    requires: ['hasOpenGLES3'],
    excludeDevices: ['tv'],
    description: 'OpenGL ES 3.0 avatar rendering',
  },
  postCreation: {
    requires: ['hasTouchscreen'],
    description: 'Creating new posts (text input focused)',
  },
  smsOTP: {
    requires: ['hasTelephony'],
    excludeDevices: ['tv'],
    description: 'SMS-based OTP verification',
  },
  bluetooth: {
    requires: ['hasBluetooth'],
    description: 'Bluetooth features',
  },
};

/**
 * Check if a feature is available on the current device.
 * @param {string} featureName - Key from FEATURE_GATES
 * @param {string} deviceType - 'phone' | 'tablet' | 'tv'
 * @param {object} capabilities - Device capability flags
 * @returns {boolean}
 */
export const isFeatureAvailable = (featureName, deviceType, capabilities) => {
  const gate = FEATURE_GATES[featureName];
  if (!gate) return true; // Unknown features are allowed by default

  // Check device exclusions
  if (gate.excludeDevices && gate.excludeDevices.includes(deviceType)) {
    return false;
  }

  // Check required capabilities
  if (gate.requires) {
    for (const cap of gate.requires) {
      if (!capabilities[cap]) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Check if a feature should use its TV-adapted version.
 * @param {string} featureName
 * @param {string} deviceType
 * @returns {boolean}
 */
export const shouldAdaptForTV = (featureName, deviceType) => {
  if (deviceType !== 'tv') return false;
  const gate = FEATURE_GATES[featureName];
  return gate && gate.adaptOnTV === true;
};

/**
 * Get all available features for the current device.
 * @param {string} deviceType
 * @param {object} capabilities
 * @returns {string[]} Array of available feature names
 */
export const getAvailableFeatures = (deviceType, capabilities) => {
  return Object.keys(FEATURE_GATES).filter(name =>
    isFeatureAvailable(name, deviceType, capabilities)
  );
};

/**
 * Get all unavailable features for the current device.
 * @param {string} deviceType
 * @param {object} capabilities
 * @returns {{ name: string, reason: string }[]}
 */
export const getUnavailableFeatures = (deviceType, capabilities) => {
  return Object.entries(FEATURE_GATES)
    .filter(([name]) => !isFeatureAvailable(name, deviceType, capabilities))
    .map(([name, gate]) => ({
      name,
      description: gate.description,
      reason: gate.excludeDevices?.includes(deviceType)
        ? `Not supported on ${deviceType}`
        : `Missing: ${gate.requires?.filter(c => !capabilities[c]).join(', ')}`,
    }));
};

export { FEATURE_GATES };
export default { isFeatureAvailable, shouldAdaptForTV, getAvailableFeatures, getUnavailableFeatures, FEATURE_GATES };
