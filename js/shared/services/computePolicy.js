/**
 * Compute Policy — 5-tier intelligent routing cascade for AI workloads.
 *
 * Cascade (best available at any point):
 *   1. LOCAL — on-device 0.8B LLM (no network, lowest latency)
 *   2. SAME_USER_LAN — same-login HARTOS on LAN via PeerLink (high compute, low latency)
 *   3. SAME_USER_WAN — same-login HARTOS over internet via PeerLink (high compute)
 *   4. REGIONAL — regional HARTOS node via gossip/mesh (shared compute)
 *   5. CLOUD_CENTRAL — cloud central instance azurekong (last resort)
 *
 * The cascade is dynamic: if tier 1 can handle the task, use it.
 * If the task needs more compute (complex reasoning, vision), escalate.
 * A 0.8B handles casual chat fine; recipe generation or multi-agent
 * needs a bigger model → escalate to same-login desktop HARTOS.
 *
 * No DRY: single resolveComputeTarget() used by ALL agents.
 * No hardcoded URLs: discovered dynamically via PeerLink + local health.
 */
import { NativeModules } from 'react-native';
import { getStatus, getDiscoveredPeers } from './peerLinkService';

const { PeerLinkModule, LocalHartosModule } = NativeModules;

export const ComputeTarget = {
  LOCAL: 'local',
  SAME_USER_LAN: 'same_user_lan',
  SAME_USER_WAN: 'same_user_wan',
  REGIONAL: 'regional',
  CLOUD_CENTRAL: 'cloud_central',
  OFFLINE: 'offline',
};

export const TaskComplexity = {
  TRIVIAL: 'trivial',     // Cache hit, local lookup — any tier
  SIMPLE: 'simple',       // Basic chat, recipe search — 0.8B handles this
  MODERATE: 'moderate',   // Multi-turn chat, recipe generation — 2B+ preferred
  COMPLEX: 'complex',     // Multi-agent, vision, long context — 4B+ needed
  HEAVY: 'heavy',         // Training, batch processing — desktop/cloud only
};

// Minimum model size (MB) for each complexity level
const COMPLEXITY_MODEL_THRESHOLD = {
  [TaskComplexity.TRIVIAL]: 0,      // No model needed
  [TaskComplexity.SIMPLE]: 500,     // 0.8B sufficient
  [TaskComplexity.MODERATE]: 1200,  // 2B+ preferred
  [TaskComplexity.COMPLEX]: 2800,   // 4B+ preferred
  [TaskComplexity.HEAVY]: 5000,     // 9B+ or cloud
};

/**
 * Resolve the best compute target — 5-tier cascade.
 *
 * @param {string} complexity - Task complexity (from TaskComplexity)
 * @param {object} options - { forceLocal: bool, forceCloud: bool }
 * @returns {{ target: string, url: string|null, reason: string, tier: number }}
 */
export async function resolveComputeTarget(complexity = TaskComplexity.SIMPLE, options = {}) {
  const { forceLocal = false, forceCloud = false } = options;

  // User explicitly wants cloud
  if (forceCloud) {
    return tier(5, ComputeTarget.CLOUD_CENTRAL, 'https://azurekong.hertzai.com', 'User requested cloud');
  }

  // --- Tier 1: LOCAL on-device ---
  // Local inference is a LUXURY, not a default. The phone must NEVER feel slow.
  // Only runs when:
  //   a) Service is already running (user explicitly started it)
  //   b) Conditions are perfect (battery ≥40% or charging, no thermal, RAM ≥1.2GB)
  //   c) Task is SIMPLE enough for the on-device model
  // If ANY condition fails → skip straight to cloud. No retry, no degraded mode.
  if (forceLocal) {
    const localStatus = await checkLocalHartos();
    if (localStatus.running) {
      const conditions = await checkComputeConditions();
      if (conditions.canRun) {
        const modelSizeMb = localStatus.modelSizeMb || 550;
        const threshold = COMPLEXITY_MODEL_THRESHOLD[complexity] || 0;
        if (modelSizeMb >= threshold) {
          return tier(1, ComputeTarget.LOCAL, 'http://localhost:6777',
            `Local ${localStatus.activeModel || '0.8B'} (${modelSizeMb}MB)`);
        }
      }
      // Conditions bad even though forced — still use local but warn
      return tier(1, ComputeTarget.LOCAL, 'http://localhost:6777', 'Forced local (conditions not ideal)');
    }
    return tier(0, ComputeTarget.OFFLINE, null, 'Local requested but no model available');
  }

  // Non-forced: only use local for TRIVIAL/SIMPLE tasks when conditions are perfect
  if (complexity === TaskComplexity.TRIVIAL || complexity === TaskComplexity.SIMPLE) {
    const localStatus = await checkLocalHartos();
    if (localStatus.running) {
      const conditions = await checkComputeConditions();
      if (conditions.canRun && conditions.isCharging) {
        // Only auto-use local when CHARGING — never drain battery for convenience
        return tier(1, ComputeTarget.LOCAL, 'http://localhost:6777',
          `Local ${localStatus.activeModel || '0.8B'} (charging, conditions ideal)`);
      }
      // Not charging or conditions not perfect → skip to cloud
    }
  }

  // --- Tier 2 & 3: SAME_USER via PeerLink (LAN then WAN) ---
  try {
    const peerStatus = await getStatus();
    if (peerStatus.isConnected && peerStatus.isHandshakeComplete) {
      const url = peerStatus.currentUrl || '';
      const isLan = url.startsWith('ws://') && !url.includes('azurekong');

      if (isLan) {
        return tier(2, ComputeTarget.SAME_USER_LAN, url,
          'Same-login HARTOS on LAN via PeerLink');
      } else if (!url.includes('azurekong')) {
        return tier(3, ComputeTarget.SAME_USER_WAN, url,
          'Same-login HARTOS over internet via PeerLink');
      }
    }

    // Check discovered peers for potential connections
    const peers = await getDiscoveredPeers();
    const lanPeer = peers.find(p => p.method === 'UDP_BEACON' || p.method === 'MDNS');
    if (lanPeer) {
      // Auto-connect to discovered LAN peer
      if (PeerLinkModule) {
        PeerLinkModule.connectToPeer(lanPeer.address, lanPeer.wsPort).catch(() => {});
      }
      return tier(2, ComputeTarget.SAME_USER_LAN, lanPeer.wsUrl,
        `Discovered HARTOS at ${lanPeer.address} (connecting)`);
    }
  } catch (e) {
    // PeerLink not available
  }

  // --- Tier 4: REGIONAL node (via gossip/mesh) ---
  // Regional nodes are discovered via PeerLink gossip protocol.
  // If we had gossip peers but not same-user, they'd be regional.
  try {
    const peers = await getDiscoveredPeers();
    const regionalPeer = peers.find(p => p.method === 'GOSSIP');
    if (regionalPeer) {
      return tier(4, ComputeTarget.REGIONAL, regionalPeer.wsUrl,
        `Regional HARTOS node at ${regionalPeer.address}`);
    }
  } catch (e) {}

  // --- Tier 5: CLOUD CENTRAL ---
  return tier(5, ComputeTarget.CLOUD_CENTRAL, 'https://azurekong.hertzai.com',
    'Cloud central (azurekong)');
}

function tier(tierNum, target, url, reason) {
  return { target, url, reason, tier: tierNum };
}

/**
 * Check local HARTOS status via LocalHartosModule.
 */
async function checkLocalHartos() {
  // First try the NativeModule (most reliable)
  if (LocalHartosModule) {
    try {
      const status = await LocalHartosModule.getLocalStatus();
      return {
        running: status.serviceRunning,
        modelDownloaded: status.modelDownloaded,
        activeModel: status.activeModel || null,
        modelSizeMb: status.modelSizeMb || 0,
      };
    } catch (e) {}
  }

  // Fallback: HTTP health check
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);
    const resp = await fetch('http://localhost:6777/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      return {
        running: true,
        modelDownloaded: true,
        activeModel: data.llama_health?.status === 'ok' ? 'local' : null,
        modelSizeMb: 550, // Assume 0.8B if health passes
      };
    }
  } catch (e) {}

  return { running: false, modelDownloaded: false, activeModel: null, modelSizeMb: 0 };
}

/**
 * Execute a compute task with automatic 5-tier cascade routing.
 *
 * @param {string} agentType - "conversation", "recipe", "fleet", "learning"
 * @param {object} input - Agent input data
 * @param {string} complexity - Task complexity level
 * @returns {Promise<object>} Agent result with transport metadata
 */
export async function executeWithPolicy(agentType, input, complexity = TaskComplexity.SIMPLE) {
  const target = await resolveComputeTarget(complexity);

  // Annotate input with routing info
  const enrichedInput = {
    ...input,
    _compute: { target: target.target, tier: target.tier, url: target.url },
  };

  // Tier 1: Local — direct HTTP to localhost:6777
  if (target.target === ComputeTarget.LOCAL) {
    const result = await executeViaHttp(target.url, agentType, enrichedInput);
    if (result && !result.error && !result.escalate) {
      return { ...result, _transport: target };
    }
    // Local failed or conditions degraded (battery/thermal/RAM) — escalate
    const fallback = await resolveComputeTarget(complexity, { forceLocal: false });
    return executeAtTarget(fallback, agentType, enrichedInput);
  }

  // Tier 2-4: PeerLink direct (LAN/WAN/Regional)
  if ([ComputeTarget.SAME_USER_LAN, ComputeTarget.SAME_USER_WAN, ComputeTarget.REGIONAL].includes(target.target)) {
    if (PeerLinkModule) {
      try {
        const result = await PeerLinkModule.runAgent(agentType, JSON.stringify(enrichedInput));
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        return { ...parsed, _transport: target };
      } catch (e) {
        // PeerLink direct failed — try WAMP relay before cloud
      }
    }
  }

  // Tier 3.5: WAMP relay — same-user HARTOS behind NAT, reachable via Crossbar
  // Both phone and HARTOS connect outbound to azurekong WAMP — no NAT issue.
  // Phone publishes compute.request.{userId}, HARTOS subscribes + responds on compute.response.{userId}.
  try {
    const relayResult = await executeViaWampRelay(agentType, enrichedInput);
    if (relayResult && !relayResult.error) {
      return { ...relayResult, _transport: tier(3, ComputeTarget.SAME_USER_WAN, 'wamp_relay', 'WAMP relay (NAT traversal)') };
    }
  } catch (e) {
    // WAMP relay failed — fall through to cloud
  }

  // Tier 5: Cloud central
  const cloudResult = await executeViaHttp('https://azurekong.hertzai.com', agentType, enrichedInput);
  return { ...cloudResult, _transport: target };
}

/**
 * Execute at a specific target (used for fallback chains).
 */
async function executeAtTarget(target, agentType, input) {
  if (target.target === ComputeTarget.OFFLINE) {
    return { status: 'offline', message: 'No compute available.', agent: agentType, _transport: target };
  }
  if ([ComputeTarget.SAME_USER_LAN, ComputeTarget.SAME_USER_WAN, ComputeTarget.REGIONAL].includes(target.target)) {
    if (PeerLinkModule) {
      try {
        const result = await PeerLinkModule.runAgent(agentType, JSON.stringify(input));
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        return { ...parsed, _transport: target };
      } catch (e) {}
    }
  }
  return executeViaHttp(target.url || 'https://azurekong.hertzai.com', agentType, input);
}

/**
 * HTTP execution — works for both local (localhost:6777) and cloud (azurekong).
 * Same /chat endpoint, same request format — zero code duplication.
 */
async function executeViaHttp(baseUrl, agentType, input) {
  try {
    let token = '';
    try {
      const { getAccessToken } = require('./apiHelpers');
      token = await getAccessToken() || '';
    } catch (e) {}

    const resp = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text: input.message || input.query || input.text || '',
        user_id: input.user_id || '',
        agent_type: agentType,
        ...input,
      }),
    });

    if (!resp.ok) {
      return { error: `HTTP ${resp.status}`, agent: agentType, transport: baseUrl };
    }

    const data = await resp.json();
    return { ...data, agent: agentType };
  } catch (e) {
    return { error: e.message, agent: agentType, transport: baseUrl };
  }
}

/**
 * Execute via WAMP relay — phone→azurekong WAMP→HARTOS behind NAT→response.
 * Same user_id scoping as fleet commands. Uses existing AutobahnConnectionManager.
 * Timeout: 60s (server-side inference can be slow).
 */
async function executeViaWampRelay(agentType, input) {
  const { NativeModules, DeviceEventEmitter } = require('react-native');
  const userId = input.user_id || '';
  if (!userId) return null;

  const requestId = `cr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Publish compute request via native WAMP
  const topic = `com.hertzai.hevolve.compute.request.${userId}`;
  const payload = JSON.stringify({
    text: input.message || input.query || input.text || '',
    user_id: userId,
    agent_type: agentType,
    request_id: requestId,
    source: 'wamp_relay',
    ...input,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      listener?.remove();
      reject(new Error('WAMP relay timeout'));
    }, 60000);

    // Listen for response on the response topic
    const listener = DeviceEventEmitter.addListener('computeResponse', (event) => {
      if (event?.request_id === requestId) {
        clearTimeout(timeout);
        listener.remove();
        resolve(event);
      }
    });

    // Publish via native AutobahnConnectionManager
    if (NativeModules.OnboardingModule?.publishToWamp) {
      NativeModules.OnboardingModule.publishToWamp(topic, payload);
    } else {
      clearTimeout(timeout);
      listener.remove();
      reject(new Error('WAMP publish not available'));
    }
  });
}

/**
 * Check device conditions for local inference.
 * Battery ≥40% OR charging, no power-save, thermal OK, RAM ≥1200MB.
 * Returns { canRun, reason, batteryPct, isCharging, thermalOk, ... }
 */
async function checkComputeConditions() {
  if (LocalHartosModule && LocalHartosModule.checkComputeConditions) {
    try {
      return await LocalHartosModule.checkComputeConditions();
    } catch (e) {}
  }
  // No native module — assume conditions are bad (don't risk it)
  return { canRun: false, reason: 'Condition checker unavailable' };
}

export default {
  ComputeTarget,
  TaskComplexity,
  resolveComputeTarget,
  executeWithPolicy,
  checkComputeConditions,
};
