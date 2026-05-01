import { create } from 'zustand';

const useEncounterStore = create((set) => ({
  isTracking: false,
  lat: null,
  lon: null,
  nearbyCount: 0,
  matches: [],
  missedConnections: [],
  myMissedConnections: [],
  selectedMissed: null,
  radius: 1000,
  setTracking: (val) => set({ isTracking: val }),
  setLocation: (lat, lon) => set({ lat, lon }),
  setNearbyCount: (count) => set({ nearbyCount: count }),
  setMatches: (matches) => set({ matches }),
  setMissedConnections: (list) => set({ missedConnections: list }),
  setMyMissedConnections: (list) => set({ myMissedConnections: list }),
  setSelectedMissed: (item) => set({ selectedMissed: item }),
  setRadius: (r) => set({ radius: r }),
}));

export default useEncounterStore;
