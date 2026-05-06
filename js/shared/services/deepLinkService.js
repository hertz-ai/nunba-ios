/**
 * Deep Link Service — SEO + Campaign Attribution + UTM Tracking
 *
 * Integrates patterns from Hevolve.ai web (react-helmet SEO, ShareLandingPage consent flow)
 * and Nunba-HART (channel-based routing) to provide a unified deep link system.
 *
 * Supports:
 *   - SEO-optimized share links with Open Graph metadata prefetch
 *   - UTM parameter capture and campaign attribution
 *   - Marketing flywheel deep links (referral, re-engagement, campaign)
 *   - Multi-channel link routing (determines origin channel from link metadata)
 *   - Consent-gated private links (from Hevolve.ai ShareConsentDialog pattern)
 *   - Deferred deep links for unauthenticated users
 */

import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shareApi, referralsApi, campaignsApi } from './socialApi';

// ── Storage Keys ──────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  UTM_DATA: 'hevolve_utm_data',
  DEFERRED_LINK: 'hevolve_deferred_deep_link',
  ATTRIBUTION: 'hevolve_attribution',
  REFERRAL_CODE: 'hevolve_referral_code',
  CAMPAIGN_TOUCH: 'hevolve_campaign_touch',
};

// ── Resource Type → Screen Mapping (extended from ShareLandingScreen) ─────────
const RESOURCE_ROUTE_MAP = {
  post:         { screen: 'PostDetail',        paramKey: 'postId' },
  profile:      { screen: 'Profile',           paramKey: 'userId' },
  user:         { screen: 'Profile',           paramKey: 'userId' },
  community:    { screen: 'CommunityDetail',   paramKey: 'communityId' },
  submolt:      { screen: 'CommunityDetail',   paramKey: 'communityId' },
  recipe:       { screen: 'RecipeDetail',      paramKey: 'recipeId' },
  game:         { screen: 'GameHub',           paramKey: 'gameId' },
  kids_game:    { screen: 'KidsGame',          paramKey: 'gameId' },
  challenge:    { screen: 'ChallengeDetail',   paramKey: 'challengeId' },
  campaign:     { screen: 'CampaignDetail',    paramKey: 'campaignId' },
  experiment:   { screen: 'ExperimentDiscovery', paramKey: 'experimentId' },
  agent:        { screen: 'AgentHiveDetail',   paramKey: 'agentId' },
  season:       { screen: 'Season',            paramKey: 'seasonId' },
  region:       { screen: 'RegionDetail',      paramKey: 'regionId' },
  achievement:  { screen: 'Achievements',      paramKey: 'achievementId' },
  channel:      { screen: 'ChannelBindings',   paramKey: 'channelType' },
  conversation: { screen: 'ConversationHistory', paramKey: 'channelType' },
};

// ── Campaign Deep Link Types ──────────────────────────────────────────────────
const CAMPAIGN_LINK_TYPES = {
  REFERRAL: 'referral',
  RE_ENGAGEMENT: 're_engagement',
  PROMOTION: 'promotion',
  SEASONAL: 'seasonal',
  ACHIEVEMENT: 'achievement',
  STREAK_RECOVERY: 'streak_recovery',
  CONTENT_SHARE: 'content_share',
  AGENT_INVITE: 'agent_invite',
};

// ── UTM Parameter Parser ──────────────────────────────────────────────────────
function parseUTMParams(url) {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const utm = {};
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    utmKeys.forEach((key) => {
      const val = params.get(key);
      if (val) utm[key] = val;
    });
    // Hevolve-specific params
    const ref = params.get('ref');
    if (ref) utm.referral_code = ref;
    const cid = params.get('cid');
    if (cid) utm.campaign_id = cid;
    const ch = params.get('ch');
    if (ch) utm.source_channel = ch;
    return Object.keys(utm).length > 0 ? utm : null;
  } catch {
    return null;
  }
}

// ── URL Path Parser ───────────────────────────────────────────────────────────
function parseLinkPath(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Share token: /s/:token
    const shareMatch = path.match(/^\/s\/([A-Za-z0-9_-]+)/);
    if (shareMatch) return { type: 'share', token: shareMatch[1] };

    // Invite/referral: /invite/:code
    const inviteMatch = path.match(/^\/invite\/([A-Za-z0-9_-]+)/);
    if (inviteMatch) return { type: 'invite', code: inviteMatch[1] };

    // Phase 7c.2 — community / conversation invite: /i/:code
    // Distinct namespace from /invite/ (referrals) so the two
    // backends never collide.  See Plan F.14 + D.10 wireframe.
    const communityInviteMatch = path.match(/^\/i\/([A-Za-z0-9_-]+)/);
    if (communityInviteMatch) {
      return { type: 'community_invite', code: communityInviteMatch[1] };
    }

    // Campaign: /c/:campaignId
    const campaignMatch = path.match(/^\/c\/([A-Za-z0-9_-]+)/);
    if (campaignMatch) return { type: 'campaign', campaignId: campaignMatch[1] };

    // Direct resource: /r/:resourceType/:resourceId
    const resourceMatch = path.match(/^\/r\/([a-z_]+)\/([A-Za-z0-9_-]+)/);
    if (resourceMatch) return { type: 'resource', resourceType: resourceMatch[1], resourceId: resourceMatch[2] };

    return null;
  } catch {
    return null;
  }
}

// ── Custom Scheme Parser ──────────────────────────────────────────────────────
function parseCustomScheme(url) {
  try {
    // hevolve://share/:token
    const shareMatch = url.match(/^hevolve:\/\/share\/([A-Za-z0-9_-]+)/);
    if (shareMatch) return { type: 'share', token: shareMatch[1] };

    // hevolve://invite/:code
    const inviteMatch = url.match(/^hevolve:\/\/invite\/([A-Za-z0-9_-]+)/);
    if (inviteMatch) return { type: 'invite', code: inviteMatch[1] };

    // Phase 7c.2 — hevolve://i/:code (community/conversation invite)
    const communityInviteMatch = url.match(/^hevolve:\/\/i\/([A-Za-z0-9_-]+)/);
    if (communityInviteMatch) {
      return { type: 'community_invite', code: communityInviteMatch[1] };
    }

    // hevolve://campaign/:id
    const campaignMatch = url.match(/^hevolve:\/\/campaign\/([A-Za-z0-9_-]+)/);
    if (campaignMatch) return { type: 'campaign', campaignId: campaignMatch[1] };

    // hevolve://channel/:channelType
    const channelMatch = url.match(/^hevolve:\/\/channel\/([a-z_]+)/);
    if (channelMatch) return { type: 'resource', resourceType: 'channel', resourceId: channelMatch[1] };

    // hevolve://r/:type/:id (generic resource)
    const resourceMatch = url.match(/^hevolve:\/\/r\/([a-z_]+)\/([A-Za-z0-9_-]+)/);
    if (resourceMatch) return { type: 'resource', resourceType: resourceMatch[1], resourceId: resourceMatch[2] };

    return null;
  } catch {
    return null;
  }
}

// ── Main Deep Link Service ────────────────────────────────────────────────────
class DeepLinkService {
  constructor() {
    this._listeners = [];
    this._navigationRef = null;
    this._isAuthenticated = false;
  }

  /**
   * Initialize deep link handling. Call once from App.js after navigation is ready.
   * @param {object} navigationRef - React Navigation ref
   * @param {boolean} isAuthenticated - Whether user is logged in
   */
  init(navigationRef, isAuthenticated = false) {
    this._navigationRef = navigationRef;
    this._isAuthenticated = isAuthenticated;

    // Handle initial URL (cold start from deep link)
    Linking.getInitialURL().then((url) => {
      if (url) this.handleDeepLink(url);
    });

    // Handle URLs while app is open (warm start)
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url) this.handleDeepLink(url);
    });
    this._listeners.push(sub);
  }

  /**
   * Update auth state. After login, process any deferred deep links.
   */
  async setAuthenticated(isAuthenticated) {
    this._isAuthenticated = isAuthenticated;
    if (isAuthenticated) {
      await this._processDeferredLink();
    }
  }

  /**
   * Main entry point for handling any deep link URL.
   */
  async handleDeepLink(url) {
    if (!url) return null;

    // 1. Capture UTM parameters for attribution
    const utmData = parseUTMParams(url);
    if (utmData) {
      await this._saveAttribution(utmData);
    }

    // 2. Parse the link
    const isCustomScheme = url.startsWith('hevolve://');
    const parsed = isCustomScheme ? parseCustomScheme(url) : parseLinkPath(url);

    if (!parsed) return null;

    // 3. If not authenticated, defer the link
    // Both 'invite' (referral) and 'community_invite' carry codes
    // safe to capture pre-auth — apply on next signup/login.
    const safePreAuth = parsed.type === 'invite' || parsed.type === 'community_invite';
    if (!this._isAuthenticated && !safePreAuth) {
      await AsyncStorage.setItem(STORAGE_KEYS.DEFERRED_LINK, JSON.stringify({ url, parsed, utmData, ts: Date.now() }));
      return { deferred: true, parsed };
    }

    // 4. Handle by link type
    switch (parsed.type) {
      case 'share':
        return this._handleShareLink(parsed.token, utmData);
      case 'invite':
        return this._handleInviteLink(parsed.code, utmData);
      case 'community_invite':
        return this._handleCommunityInviteLink(parsed.code, utmData);
      case 'campaign':
        return this._handleCampaignLink(parsed.campaignId, utmData);
      case 'resource':
        return this._handleResourceLink(parsed.resourceType, parsed.resourceId, utmData);
      default:
        return null;
    }
  }

  /**
   * Phase 7c.2 — community / conversation invite link handler.
   *
   * Resolves the invite_code via invitesApi.resolveCode, then either:
   *   - If authenticated → navigates to the InvitesScreen with the
   *     resolved row pre-loaded so the user can Accept / Reject.
   *   - If unauthenticated → stores the code so signup can apply it.
   *
   * Different from _handleInviteLink (referrals): this targets the
   * Phase 7c.2 InviteService backend, NOT the legacy referrals system.
   */
  async _handleCommunityInviteLink(code, utmData) {
    try {
      // Capture for deferred apply on signup, even when authenticated —
      // mirrors the share-link consent pattern.  Storing under a
      // distinct key so it doesn't collide with the referrals code.
      await AsyncStorage.setItem(
        STORAGE_KEYS.COMMUNITY_INVITE_CODE || 'community_invite_code',
        code,
      );
      if (utmData) {
        await this._trackCampaignTouch('community_invite_click', {
          invite_code: code, ...utmData,
        });
      }
      if (!this._isAuthenticated) {
        return { type: 'community_invite', code, applied: false };
      }
      // Resolve to determine community vs conversation; lazy-import
      // to keep the cold-start cost off this module's import chain.
      const { invitesApi } = await import('./socialApi');
      const r = await invitesApi.resolveCode(code);
      const data = r?.data || r;
      // Navigate to the invites screen with the resolved row.
      return this._navigate('Invites', { resolvedInvite: data });
    } catch (err) {
      return {
        error: err?.response?.status === 404
          ? 'Invite expired or invalid'
          : 'Failed to resolve invite',
      };
    }
  }

  /**
   * Resolve a share token → resource → navigate.
   * Matches Hevolve.ai ShareLandingPage flow (resolve → consent check → navigate).
   */
  async _handleShareLink(token, utmData) {
    try {
      const res = await shareApi.resolve(token);
      const data = res?.data || res;

      // Track view (fire-and-forget)
      shareApi.trackView(token).catch(() => {});

      // Track attribution
      if (utmData) {
        await this._trackCampaignTouch('share_click', { token, ...utmData });
      }

      const resourceType = data?.resource_type || data?.type;
      const resourceId = data?.resource_id || data?.id;
      const requiresConsent = data?.requires_consent;
      const ogData = data?.og; // Open Graph metadata from backend

      if (requiresConsent) {
        // Navigate to consent screen first (mirrors Hevolve.ai ShareConsentDialog)
        return this._navigate('ShareLanding', {
          token,
          requiresConsent: true,
          ogData,
          resourceType,
          resourceId,
        });
      }

      if (!resourceType || !resourceId) {
        return { error: 'Invalid or expired share link' };
      }

      return this._navigateToResource(resourceType, resourceId);
    } catch (err) {
      return { error: err?.response?.status === 404 ? 'Link expired' : 'Failed to resolve link' };
    }
  }

  /**
   * Handle referral invite deep link.
   * Mirrors Hevolve.ai useReferral hook: capture code → store → apply on signup.
   */
  async _handleInviteLink(code, utmData) {
    try {
      // Store referral code (persists through signup flow)
      await AsyncStorage.setItem(STORAGE_KEYS.REFERRAL_CODE, code);

      // Track attribution
      await this._trackCampaignTouch('referral_click', {
        referral_code: code,
        ...utmData,
      });

      // If authenticated, apply immediately
      if (this._isAuthenticated) {
        try {
          await referralsApi.use({ code });
        } catch {
          // May fail if already used — that's fine
        }
      }

      return { type: 'invite', code, applied: this._isAuthenticated };
    } catch {
      return { error: 'Failed to process invite' };
    }
  }

  /**
   * Handle campaign-specific deep links with full attribution tracking.
   */
  async _handleCampaignLink(campaignId, utmData) {
    try {
      await this._trackCampaignTouch('campaign_click', {
        campaign_id: campaignId,
        ...utmData,
      });

      // Fetch campaign details to determine destination
      const campaign = await campaignsApi.get(campaignId);
      const data = campaign?.data || campaign;

      if (data?.target_screen) {
        return this._navigate(data.target_screen, data.target_params || {});
      }

      return this._navigate('CampaignDetail', { campaignId });
    } catch {
      return this._navigate('Campaigns', {});
    }
  }

  /**
   * Handle direct resource navigation.
   */
  _handleResourceLink(resourceType, resourceId, utmData) {
    if (utmData) {
      this._trackCampaignTouch('direct_link_click', {
        resource_type: resourceType,
        resource_id: resourceId,
        ...utmData,
      });
    }
    return this._navigateToResource(resourceType, resourceId);
  }

  /**
   * Navigate to a resource using the RESOURCE_ROUTE_MAP.
   */
  _navigateToResource(resourceType, resourceId) {
    const mapping = RESOURCE_ROUTE_MAP[resourceType];
    if (!mapping) {
      return { error: `Unsupported resource type: ${resourceType}` };
    }
    return this._navigate(mapping.screen, { [mapping.paramKey]: resourceId });
  }

  /**
   * Navigate using React Navigation ref.
   * PUBLIC: used by fleetCommandHandler (ui_navigate cmd) + internal deep link flows.
   * deepLinkService is the sole owner of the navigationRef — all other services
   * MUST go through this method, not reach into the ref directly.
   */
  navigate(screen, params) {
    return this._navigate(screen, params);
  }

  /**
   * Check if navigation is ready (ref is attached to a mounted NavigationContainer).
   */
  isNavigationReady() {
    return !!(this._navigationRef && this._navigationRef.current);
  }

  /**
   * Navigate using React Navigation ref (internal).
   */
  _navigate(screen, params) {
    if (this._navigationRef?.current) {
      this._navigationRef.current.navigate(screen, params);
      return { navigated: true, screen, params };
    }
    return { error: 'Navigation not ready' };
  }

  // ── Attribution & Tracking ────────────────────────────────────────────────

  async _saveAttribution(utmData) {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.ATTRIBUTION);
      const attributions = existing ? JSON.parse(existing) : [];
      attributions.push({ ...utmData, ts: Date.now() });
      // Keep last 20 attribution touches
      const trimmed = attributions.slice(-20);
      await AsyncStorage.setItem(STORAGE_KEYS.ATTRIBUTION, JSON.stringify(trimmed));

      // Also save latest UTM data for easy access
      await AsyncStorage.setItem(STORAGE_KEYS.UTM_DATA, JSON.stringify(utmData));
    } catch {
      // silent
    }
  }

  async _trackCampaignTouch(action, data) {
    try {
      const touch = { action, ...data, ts: Date.now(), platform: 'react_native' };
      await AsyncStorage.setItem(STORAGE_KEYS.CAMPAIGN_TOUCH, JSON.stringify(touch));
    } catch {
      // silent
    }
  }

  /**
   * Process deferred deep link after authentication.
   */
  async _processDeferredLink() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEFERRED_LINK);
      if (!stored) return;
      const { url, ts } = JSON.parse(stored);
      // Only process if less than 24 hours old
      if (Date.now() - ts > 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(STORAGE_KEYS.DEFERRED_LINK);
        return;
      }
      await AsyncStorage.removeItem(STORAGE_KEYS.DEFERRED_LINK);
      await this.handleDeepLink(url);
    } catch {
      // silent
    }
  }

  // ── Link Generation (for sharing from the app) ────────────────────────────

  /**
   * Create a shareable deep link for content.
   * Uses shareApi.createLink + adds UTM params for marketing flywheel tracking.
   */
  async createShareLink(resourceType, resourceId, options = {}) {
    const { isPrivate = false, campaign, channel, medium = 'share' } = options;
    try {
      const res = await shareApi.createLink(resourceType, resourceId, isPrivate);
      const data = res?.data || res;
      const token = data?.token || data?.share_token;
      if (!token) return null;

      // Build full URL with UTM params
      let url = `https://hevolve.ai/s/${token}`;
      const utmParams = [];
      utmParams.push(`utm_source=hevolve_app`);
      utmParams.push(`utm_medium=${medium}`);
      if (campaign) utmParams.push(`utm_campaign=${campaign}`);
      if (channel) utmParams.push(`ch=${channel}`);
      utmParams.push(`utm_content=${resourceType}_${resourceId}`);
      url += `?${utmParams.join('&')}`;

      return {
        url,
        token,
        customSchemeUrl: `hevolve://share/${token}`,
        resourceType,
        resourceId,
      };
    } catch {
      return null;
    }
  }

  /**
   * Create a referral invite link with attribution.
   */
  async createReferralLink(referralCode) {
    const url = `https://hevolve.app/invite/${referralCode}?utm_source=hevolve_app&utm_medium=referral&utm_campaign=user_referral`;
    return {
      url,
      customSchemeUrl: `hevolve://invite/${referralCode}`,
      code: referralCode,
    };
  }

  /**
   * Create a campaign deep link with full tracking params.
   */
  createCampaignLink(campaignId, options = {}) {
    const { source = 'push', medium = 'notification', content = '' } = options;
    const utmStr = `utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaignId}`;
    const contentParam = content ? `&utm_content=${content}` : '';
    return {
      url: `https://hevolve.ai/c/${campaignId}?${utmStr}${contentParam}`,
      customSchemeUrl: `hevolve://campaign/${campaignId}`,
      campaignId,
    };
  }

  // ── SEO Metadata ──────────────────────────────────────────────────────────

  /**
   * Get Open Graph metadata for a share link (prefetched from backend).
   * Used by the web landing page for SEO + app preview cards.
   */
  async getShareMetadata(token) {
    try {
      const res = await shareApi.resolve(token);
      const data = res?.data || res;
      return {
        title: data?.og?.title || data?.title || 'Shared on Hevolve',
        description: data?.og?.description || data?.description || 'Check out this content on Hevolve.ai',
        image: data?.og?.image || null,
        url: `https://hevolve.ai/s/${token}`,
        type: data?.resource_type || 'website',
      };
    } catch {
      return null;
    }
  }

  // ── Attribution Retrieval ─────────────────────────────────────────────────

  /**
   * Get the latest attribution data (for sending with API calls).
   */
  async getAttribution() {
    try {
      const utmStr = await AsyncStorage.getItem(STORAGE_KEYS.UTM_DATA);
      const refCode = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_CODE);
      return {
        utm: utmStr ? JSON.parse(utmStr) : null,
        referralCode: refCode,
      };
    } catch {
      return { utm: null, referralCode: null };
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    this._listeners.forEach((sub) => {
      if (sub?.remove) sub.remove();
    });
    this._listeners = [];
  }
}

// ── Linking Configuration for React Navigation ──────────────────────────────
// Use this in NavigationContainer: <NavigationContainer linking={linkingConfig}>
export const linkingConfig = {
  prefixes: [
    'hevolve://',
    'https://hevolve.ai',
    'https://hevolve.app',
  ],
  config: {
    screens: {
      ShareLanding: {
        path: 's/:token',
        parse: { token: String },
      },
      PostDetail: 'r/post/:postId',
      Profile: 'r/profile/:userId',
      CommunityDetail: 'r/community/:communityId',
      RecipeDetail: 'r/recipe/:recipeId',
      GameHub: 'r/game/:gameId',
      KidsGame: 'r/kids_game/:gameId',
      ChallengeDetail: 'r/challenge/:challengeId',
      CampaignDetail: 'r/campaign/:campaignId',
      ExperimentDiscovery: 'r/experiment/:experimentId',
      AgentHiveDetail: 'r/agent/:agentId',
      Season: 'r/season/:seasonId',
      RegionDetail: 'r/region/:regionId',
      ChannelBindings: 'channel/:channelType',
      ConversationHistory: 'conversation/:channelType',
      Campaigns: 'campaigns',
      Notifications: 'notifications',
    },
  },
};

// Singleton
const deepLinkService = new DeepLinkService();
export { RESOURCE_ROUTE_MAP, CAMPAIGN_LINK_TYPES, STORAGE_KEYS };
export default deepLinkService;
