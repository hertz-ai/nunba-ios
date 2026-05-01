const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro config for Nunba Companion (iOS).
 * Watches js/ as the JS source root. ios/ is excluded from Metro.
 */
const config = {
  resolver: {
    sourceExts: ['ios.tsx', 'ios.ts', 'tsx', 'ts', 'jsx', 'js', 'json'],
  },
  watchFolders: [],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
