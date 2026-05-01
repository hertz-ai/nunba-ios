# Native Module Port Manifest

Inventory of every Android native module/manager and its iOS port
status. Single source of truth for "what's left."

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done — Swift impl + XCTest cases |
| 🟡 | Stub — file exists with TODO, not yet functional |
| 🟦 | Pending — file not yet created |
| ❌ | Dropped — out of scope on iOS |

## Modules surfaced to JS via `NativeModules.X`

| Android source | iOS target | Status | Notes |
|----------------|-----------|--------|-------|
| `views/OnboardingModule.java` | `Modules/OnboardingModule.swift` | ✅ | 3 of ~50 methods ported (the ones JS actually calls). Keychain-backed token, UserDefaults user_id. **14 XCTest cases.** |
| `views/DeviceCapabilityModule.java` | `Modules/DeviceCapabilityModule.swift` | ✅ | All 5 methods ported. UIDevice, UIScreen, Keychain UUID, hardware identifier via `utsname()`. **17 XCTest cases.** |
| `managers/AutobahnConnectionManager.java` | `Modules/AutobahnConnectionManager.swift` | ✅ | Full WAMP-2 client. URLSessionWebSocketTask transport, HELLO/WELCOME/SUBSCRIBE/PUBLISH/EVENT message types, exponential reconnect with full jitter, fleet-topic auto-subscribe on join. **17 XCTest cases.** |
| `peerlink/PeerLinkModule.java` + 7 supporting Kotlin files | `Modules/PeerLinkModule.swift` + `PeerLinkCrypto.swift` | ✅ | Consolidated into 2 Swift files. CryptoKit Ed25519/X25519/AES-GCM/HKDF-SHA256, URLSessionWebSocketTask transport, handshake (hello/hello_ack), per-channel encryption for sensitive channels (consent/fleet/credentials), 12 RN-bridged methods, request/reply correlation for runAgent. **34 XCTest cases (20 crypto + 14 bridge).** |
| `localhartos/LocalHartosModule.java` | `Modules/LocalHartosModule.swift` | ✅ | All 11 methods. URLSession health check w/ 500ms timeout, battery via UIDevice.batteryLevel, thermal via ProcessInfo.thermalState, RAM via `host_statistics64`, storage via volumeAvailableCapacityForImportantUsageKey. Model-management methods stub (no on-device LLM in this build) but match contract. **15 XCTest cases.** |
| `mic/MicAmplitudeModule.java` | `Modules/MicAmplitudeModule.swift` | ✅ | AVAudioEngine input tap, RMS → dB-floor amplitude mapping, throttled emit at 10Hz. **12 XCTest cases (pure-math + lifecycle).** |
| `mic/SpeechRecognizerModule.java` | `Modules/SpeechRecognizerModule.swift` | ✅ | SFSpeechRecognizer, dual-permission flow (Speech + Microphone), partial+final results via DeviceEventEmitter. **8 XCTest cases.** |
| `views/ActivityStarterModule.java` | _N/A_ | ❌ | Android-specific intent launcher. iOS uses URL schemes / UIApplication.openURL — handled by RN's built-in `Linking` module. |
| `views/WearDataSyncModule.java` | _N/A_ | ❌ | Wear OS Data Layer. Apple Watch is a separate WatchOS project (WatchConnectivity framework, different paradigm). Out of scope. |
| `MyFirebaseMessagingService.java` | `Modules/FleetCommandReceiver.swift` | ✅ | APNs entry wired in `AppDelegate.didReceiveRemoteNotification`. Parses cmd_type, validates against allowlist (6 types), emits 'fleetCommand' DeviceEvent, capped 20-entry history for cold-start replay. **18 XCTest cases.** |
| `MyFirebaseInstanceIDService.java` | _N/A_ | ❌ | iOS APNs token comes from `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)` — different lifecycle. Handled in AppDelegate. |

## Helper managers (internal, not RN-exposed)

| Android | iOS equivalent | Status |
|---------|---------------|--------|
| `managers/ActivityManager.java` | _N/A_ | ❌ Android lifecycle; iOS uses UIApplication delegate. |
| `managers/ConnectionManager.java` | URLSession (built-in) | ❌ No port needed. |
| `managers/DeviceControlManager.java` | _N/A_ | ❌ Android-specific (volume, screen). UIKit equivalents. |
| `managers/ExceptionManager.java` | _N/A_ | ❌ Use NSException + RCTLog. |
| `managers/GlideManager.java`, `glide/HevolveGlideModule.java` | RN's react-native-fast-image or RCTImageLoader | ❌ No port. |
| `managers/ResourcesManager.java` | Asset catalog | ❌ Use `Bundle.main` + Assets.xcassets. |
| `managers/RetrofitManager.java` | URLSession | ❌ No port. |
| `managers/SharedPrefManager.java` | UserDefaults / Keychain | ❌ Use directly per call site. |
| `managers/ThreadManager.java` | DispatchQueue | ❌ Use directly. |

## Components dropped entirely (out of scope on iOS)

| Android | Reason |
|---------|--------|
| `wear/` (Wear OS module, ~30 Kotlin files) | Apple Watch is a separate WatchOS project. |
| TV launcher activity, `TVHomeScreen.js`, Leanback components | tvOS is a separate target (different SDK). |
| `glSurface/` (OpenGL ES 3.0 avatar renderer) | iOS deprecated OpenGL ES; needs Metal port — future phase. |
| `llama.cpp/` Android JNI build | iOS would use llama.cpp as a Swift package or pre-built XCFramework — separate effort. |
| FCM-specific tooling (`MyFirebaseInstanceIDService`, FCM data-message routing) | Replaced by APNs in `AppDelegate` + `FleetCommandReceiver`. |
| Bluetooth/NFC bridges (Android-specific APIs) | iOS has CoreBluetooth + CoreNFC — port if/when JS actually requires. |

## Method-level coverage (modules in ✅ status)

### OnboardingModule

| Method | Android | iOS | XCTest |
|--------|---------|-----|--------|
| `getUser_id(callback)` | ✅ | ✅ | ✅ |
| `getAccessToken(callback)` | ✅ | ✅ | ✅ |
| `publishToWamp(topic, payload)` | ✅ | ✅ (forwards to AutobahnConnectionManager) | ✅ |
| ~50 other methods (signup state, theme, parental info) | ✅ | ❌ Not ported | _N/A_ |

The unported methods drive the legacy signup flow. iOS implementation will
add them as the JS layer starts using them. For now, every `OnboardingModule.X`
call from shared JS that ISN'T one of the three above will return
`undefined` at the JS bridge — same behavior the Android app exhibits
when called before login completes.

### DeviceCapabilityModule

| Method | Android | iOS | XCTest |
|--------|---------|-----|--------|
| `getDeviceType()` | ✅ | ✅ | ✅ |
| `getCapabilities()` | ✅ | ✅ | ✅ |
| `getDeviceId()` | ✅ | ✅ | ✅ |
| `getDeviceName()` | ✅ | ✅ | ✅ |
| `isAndroidTV()` | ✅ | ✅ (always false on iOS) | ✅ |

## Status as of latest commit

**All Tier-1 native modules: ✅ done.** 6 modules ported with full
XCTest coverage (135+ test cases across 8 test files):

- OnboardingModule (14 tests)
- DeviceCapabilityModule (17 tests)
- AutobahnConnectionManager (17 tests, WAMP-2)
- PeerLinkModule + PeerLinkCrypto (34 tests, CryptoKit-based)
- LocalHartosModule (15 tests)
- FleetCommandReceiver (18 tests, APNs wired)
- MicAmplitudeModule (12 tests)
- SpeechRecognizerModule (8 tests)

**Tier-3 App Store readiness: partial.**

- ✅ PrivacyInfo.xcprivacy with required-reason API declarations
- ✅ Release configuration in project.yml (wholemodule opt, dead-code-stripping)
- ✅ Assets.xcassets with placeholder AppIcon + AccentColor
- ✅ URL scheme registered (hevolve://, nunba://)
- ❌ Code signing — needs Apple Developer team ID
- ❌ Provisioning profiles
- ❌ Final app icon artwork (placeholder is functional)
- ❌ Splash screen artwork (text-only LaunchScreen.storyboard)
- ❌ App Store screenshots + metadata

**Tier-2 navigation + features: minimal scaffold.**

- ✅ React Navigation NativeStack with 4 placeholder routes
- ✅ Deep linking config matching Android's contract
- ❌ ~200 React components from Android repo NOT yet copied
- ❌ Signup flow not ported
- ❌ Camera (QR scan) not wired
- ❌ Location services not wired
- ❌ Background BLE not wired

**Tier-4 advanced: not started.**

- ❌ OpenGL ES 3.0 avatar renderer → Metal port
- ❌ llama.cpp on-device LLM (XCFramework needed)
- ❌ Real Bonjour/mDNS peer discovery (PeerLink stubs cloud-only)

## Test coverage

| Surface | Tests |
|---------|-------|
| iOS native (XCTest) | 135+ unit tests across 8 files |
| iOS UI (XCUITest) | 2 smoke tests (launch, dual-launch) |
| JS scripts (Jest) | 17 tests (validate-manifest + sync-from-android) |
