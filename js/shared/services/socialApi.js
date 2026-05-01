import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URLs — configurable via AsyncStorage ('hevolve_api_base')
// Default: production. Override at runtime via settings.
// All URL vars are `let` so the async resolver can update them before first API call.
let _apiBase = 'https://mailer.hertzai.com';
let BASE_URL = `${_apiBase}/api/social`;
let CODING_BASE_URL = `${_apiBase}/api/coding`;
let INTELLIGENCE_BASE_URL = `${_apiBase}/api/v1/intelligence`;
let BUILDS_BASE_URL = `${_apiBase}/api/v1/builds`;
let IP_BASE_URL = `${_apiBase}/api/ip`;
let GOALS_BASE_URL = `${_apiBase}/api/goals`;

(async () => {
  try {
    const custom = await AsyncStorage.getItem('hevolve_api_base');
    if (custom) {
      _apiBase = custom;
      BASE_URL = `${_apiBase}/api/social`;
      CODING_BASE_URL = `${_apiBase}/api/coding`;
      INTELLIGENCE_BASE_URL = `${_apiBase}/api/v1/intelligence`;
      BUILDS_BASE_URL = `${_apiBase}/api/v1/builds`;
      IP_BASE_URL = `${_apiBase}/api/ip`;
      GOALS_BASE_URL = `${_apiBase}/api/goals`;
    }
  } catch (_) {}
})();

const getUserId = () =>
  new Promise((resolve, reject) => {
    try {
      NativeModules.OnboardingModule.getUser_id((userId) => {
        resolve(userId);
      });
    } catch (err) {
      reject(err);
    }
  });

const buildUrl = (path, params, base = BASE_URL) => {
  let url = `${base}${path}`;
  if (params && Object.keys(params).length > 0) {
    const query = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    if (query) {
      url += `?${query}`;
    }
  }
  return url;
};

const getAccessToken = () =>
  new Promise((resolve, reject) => {
    try {
      NativeModules.OnboardingModule.getAccessToken((token) => {
        resolve(token);
      });
    } catch (err) {
      reject(err);
    }
  });

const getHeaders = async () => {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

const get = async (path, params) => {
  const headers = await getHeaders();
  const url = buildUrl(path, params);
  const response = await fetch(url, { method: 'GET', headers });
  return response.json();
};

const post = async (path, body) => {
  const headers = await getHeaders();
  const url = buildUrl(path);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
};

const patch = async (path, body) => {
  const headers = await getHeaders();
  const url = buildUrl(path);
  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
};

const del = async (path) => {
  const headers = await getHeaders();
  const url = buildUrl(path);
  const response = await fetch(url, { method: 'DELETE', headers });
  return response.json();
};

export const encountersApi = {
  locationPing: (lat, lon, accuracy, device_id) =>
    post('/encounters/location-ping', { lat, lon, accuracy, device_id }),

  nearbyCount: () => get('/encounters/nearby-now'),

  proximityMatches: () => get('/encounters/proximity-matches'),

  revealMatch: (matchId) =>
    post(`/encounters/proximity/${matchId}/reveal`, {}),

  getLocationSettings: () => get('/encounters/location-settings'),

  updateLocationSettings: (data) =>
    patch('/encounters/location-settings', data),

  // Discovery tab — parity with web SPA's encountersApi.suggestions /
  // encountersApi.acknowledge (landing-page/src/services/socialApi.js).
  // Closes the Discovery feature on Android (was a "Coming Soon"
  // placeholder before this; the screen now renders an EncounterCard
  // FlatList wired to suggestions+acknowledge).
  suggestions: () => get('/encounters/suggestions'),

  acknowledge: (id) => post(`/encounters/${id}/acknowledge`, {}),

  createMissed: (data) => post('/encounters/missed-connections', data),

  searchMissed: (params) => get('/encounters/missed-connections', params),

  myMissed: () => get('/encounters/missed-connections/mine'),

  getMissed: (id) => get(`/encounters/missed-connections/${id}`),

  respondMissed: (id, message) =>
    post(`/encounters/missed-connections/${id}/respond`, { message }),

  acceptMissedResponse: (id, responseId) =>
    post(`/encounters/missed-connections/${id}/accept/${responseId}`, {}),

  deleteMissed: (id) => del(`/encounters/missed-connections/${id}`),

  suggestLocations: (lat, lon) =>
    get('/encounters/missed-connections/suggest-locations', { lat, lon }),
};

// --- BLE physical-world Encounter feature (J200-J215) ---
//
// Distinct surface from `encountersApi` above (which serves the
// proximity / missed-connection / discovery suggestion table on
// `/encounters/*`); this wraps `/encounter/*` (singular) which
// is the BLE pubkey-broadcast + sighting + swipe + icebreaker
// flow.  RN parity for the web SPA's `bleEncounterApi` at
// landing-page/src/services/socialApi.js:230-291 (commit 65084ae2).
//
// Backend chain: HARTOS integrations/social/encounter_api.py
// (encounter_bp blueprint mounted at /api/social/encounter/*).
// Privacy invariants: 18+ age claim required to enable
// discoverable, TTL clamped server-side, ≤MAX_TOGGLES_24H per day,
// avatar-only swipe cards (no photos), AI-drafted icebreakers
// require explicit user approval before send.
export const bleEncounterApi = {
  // J200, J201 — discoverable consent + state
  getDiscoverable: () => get('/encounter/discoverable'),
  setDiscoverable: ({
    enabled,
    age_claim_18,
    ttl_sec,
    face_visible,
    avatar_style,
    vibe_tags,
  }) =>
    post('/encounter/discoverable', {
      enabled: !!enabled,
      age_claim_18: !!age_claim_18,
      ttl_sec: ttl_sec || undefined,
      face_visible: !!face_visible,
      avatar_style: avatar_style || 'studio_ghibli',
      vibe_tags: vibe_tags || [],
    }),

  // J200 — phone registers current rotating pubkey
  registerPubkey: (pubkey) =>
    post('/encounter/register-pubkey', { pubkey }),

  // J203 — sighting → swipe-card payload
  reportSighting: ({ peer_pubkey, rssi_peak, dwell_sec, lat, lng }) =>
    post('/encounter/sighting', {
      peer_pubkey,
      rssi_peak,
      dwell_sec,
      lat,
      lng,
    }),

  // J204, J205 — like/dislike; mutual returns match_id
  swipe: (sighting_id, decision) =>
    post('/encounter/swipe', { sighting_id, decision }),

  // J204 — list mutual matches (one-sided likes never returned)
  listMatches: () => get('/encounter/matches'),

  // J211 — map pins for matches the user has kept visible
  listMapPins: () => get('/encounter/map-pins'),

  // J207 — generate draft for user-approval surface
  draftIcebreaker: (match_id) =>
    post('/encounter/icebreaker/draft', { match_id }),

  // J209, J210 — final user-approval / decline tap
  approveIcebreaker: (match_id, text) =>
    post('/encounter/icebreaker/approve', { match_id, text }),
  declineIcebreaker: (match_id, reason) =>
    post('/encounter/icebreaker/decline', { match_id, reason }),

  // WAMP topic constants (single-source via server response so the
  // client never hard-codes them — the server's WAMP_TOPICS dict
  // is the authority)
  topics: () => get('/encounter/topics'),
};

// --- Cloud-capability consent (parity for landing-page consentApi
//     in commit 9d6e45e0 / F3).  Backed by HARTOS
//     /api/social/consent endpoints (commit f05a396 / 76f99dee).
//     Append-only: every grant inserts a NEW UserConsent row;
//     revoke sets revoked_at on the most-recent active row but
//     never deletes — auditable history of grant + revoke events.
//
//     Mission anchors per project_encounter_icebreaker.md:
//       - 18+ + I-understand checkboxes are UI-side defense-in-depth;
//         server enforces independently.
//       - Revoke leaves the original row intact (immutable history).
//       - Re-grant after revoke creates a NEW row, NEVER reuses.
export const consentApi = {
  // Grant a consent — append-only.  Server returns 200 with the new
  // row's id + timestamps.
  grant: ({ consent_type, scope, agent_id, metadata }) =>
    post('/consent', {
      consent_type,
      scope,
      agent_id: agent_id || undefined,
      metadata: metadata || undefined,
    }),

  // Revoke the most-recent active consent for (consent_type, scope).
  // Server returns 404 (neutral) if no active consent exists.
  revoke: ({ consent_type, scope, agent_id }) =>
    post('/consent/revoke', {
      consent_type,
      scope,
      agent_id: agent_id || undefined,
    }),

  // List consents (active + revoked).  Optional consent_type filter,
  // optional active_only=true.  Newest-first by granted_at.
  list: (params) => get('/consent', params),
};

// --- Resonance ---
export const resonanceApi = {
  getWallet: () => get('/resonance/wallet'),
  getWalletFor: (userId) => get(`/resonance/wallet/${userId}`),
  getTransactions: (params) => get('/resonance/transactions', params),
  getLeaderboard: (params) => get('/resonance/leaderboard', params),
  dailyCheckin: () => post('/resonance/daily-checkin', {}),
  getStreak: () => get('/resonance/streak'),
  getBreakdown: (userId) => get(`/resonance/breakdown/${userId}`),
  getLevelInfo: () => get('/resonance/level-info'),
  boost: (data) => post('/resonance/boost', data),
  getBoosts: (targetType, targetId) =>
    get(`/resonance/boosts/${targetType}/${targetId}`),
};

// --- Achievements ---
export const achievementsApi = {
  list: () => get('/achievements'),
  getForUser: (userId) => get(`/achievements/${userId}`),
  showcase: (achievementId, data) =>
    post(`/achievements/${achievementId}/showcase`, data),
};

// --- Challenges ---
export const challengesApi = {
  list: (params) => get('/challenges', params),
  get: (id) => get(`/challenges/${id}`),
  updateProgress: (id, data) => post(`/challenges/${id}/progress`, data),
  claim: (id) => post(`/challenges/${id}/claim`, {}),
};

// --- Seasons ---
export const seasonsApi = {
  current: () => get('/seasons/current'),
  leaderboard: (id, params) => get(`/seasons/${id}/leaderboard`, params),
  achievements: (id) => get(`/seasons/${id}/achievements`),
};

// --- Regions ---
export const regionsApi = {
  list: (params) => get('/regions', params),
  get: (id) => get(`/regions/${id}`),
  create: (data) => post('/regions', data),
  update: (id, data) => patch(`/regions/${id}`, data),
  join: (id) => post(`/regions/${id}/join`, {}),
  leave: (id) => del(`/regions/${id}/leave`),
  members: (id, params) => get(`/regions/${id}/members`, params),
  feed: (id, params) => get(`/regions/${id}/feed`, params),
  leaderboard: (id, params) => get(`/regions/${id}/leaderboard`, params),
  governance: (id) => get(`/regions/${id}/governance`),
  promote: (id, data) => post(`/regions/${id}/promote`, data),
  demote: (id, data) => post(`/regions/${id}/demote`, data),
  nearby: (params) => get('/regions/nearby', params),
};

// --- Agent Evolution ---
export const evolutionApi = {
  get: (agentId) => get(`/agents/${agentId}/evolution`),
  specialize: (agentId, data) => post(`/agents/${agentId}/specialize`, data),
  leaderboard: (params) => get('/agents/leaderboard', params),
  trees: () => get('/agents/specialization-trees'),
  collaborations: (agentId, params) =>
    get(`/agents/${agentId}/collaborations`, params),
  collaborate: (agentId, data) => post(`/agents/${agentId}/collaborate`, data),
  showcase: (params) => get('/agents/showcase', params),
  history: (agentId) => get(`/agents/${agentId}/evolution-history`),
};

// --- Ratings ---
export const ratingsApi = {
  submit: (data) => post('/ratings', data),
  get: (userId) => get(`/ratings/${userId}`),
  received: (userId, params) => get(`/ratings/${userId}/received`, params),
  given: (userId, params) => get(`/ratings/${userId}/given`, params),
  context: (type, id) => get(`/ratings/context/${type}/${id}`),
  trust: (userId) => get(`/trust/${userId}`),
};

// --- Referrals ---
export const referralsApi = {
  getCode: () => get('/referral/code'),
  use: (data) => post('/referral/use', data),
  stats: () => get('/referral/stats'),
};

// --- Campaigns ---
export const campaignsApi = {
  list: (params) => get('/campaigns', params),
  get: (id) => get(`/campaigns/${id}`),
  create: (data) => post('/campaigns', data),
  update: (id, data) => patch(`/campaigns/${id}`, data),
  delete: (id) => del(`/campaigns/${id}`),
  generateStrategy: (id) => post(`/campaigns/${id}/generate-strategy`, {}),
  executeStep: (id) => post(`/campaigns/${id}/execute-step`, {}),
  leaderboard: (params) => get('/campaigns/leaderboard', params),
};

// --- Onboarding ---
export const onboardingApi = {
  getProgress: () => get('/onboarding/progress'),
  completeStep: (data) => post('/onboarding/complete-step', data),
  dismiss: () => post('/onboarding/dismiss', {}),
  suggestion: () => get('/onboarding/suggestion'),
};

// --- Posts ---
export const postsApi = {
  list: (params) => get('/posts', params),
  create: (data) => post('/posts', data),
  get: (id) => get(`/posts/${id}`),
  update: (id, data) => patch(`/posts/${id}`, data),
  delete: (id) => del(`/posts/${id}`),
  upvote: (id) => post(`/posts/${id}/upvote`, {}),
  downvote: (id) => post(`/posts/${id}/downvote`, {}),
  removeVote: (id) => del(`/posts/${id}/vote`),
  getComments: (postId, params) => get(`/posts/${postId}/comments`, params),
  comment: (postId, data) => post(`/posts/${postId}/comments`, data),
};

// --- Comments ---
export const commentsApi = {
  getByPost: (postId, params) => get(`/posts/${postId}/comments`, params),
  create: (postId, data) => post(`/posts/${postId}/comments`, data),
  reply: (commentId, data) => post(`/comments/${commentId}/reply`, data),
  update: (commentId, data) => patch(`/comments/${commentId}`, data),
  delete: (commentId) => del(`/comments/${commentId}`),
  upvote: (id) => post(`/comments/${id}/upvote`, {}),
  downvote: (id) => post(`/comments/${id}/downvote`, {}),
};

// --- Feed ---
export const feedApi = {
  personalized: (params) => get('/feed', params),
  global: (params) => get('/feed/all', params),
  trending: (params) => get('/feed/trending', params),
  agents: (params) => get('/feed/agents', params),
};

// --- Users ---
export const usersApi = {
  list: (params) => get('/users', params),
  get: (id) => get(`/users/${id}`),
  update: (id, data) => patch(`/users/${id}`, data),
  posts: (id, params) => get(`/users/${id}/posts`, params),
  karma: (id) => get(`/users/${id}/karma`),
  follow: (id) => post(`/users/${id}/follow`, {}),
  unfollow: (id) => del(`/users/${id}/follow`),
  followers: (id, params) => get(`/users/${id}/followers`, params),
  following: (id, params) => get(`/users/${id}/following`, params),
};

// --- Search ---
export const searchApi = {
  search: (params) => get('/search', params),
};

// --- Notifications ---
export const notificationsApi = {
  list: (params) => get('/notifications', params),
  markRead: (ids) => post('/notifications/read', { ids }),
  markAllRead: () => post('/notifications/read-all', {}),
};

// --- Communities ---
export const communitiesApi = {
  list: (params) => get('/communities', params),
  create: (data) => post('/communities', data),
  get: (id) => get(`/communities/${id}`),
  posts: (id, params) => get(`/communities/${id}/posts`, params),
  join: (id) => post(`/communities/${id}/join`, {}),
  leave: (id) => post(`/communities/${id}/leave`, {}),
  members: (id, params) => get(`/communities/${id}/members`, params),
};

// --- Tasks ---
export const tasksApi = {
  list: (params) => get('/tasks', params),
  create: (data) => post('/tasks', data),
  get: (id) => get(`/tasks/${id}`),
  assign: (id, data) => post(`/tasks/${id}/assign`, data),
  complete: (id, data) => post(`/tasks/${id}/complete`, data),
  mine: (params) => get('/tasks', { ...params, mine: true }),
};

// --- Recipes ---
export const recipesApi = {
  list: (params) => get('/recipes', params),
  get: (id) => get(`/recipes/${id}`),
  share: (data) => post('/recipes/share', data),
  fork: (id) => post(`/recipes/${id}/fork`, {}),
};

// --- Auth (bridges native token to social API user info) ---
export const authApi = {
  me: () => get('/auth/me'),
};

// --- Agent Dashboard API (truth-grounded, auto-refresh) ---
export const dashboardApi = {
  agents: () => get('/dashboard/agents'),
  health: () => get('/dashboard/health'),
};

// --- Coding Agent (separate base URL: /api/coding, not /api/social) ---
const codingGet = async (path, params) => {
  const headers = await getHeaders();
  const url = buildUrl(path, params, CODING_BASE_URL);
  const response = await fetch(url, { method: 'GET', headers });
  return response.json();
};
const codingPost = async (path, body) => {
  const headers = await getHeaders();
  const url = buildUrl(path, undefined, CODING_BASE_URL);
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return response.json();
};
export const codingApi = {
  goals: (params) => codingGet('/goals', params),
  goal: (id) => codingGet(`/goals/${id}`),
  optIn: (userId) => codingPost(`/opt-in/${userId}`, {}),
  optOut: (userId) => codingPost(`/opt-out/${userId}`, {}),
  idleStats: () => codingGet('/idle-stats'),
};

// --- Unified Goals API (all goal types) ---
const goalsGet = async (path, params) => {
  const headers = await getHeaders();
  const url = buildUrl(path, params, GOALS_BASE_URL);
  const response = await fetch(url, { method: 'GET', headers });
  return response.json();
};
const goalsPost = async (path, body) => {
  const headers = await getHeaders();
  const url = buildUrl(path, undefined, GOALS_BASE_URL);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
};
export const goalsApi = {
  list: (params) => goalsGet('', params),
  get: (id) => goalsGet(`/${id}`),
  create: (data) => goalsPost('', data),
};

// --- Commercial Intelligence API ---
const intelGet = async (path, params) => {
  const headers = await getHeaders();
  // Also attach X-API-Key if stored
  try {
    const apiKey = await AsyncStorage.getItem('intelligence_api_key');
    if (apiKey) headers['X-API-Key'] = apiKey;
  } catch (_) {}
  const url = buildUrl(path, params, INTELLIGENCE_BASE_URL);
  const response = await fetch(url, { method: 'GET', headers });
  return response.json();
};
const intelPost = async (path, body) => {
  const headers = await getHeaders();
  try {
    const apiKey = await AsyncStorage.getItem('intelligence_api_key');
    if (apiKey) headers['X-API-Key'] = apiKey;
  } catch (_) {}
  const url = buildUrl(path, undefined, INTELLIGENCE_BASE_URL);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
};
const intelDel = async (path) => {
  const headers = await getHeaders();
  const url = buildUrl(path, undefined, INTELLIGENCE_BASE_URL);
  const response = await fetch(url, { method: 'DELETE', headers });
  return response.json();
};
export const intelligenceApi = {
  // Intelligence endpoints (X-API-Key)
  chat: (data) => intelPost('/chat', data),
  analyze: (data) => intelPost('/analyze', data),
  generate: (data) => intelPost('/generate', data),
  hivemind: (params) => intelGet('/hivemind', params),
  usage: (params) => intelGet('/usage', params),
  // Key management (JWT)
  createKey: (data) => intelPost('/keys', data),
  listKeys: () => intelGet('/keys'),
  revokeKey: (keyId) => intelDel(`/keys/${keyId}`),
};

// --- Build Distribution API ---
const buildsGet = async (path, params) => {
  const headers = await getHeaders();
  const url = buildUrl(path, params, BUILDS_BASE_URL);
  const response = await fetch(url, { method: 'GET', headers });
  return response.json();
};
const buildsPost = async (path, body) => {
  const headers = await getHeaders();
  const url = buildUrl(path, undefined, BUILDS_BASE_URL);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
};
export const buildsApi = {
  purchase: (data) => buildsPost('/purchase', data),
  getDownloadUrl: (licenseId) => buildsGet(`/download/${licenseId}`),
  listLicenses: () => buildsGet('/licenses'),
  verifyLicense: (data) => buildsPost('/verify', data),
};

// --- Defensive IP / Provenance API ---
const ipGet = async (path, params) => {
  const headers = await getHeaders();
  const url = buildUrl(path, params, IP_BASE_URL);
  const response = await fetch(url, { method: 'GET', headers });
  return response.json();
};
const ipPost = async (path, body) => {
  const headers = await getHeaders();
  const url = buildUrl(path, undefined, IP_BASE_URL);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
};
export const ipApi = {
  listPublications: () => ipGet('/defensive-publications'),
  createPublication: (data) => ipPost('/defensive-publications', data),
  getProvenance: () => ipGet('/provenance'),
  getMilestone: () => ipGet('/milestone'),
};

// --- Finance API ---
export const financeApi = {
  health: () => get('/dashboard/finance/health'),
  revenueSplit: (params) => get('/dashboard/finance/revenue-split', params),
  sustainability: () => get('/dashboard/finance/sustainability'),
  inviteParticipation: (params) =>
    get('/dashboard/finance/invite-participation', params),
};

// --- Experiment Discovery ---
export const experimentsApi = {
  discover: (params) => get('/experiments/discover', params),
  list: (params) => get('/experiments', params),
  get: (id) => get(`/experiments/${id}`),
  create: (data) => post('/experiments', data),
  vote: (id, data) => post(`/experiments/${id}/vote`, data),
  metrics: (id) => get(`/experiments/${id}/metrics`),
  contribute: (id, data) => post(`/experiments/${id}/contribute`, data),
  timeline: (id) => get(`/experiments/${id}/timeline`),
  votes: (id) => get(`/experiments/${id}/votes`),
};

// --- Multiplayer Games ---
export const gamesApi = {
  catalog: (params) => get('/games/catalog', params),
  create: (data) => post('/games', data),
  list: (params) => get('/games', params),
  get: (id) => get(`/games/${id}`),
  join: (id) => post(`/games/${id}/join`, {}),
  ready: (id) => post(`/games/${id}/ready`, {}),
  start: (id) => post(`/games/${id}/start`, {}),
  move: (id, data) => post(`/games/${id}/move`, data),
  // Get a server-side AI move suggestion for solo play. Returns
  // { move, ai_user_id, difficulty }. The client is responsible for
  // submitting the returned move via gamesApi.move() in the two-step
  // dance — see HARTOS integrations/social/game_ai.py docstring for
  // Phase 1 "host plays both sides" limitation. Rejects for
  // client-authoritative engines (boardgame, phaser) — use the
  // client-side AI dispatcher in those cases (services/gameAI.js).
  aiMove: (id, { difficulty = 'medium', aiUserId = 'ai' } = {}) =>
    post(`/games/${id}/ai_move`, {
      difficulty,
      ai_user_id: aiUserId,
    }),
  leave: (id) => post(`/games/${id}/leave`, {}),
  results: (id) => get(`/games/${id}/results`),
  history: (params) => get('/games/history', params),
  quickMatch: (data) => post('/games/quick-match', data),
  fromEncounter: (encounterId, data) =>
    post(`/games/from-encounter/${encounterId}`, data),
};

// --- Share / Deep Links (enhanced with consent + stats from Hevolve.ai) ---
export const shareApi = {
  createLink: (resourceType, resourceId, isPrivate = false) =>
    post('/share/link', { resource_type: resourceType, resource_id: resourceId, is_private: isPrivate }),
  resolve: (token) => get(`/share/${token}`),
  trackView: (token) => post(`/share/${token}/view`, {}),
  checkConsent: (token) => get(`/share/${token}/check-consent`),
  grantConsent: (token) => post(`/share/${token}/consent`, {}),
  stats: () => get('/share/stats'),
};

// --- Channels (enhanced with messaging + notification routing from Nunba-HART) ---
export const channelsApi = {
  catalog: () => get('/channels/catalog'),
  bindings: () => get('/channels/bindings'),
  createBinding: (data) => post('/channels/bindings', data),
  removeBinding: (id) => del(`/channels/bindings/${id}`),
  setPreferred: (id) => patch(`/channels/bindings/${id}/preferred`, {}),
  generatePairCode: () => post('/channels/pair/generate', {}),
  verifyPairCode: (data) => post('/channels/pair/verify', data),
  presence: () => get('/channels/presence'),
  conversationHistory: (params) => get('/channels/conversations', params),
  // Send a message through a channel (Nunba-HART ChannelAdapter pattern)
  sendMessage: (data) => post('/channels/send', data),
  // Send a notification through a channel (Nunba-HART ResponseRouter pattern)
  sendNotification: (data) => post('/channels/notify', data),
  // Get channel-specific typing status
  typing: (channelType, isTyping) => post('/channels/typing', { channel_type: channelType, typing: isTyping }),
};

// --- Tracker / Hive ---
export const trackerApi = {
  listExperiments: (params) => get('/tracker/experiments', params),
  getExperiment: (postId) => get(`/tracker/experiments/${postId}`),
  getConversations: (postId) => get(`/tracker/experiments/${postId}/conversations`),
  inject: (postId, data) => post(`/tracker/experiments/${postId}/inject`, data),
  interview: (postId, data) => post(`/tracker/experiments/${postId}/interview`, data),
  dualContext: (data) => post('/tracker/dual-context', data),
  encounters: () => get('/tracker/encounters'),
};

// --- Compute Lending ---
export const computeApi = {
  optIn: () => post('/compute/opt-in', {}),
  optOut: () => post('/compute/opt-out', {}),
  status: () => get('/compute/status'),
  impact: () => get('/compute/impact'),
  communityImpact: () => get('/compute/community-impact'),
  healthCheck: () => post('/compute/health-check', {}),
};

// --- Federation (P2P content sharing — no cloud storage) ---
export const federationApi = {
  // Follow a peer HARTOS instance → they push new posts to our inbox
  followInstance: (peerId, peerUrl) =>
    post('/federation/follow', { peer_node_id: peerId, peer_url: peerUrl }),
  // Unfollow a peer instance
  unfollowInstance: (peerId) =>
    post('/federation/unfollow', { peer_node_id: peerId }),
  // Get instances we follow
  following: () => get('/federation/following'),
  // Get instances that follow us
  followers: () => get('/federation/followers'),
  // Federated feed — posts from all followed peer instances
  feed: (params) => get('/federation/feed', params),
  // Boost (re-share) a federated post to our local feed
  boost: (federatedPostId) =>
    post(`/federation/boost/${federatedPostId}`, {}),
  // Discover nearby peers (from gossip protocol)
  discoverPeers: () => get('/federation/peers'),
};

// --- Marketing Agent (auto-post on behalf of user) ---
export const marketingAgentApi = {
  // Trigger HARTOS marketing agent to create posts on user's behalf
  createAutoPostGoal: (config = {}) =>
    goalsPost('', {
      goal_type: 'marketing',
      title: 'Auto-generate community posts',
      description: 'Create engaging posts from curated social content, shared P2P via federation.',
      config_json: {
        channels: ['platform'],
        auto_post: true,
        p2p_only: true,
        ...config,
      },
      spark_budget: config.budget || 100,
    }),
  // List active marketing goals
  listGoals: (params) => goalsGet('', { ...params, goal_type: 'marketing' }),
  // Pause/resume auto-posting
  pauseGoal: (goalId) => goalsPost(`/${goalId}/pause`, {}),
  resumeGoal: (goalId) => goalsPost(`/${goalId}/resume`, {}),
};

// --- Admin / Provider Management API (base: /api/admin, not /api/social) ---
let ADMIN_BASE_URL = `${_apiBase}/api/admin`;
// Re-resolve after async base override (best-effort — the IIFE above runs early)
const getAdminBase = () => `${_apiBase}/api/admin`;

const adminGet = async (path, params) => {
  const headers = await getHeaders();
  const url = buildUrl(path, params, getAdminBase());
  const response = await fetch(url, { method: 'GET', headers });
  return response.json();
};
const adminPost = async (path, body) => {
  const headers = await getHeaders();
  const url = buildUrl(path, undefined, getAdminBase());
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
};

export const providerApi = {
  list: () => adminGet('/providers'),
  leaderboard: () => adminGet('/providers/efficiency/leaderboard'),
  gatewayStats: () => adminGet('/providers/gateway/stats'),
  resourceStats: () => adminGet('/resources/stats'),
  test: (providerId) => adminPost(`/providers/${providerId}/test`, {}),
  enable: (providerId, enabled) =>
    adminPost(`/providers/${providerId}/enable`, { enabled }),
  setApiKey: (providerId, apiKey) =>
    adminPost(`/providers/${providerId}/api-key`, { api_key: apiKey }),
};

export default encountersApi;
