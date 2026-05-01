import { useState, useEffect, useCallback } from 'react';
import { Dimensions } from 'react-native';

/**
 * Orientation hook with landscape scaler.
 *
 * Usage:
 *   const { isPortrait, isLandscape, ls } = useOrientation();
 *   <Text style={{ fontSize: ls(16) }}>  // 16 in portrait, 11 in landscape
 *   <View style={{ padding: ls(24) }}>   // 24 in portrait, 17 in landscape
 */
const useOrientation = () => {
  const [screenInfo, setScreenInfo] = useState(Dimensions.get('window'));

  useEffect(() => {
    const onChange = ({ window }) => {
      setScreenInfo(window);
    };
    const sub = Dimensions.addEventListener('change', onChange);
    return () => sub?.remove();
  }, []);

  const isPortrait = screenInfo.height > screenInfo.width;
  const isLandscape = !isPortrait;

  // Landscape scaler: shrinks values by 30% in landscape, identity in portrait
  const ls = useCallback(
    (value) => (isLandscape ? Math.round(value * 0.7) : value),
    [isLandscape],
  );

  return {
    ...screenInfo,
    isPortrait,
    isLandscape,
    ls,
  };
};

export default useOrientation;
