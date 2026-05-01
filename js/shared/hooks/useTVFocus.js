import { useEffect, useCallback, useRef } from 'react';
import { TVEventHandler, BackHandler, Platform } from 'react-native';
import useDeviceCapabilityStore from '../deviceCapabilityStore';

/**
 * useTVFocus - Hook for TV D-pad focus management.
 * Handles back button for navigation, and provides focus utilities.
 */
const useTVFocus = (navigation) => {
  const deviceType = useDeviceCapabilityStore((s) => s.deviceType);
  const isTV = deviceType === 'tv';
  const tvEventHandler = useRef(null);

  // Handle TV remote back button
  useEffect(() => {
    if (!isTV || !navigation) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isTV, navigation]);

  // TV event handler for D-pad events
  useEffect(() => {
    if (!isTV) return;

    try {
      const handler = new TVEventHandler();
      handler.enable(null, (cmp, evt) => {
        // Can be used for global TV event handling
        // e.g., menu button opens settings
      });
      tvEventHandler.current = handler;

      return () => {
        if (tvEventHandler.current) {
          tvEventHandler.current.disable();
        }
      };
    } catch (e) {
      // TVEventHandler may not be available in all RN versions
    }
  }, [isTV]);

  /**
   * Generate nextFocus props for a grid layout.
   * @param {Array} refs - Array of ref objects for grid items
   * @param {number} columns - Number of columns in grid
   * @param {number} index - Current item index
   * @returns {object} nextFocus props
   */
  const getGridFocusProps = useCallback(
    (refs, columns, index) => {
      if (!isTV || !refs) return {};

      const row = Math.floor(index / columns);
      const col = index % columns;
      const totalItems = refs.length;

      const props = {};

      // Left
      if (col > 0 && refs[index - 1]) {
        props.nextFocusLeft = refs[index - 1];
      }

      // Right
      if (col < columns - 1 && index + 1 < totalItems && refs[index + 1]) {
        props.nextFocusRight = refs[index + 1];
      }

      // Up
      if (row > 0 && refs[index - columns]) {
        props.nextFocusUp = refs[index - columns];
      }

      // Down
      if (index + columns < totalItems && refs[index + columns]) {
        props.nextFocusDown = refs[index + columns];
      }

      return props;
    },
    [isTV]
  );

  /**
   * Generate nextFocus props for a horizontal list.
   */
  const getHorizontalFocusProps = useCallback(
    (refs, index) => {
      if (!isTV || !refs) return {};

      const props = {};
      if (index > 0 && refs[index - 1]) {
        props.nextFocusLeft = refs[index - 1];
      }
      if (index < refs.length - 1 && refs[index + 1]) {
        props.nextFocusRight = refs[index + 1];
      }
      return props;
    },
    [isTV]
  );

  return {
    isTV,
    getGridFocusProps,
    getHorizontalFocusProps,
  };
};

export default useTVFocus;
