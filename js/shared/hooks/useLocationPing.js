import useEncounterStore from '../encounterStore';
import { enableTracking, disableTracking } from '../services/encounterTracker';

// Encounters tracking state for a screen.  The tracking itself is app-wide
// (services/encounterTracker.js): leaving the screen no longer stops it, and
// once Location Sharing is on it resumes by itself on the next launch.
const useLocationPing = () => {
  const isTracking = useEncounterStore((s) => s.isTracking);
  const lat = useEncounterStore((s) => s.lat);
  const lon = useEncounterStore((s) => s.lon);
  const nearbyCount = useEncounterStore((s) => s.nearbyCount);
  const matches = useEncounterStore((s) => s.matches);

  return {
    isTracking,
    lat,
    lon,
    nearbyCount,
    matches,
    startTracking: enableTracking,
    stopTracking: disableTracking,
  };
};

export default useLocationPing;
