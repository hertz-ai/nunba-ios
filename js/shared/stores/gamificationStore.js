import { create } from 'zustand';

const useGamificationStore = create((set) => ({
  // Resonance wallet
  wallet: null,
  walletLoading: false,

  // Achievements
  achievements: [],
  userAchievements: [],
  achievementsLoading: false,

  // Challenges
  challenges: [],
  activeChallenges: [],
  challengesLoading: false,

  // Season
  currentSeason: null,
  seasonLoading: false,

  // Regions
  regions: [],
  selectedRegion: null,
  regionsLoading: false,

  // Agent Evolution
  agentEvolution: null,
  evolutionLoading: false,

  // Campaigns
  campaigns: [],
  selectedCampaign: null,
  campaignsLoading: false,

  // Onboarding
  onboardingProgress: null,
  onboardingLoading: false,

  // Leaderboards
  resonanceLeaderboard: [],
  seasonLeaderboard: [],

  // Actions
  setWallet: (wallet) => set({ wallet }),
  setWalletLoading: (loading) => set({ walletLoading: loading }),

  setAchievements: (achievements) => set({ achievements }),
  setUserAchievements: (userAchievements) => set({ userAchievements }),
  setAchievementsLoading: (loading) => set({ achievementsLoading: loading }),

  setChallenges: (challenges) => set({ challenges }),
  setActiveChallenges: (activeChallenges) => set({ activeChallenges }),
  setChallengesLoading: (loading) => set({ challengesLoading: loading }),

  setCurrentSeason: (season) => set({ currentSeason: season }),
  setSeasonLoading: (loading) => set({ seasonLoading: loading }),

  setRegions: (regions) => set({ regions }),
  setSelectedRegion: (region) => set({ selectedRegion: region }),
  setRegionsLoading: (loading) => set({ regionsLoading: loading }),

  setAgentEvolution: (evolution) => set({ agentEvolution: evolution }),
  setEvolutionLoading: (loading) => set({ evolutionLoading: loading }),

  setCampaigns: (campaigns) => set({ campaigns }),
  setSelectedCampaign: (campaign) => set({ selectedCampaign: campaign }),
  setCampaignsLoading: (loading) => set({ campaignsLoading: loading }),

  setOnboardingProgress: (progress) => set({ onboardingProgress: progress }),
  setOnboardingLoading: (loading) => set({ onboardingLoading: loading }),

  setResonanceLeaderboard: (leaderboard) =>
    set({ resonanceLeaderboard: leaderboard }),
  setSeasonLeaderboard: (leaderboard) =>
    set({ seasonLeaderboard: leaderboard }),

  // Reset all
  reset: () =>
    set({
      wallet: null,
      achievements: [],
      userAchievements: [],
      challenges: [],
      activeChallenges: [],
      currentSeason: null,
      regions: [],
      selectedRegion: null,
      agentEvolution: null,
      campaigns: [],
      selectedCampaign: null,
      onboardingProgress: null,
      resonanceLeaderboard: [],
      seasonLeaderboard: [],
    }),
}));

export default useGamificationStore;
