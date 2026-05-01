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
| `views/OnboardingModule.java` | `Modules/OnboardingModule.swift` | ✅ | 3 of ~50 methods ported (the ones JS actually calls). Keychain-backed token, UserDefaults user_id. |
| `views/DeviceCapabilityModule.java` | `Modules/DeviceCapabilityModule.swift` | ✅ | All 5 methods ported. UIDevice, UIScreen, Keychain UUID, hardware identifier via `utsname()`. |
| `managers/AutobahnConnectionManager.java` | `Modules/AutobahnConnectionManager.swift` | 🟡 | Stub with `.shared` + `publish/subscribe` signatures. Real WAMP transport pending — see #169. URLSessionWebSocketTask + WAMP-2 protocol over MessagePack/JSON. |
| `peerlink/PeerLinkModule.java` | `Modules/PeerLinkModule.swift` | 🟦 | 7-file Kotlin/Java stack. Port plan: 1 Swift file using CryptoKit for Ed25519/X25519/AES-GCM, URLSessionWebSocket for transport. See #170. |
| `localhartos/LocalHartosModule.java` | `Modules/LocalHartosModule.swift` | 🟦 | URLSession to localhost:6777 health check. Battery via UIDevice.batteryLevel, thermal via ProcessInfo.thermalState, RAM via `host_statistics64`. See #171. |
| `mic/MicAmplitudeModule.java` | `Modules/MicAmplitudeModule.swift` | 🟦 | AVAudioEngine input tap → RMS amplitude → DeviceEventEmitter. |
| `mic/SpeechRecognizerModule.java` | `Modules/SpeechRecognizerModule.swift` | 🟦 | SFSpeechRecognizer (Speech framework). Different permission model from Android. |
| `views/ActivityStarterModule.java` | _N/A_ | ❌ | Android-specific intent launcher. iOS uses URL schemes / UIApplication.openURL — handled by RN's built-in `Linking` module. |
| `views/WearDataSyncModule.java` | _N/A_ | ❌ | Wear OS Data Layer. Apple Watch is a separate WatchOS project (WatchConnectivity framework, different paradigm). Out of scope. |
| `MyFirebaseMessagingService.java` | `Modules/FleetCommandReceiver.swift` | 🟡 | Stub. APNs entry in `AppDelegate.didReceiveRemoteNotification` lands under #172. |
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

## Port priority queue

1. **AutobahnConnectionManager** (#169) — blocks WAMP-driven services (computePolicy, fleetCommand fan-out).
2. **LocalHartosModule** (#171) — blocks compute cascade tier-1 detection.
3. **PeerLinkModule** (#170) — blocks LAN peer discovery and same-user tier 2/3 cascade.
4. **FleetCommandReceiver** APNs wiring (#172) — blocks remote-notification fleet commands.
5. **MicAmplitudeModule** + **SpeechRecognizerModule** — blocks voice query feature.

After those 5, the JS surface layered above (services/socialApi.js etc.)
should run end-to-end on iOS.
