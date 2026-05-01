/**
 * Native module contracts — TypeScript shape for every NativeModule
 * that shared JS imports. Single source of truth across both apps:
 * the Android Java module and the iOS Swift module BOTH satisfy these
 * signatures.
 *
 * If you add a new method on the iOS Swift side, add it here AND on
 * the Android side. Drift between the two breaks shared JS.
 */

declare module 'react-native' {
  interface NativeModulesStatic {
    OnboardingModule: OnboardingModule;
    DeviceCapabilityModule: DeviceCapabilityModule;
    LocalHartosModule: LocalHartosModule;
    PeerLinkModule: PeerLinkModule;
    AutobahnConnectionManager?: AutobahnConnectionManager;
    FleetCommandReceiver?: FleetCommandReceiver;
    MicAmplitudeModule?: MicAmplitudeModule;
    SpeechRecognizerModule?: SpeechRecognizerModule;
  }
}

// ─── OnboardingModule ────────────────────────────────────────────

export interface OnboardingModule {
  /** Resolves with the persisted user_id, or '' when not logged in. */
  getUser_id(callback: (userId: string) => void): void;

  /** Resolves with the persisted Bearer token, or '' when no session. */
  getAccessToken(callback: (token: string) => void): void;

  /**
   * Fan-out a WAMP publish through the long-lived AutobahnConnectionManager
   * session. No-op when the session isn't active. Returns void —
   * delivery is best-effort.
   */
  publishToWamp(topic: string, payload: string): void;
}

// ─── DeviceCapabilityModule ──────────────────────────────────────

export type DeviceClass = 'phone' | 'tablet' | 'tv';

export interface DeviceCapabilities {
  hasCamera: boolean;
  hasTouchscreen: boolean;
  hasMicrophone: boolean;
  hasGPS: boolean;
  hasAccelerometer: boolean;
  hasVibrator: boolean;
  hasBluetooth: boolean;
  hasTelephony: boolean;
  hasNFC: boolean;
  hasDpad: boolean;
  screenWidthDp: number;
  screenHeightDp: number;
  screenDensity: number;
  /** Android-style hex (0x00030000 == ES 3.0). On iOS reported for parity. */
  glEsVersion: number;
  hasOpenGLES3: boolean;
  /** iOS-only: Metal availability. Always true on iOS 8+. */
  hasMetal?: boolean;
  isTV: boolean;
  brand: string;
  /** Android: Build.MODEL. iOS: hardware identifier (e.g. "iPhone15,2"). */
  model: string;
  /** Android: SDK int. iOS: systemVersion string. */
  sdkVersion?: number;
  systemName?: string;
  systemVersion?: string;
}

export interface DeviceCapabilityModule {
  getDeviceType(): Promise<DeviceClass>;
  getCapabilities(): Promise<DeviceCapabilities>;
  getDeviceId(): Promise<string>;
  getDeviceName(): Promise<string>;
  isAndroidTV(): Promise<boolean>;
}

// ─── LocalHartosModule ───────────────────────────────────────────

export interface LocalHartosStatus {
  serviceRunning: boolean;
  modelDownloaded: boolean;
  activeModel: string | null;
  modelSizeMb: number;
}

export interface ComputeConditions {
  canRun: boolean;
  reason?: string;
  batteryPct?: number;
  isCharging?: boolean;
  thermalOk?: boolean;
  ramAvailableMb?: number;
}

export interface LocalHartosModule {
  getLocalStatus(): Promise<LocalHartosStatus>;
  checkComputeConditions(): Promise<ComputeConditions>;
}

// ─── PeerLinkModule ──────────────────────────────────────────────

export interface PeerLinkStatus {
  isConnected: boolean;
  isHandshakeComplete: boolean;
  currentUrl?: string;
  trustLevel?: 'SAME_USER' | 'PEER' | 'RELAY';
}

export interface PeerLinkModule {
  start(): void;
  send(channel: string, payloadJson: string): void;
  runAgent(agentType: string, inputJson: string): Promise<string>;
  getStatus(): Promise<PeerLinkStatus>;
  connectToPeer(address: string, port: number): Promise<void>;
}

// ─── Optional/event-driven modules ───────────────────────────────

export interface AutobahnConnectionManager {
  /** Direct calls are rare from JS — most fan-out goes through OnboardingModule.publishToWamp. */
}

export interface FleetCommandReceiver {
  /** RCTEventEmitter — emits 'fleetCommand' DeviceEvent. No callable methods. */
}

export interface MicAmplitudeModule {
  start(): void;
  stop(): void;
}

export interface SpeechRecognizerModule {
  start(locale: string): void;
  stop(): void;
}
