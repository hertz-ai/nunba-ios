<p align="center">
  <img src="ios/NunbaCompanion/Assets.xcassets/AppIcon.appiconset/icon-1024.png" alt="Nunba" width="120" onerror="this.style.display='none'">
</p>

<h1 align="center">Nunba Companion (iOS)</h1>
<p align="center"><strong>A Friend, A Well Wisher, Your LocalMind — on iPhone and iPad.</strong></p>

<p align="center">
  <a href="https://github.com/hertz-ai/nunba-ios/actions/workflows/validate.yml"><img src="https://github.com/hertz-ai/nunba-ios/actions/workflows/validate.yml/badge.svg?branch=main" alt="validate"></a>
  <a href="https://hevolve.ai"><img src="https://img.shields.io/badge/Website-hevolve.ai-FFD700?style=for-the-badge" alt="Website"></a>
  <a href="https://docs.hevolve.ai"><img src="https://img.shields.io/badge/Docs-docs.hevolve.ai-blueviolet?style=for-the-badge" alt="Documentation"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-green?style=for-the-badge" alt="License"></a>
</p>

The iOS-native React Native client of the [**Nunba**](https://github.com/hertz-ai/Nunba) family — the privacy-first consumer companion sitting on top of [**HART OS**](https://github.com/hertz-ai/HARTOS), the *Hevolve Hive Agentic Runtime*. This repo ships the iPhone + iPad app; its sibling [`Hevolve_React_Native`](https://github.com/hertz-ai/Hevolve_React_Native) targets Android, Wear OS and Android TV; [`Nunba`](https://github.com/hertz-ai/Nunba) is the desktop installer for Windows / macOS / Linux. Same product, three platform families — by design.

> **The stack, named precisely**
> - **HART** — the bare agent engine. Headless. `pip install hart-backend`. Port `:6777`.
> - **[HART OS](https://github.com/hertz-ai/HARTOS)** — HART **+ operator/admin desktop screens** (model catalog, channel pairing, agent dashboard, hive view, thought-experiment console).
> - **[Nunba](https://github.com/hertz-ai/Nunba)** — the consumer desktop companion. Bundles HART OS inside a signed installer (Windows / macOS / Linux).
> - **[Hevolve_React_Native](https://github.com/hertz-ai/Hevolve_React_Native)** — Android (phones, Wear OS, Android TV).
> - **Nunba Companion (iOS)** *(this repo)* — iPhone + iPad. The screen iOS users actually see.

The same auto-evolve loop, federated learning, constitutional safety filter, draft-first speculative chat, multi-modal input/output, agent-as-member social, BLE encounters, and AutoEconomy that ship in Nunba desktop are exposed here through a Swift native bridge tuned for Apple platforms — APNs (not FCM), Metal (not OpenGL ES), CallKit (not ConnectionService), Multipeer Connectivity + Core Bluetooth (not Nearby Connections), Keychain Services (not Android Keystore), and Speech / AVFoundation for STT and TTS when the user opts into on-device voice.

---

## Why a separate iOS repo, not one cross-platform monorepo

`Hevolve_React_Native` (Android) carries ~100 native Java/Kotlin modules covering Wear OS data layer, Android TV Leanback, OpenGL ES 3.0 avatar renderer, WAMP Autobahn-Java, FCM data messages, BLE/NFC bridges, and a 12k-line PeerLink stack. None of that auto-ports to iOS. iOS needs its own native modules in Swift, its own APNs handler instead of FCM, its own Metal renderer instead of OpenGL ES, and its own CallKit bridge instead of Android's ConnectionService. Mixing both build systems in one repo would slow both teams and risk regressions on the working Android app.

The split is **JS-shared, native-isolated** — the JS surface is copied between repos, the platform layer stays platform-native. See [§ What is shared](#what-is-shared--what-is-not) below.

---

## What you can do with the iOS app

| Action | How |
|---|---|
| Chat with a local LLM via the Hive | Open Nunba Companion, type. The app talks to a HART OS node you trust — your desktop, a regional node on your LAN, or a friend's federated peer. ~300ms first token via the desktop's draft model. |
| Voice in / voice out | Mic button. On-device Speech.framework STT or remote Whisper for accuracy. AVSpeechSynthesizer locally; Indic Parler / Chatterbox / Kokoro / CosyVoice when routed back through your HART OS node. 22+ languages. |
| Show your agent the camera or screen | Camera + ReplayKit consent toggle. Your HART OS node's MiniCPM VLM (or any plugged-in vision provider) describes frames. |
| Encounter another Hive member nearby | Core Bluetooth + Multipeer Connectivity broadcast a rotating Ed25519 pubkey + ephemeral 24h sighting. Mutual-like → match → icebreaker draft (you approve every send). |
| Take a call with a teammate's agent in the room | CallKit-anchored 1:1 / group voice + video, with an AgentVoiceBridge participant if invited. Same call surface that ships in the desktop — just wrapped in Apple's system call UI. |
| Cross-device chat | Same conversation lands here, on the desktop, and on Android. Cursor-pull replays missed turns offline. |
| Push notifications via APNs | Mentions, friend requests, call invites, agent consent prompts, fleet commands — gated by the same Constitutional Filter that gates every server-side agent action. |
| Federate with peers | Encounters → mutual-trust → upgrade to a PeerLink (PEER trust, AES-256-GCM session). Improvements broadcast as deltas via `FederatedAggregator.broadcast_delta()`. Raw data stays local. |

---

## What is shared / what is not

**Shared (copied from `Hevolve_React_Native` into `js/`):**

- Zustand stores (gamification, kids learning, fleet command, encounters, color theme, …)
- Theme tokens + color palettes
- Game configs (`data/configs/*.json`, 105 entries)
- Pure-JS utilities, hooks, types
- React components rendered via cross-platform RN libraries (`react-native-paper`, `react-native-vector-icons`, `react-native-elements`, `react-native-reanimated`, …)
- Service-layer API clients (the JS calls `NativeModules.X.method()`; the contract is identical, the implementation is platform-specific)
- Jest tests for that JS

**iOS-specific (lives in `ios/NunbaCompanion/Modules/`):**

| Concern | Android (RN sibling) | iOS (this repo) |
|---|---|---|
| Push delivery | FCM data messages | APNs + UserNotifications |
| Renderer | OpenGL ES 3.0 | Metal |
| Storage | Android Keystore | Keychain Services |
| BLE | `android.bluetooth.le` | Core Bluetooth |
| P2P | Nearby Connections | Multipeer Connectivity |
| STT | RecognizerIntent (online) + on-device VAD | Speech.framework / Whisper bridge |
| TTS | Android TextToSpeech / Piper | AVSpeechSynthesizer (local) / HARTOS-routed (remote) |
| Calls | ConnectionService + Telecom | CallKit |
| Screen share | MediaProjection | ReplayKit Broadcast Upload Extension |
| Watch / TV / Phone form factors | Wear OS, Android TV, phone | iPhone + iPad universal (visionOS later) |

`docs/PORT_MANIFEST.md` is the ground-truth file-by-file copy log between Android and iOS — what's been mirrored, what's been deliberately skipped (Wear OS / TV / OpenGL specifics), and what's pending.

---

## Privacy, sovereignty, and the mission

The same constitutional contract that backs Nunba desktop applies here:

- **All AI runs on a HART OS node you control.** Local desktop, regional family/office node, or a friend's federated peer. iOS itself is the *client* — it never trains models or holds long-lived secrets in plaintext.
- **No telemetry.** No analytics SDKs, no third-party crash reporters, no ad attribution. The only outbound traffic is to the HART OS endpoint(s) you've paired with.
- **Conversations never enter a training corpus.** Federated deltas carry weight updates, not text.
- **Owner override.** Pause, resume, or veto any in-flight auto-evolution from the iOS admin sheet — the same pause/resume the desktop exposes.
- **Constitutional filter is in code, not policy.** `cultural_wisdom.py` ships 32 traits; `hive_guardrails.py` enforces banned-skill categories at every server-side commit. Latency loses to safety. Throughput loses to safety. Every time.
- **Mission anchor:** *AI amplifies human agency. Never concentrates power. Never enables harm. Order is safety > sovereignty > realtime > throughput.*

---

## Project layout

```
Nunba-Companion-iOS/
├── App.tsx                    React root component
├── index.js                   RN entry point (registers App)
├── package.json               iOS-only RN deps (no androidx)
├── babel.config.js
├── metro.config.js
├── jest.setup.js              Mocks NativeModules for JS tests
├── tsconfig.json              @nunba/* path alias → js/
├── app.json                   { name: "NunbaCompanion", display: "Nunba Companion" }
│
├── js/                        Shared JS (mirrored from Hevolve_React_Native)
│   ├── stores/                Zustand stores
│   ├── theme/                 Color tokens, design system
│   ├── data/configs/          Game configs (105 entries)
│   ├── components/            Cross-platform React components
│   ├── services/              API clients (call NativeModules.X)
│   ├── hooks/                 Pure-JS hooks
│   ├── utils/                 Pure-JS helpers
│   └── native-bridge/         TypeScript .d.ts contracts for each NativeModule
│
├── ios/                       Xcode project + Swift native modules
│   ├── NunbaCompanion.xcodeproj
│   ├── NunbaCompanion/
│   │   ├── AppDelegate.swift
│   │   ├── Info.plist         iPhone + iPad universal
│   │   ├── Assets.xcassets
│   │   ├── LaunchScreen.storyboard
│   │   └── Modules/           Each NativeModule = one .swift + one .m bridge
│   ├── NunbaCompanionTests/   XCTest target — one test per module
│   ├── NunbaScreenShare/      Broadcast Upload Extension (ReplayKit)
│   └── Podfile                Pinned to RN 0.81.4 iOS pods
│
├── __tests__/                 Jest tests for shared JS
└── docs/
    ├── PORT_MANIFEST.md       What's ported, what's pending, what's dropped
    ├── ARCHITECTURE.md        How the iOS native bridge is laid out
    └── SHARED_JS_MANIFEST.json Machine-readable mirror of the Android-side JS contract
```

---

## Build prerequisites

iOS builds require **macOS + Xcode 15+**. This repo can be **edited** on Windows or Linux (all source files are platform-agnostic text), but `pod install` and `xcodebuild` only run on macOS.

```bash
# On macOS
nvm use 20
yarn install
cd ios && pod install && cd ..
yarn ios               # iPhone simulator
yarn ios --device      # tethered iPhone / iPad
```

Optional Apple-side configuration:

| Concern | Where |
|---|---|
| Bundle id, App Group, Push entitlements | `ios/NunbaCompanion/NunbaCompanion.entitlements` |
| Camera / Microphone / Screen capture usage descriptions | `ios/NunbaCompanion/Info.plist` |
| HARTOS endpoint pairing (paired desktop / regional / cloud) | First-run flow + `endpointResolver` (mirrors Android) |
| Signing | Automatic via Apple Developer account; CI uses a signed development profile |

---

## Tests

Two test surfaces, kept separate by intent:

| Where | Runs on | What it tests |
|---|---|---|
| `__tests__/*.test.js` | Node (jest) | JS logic, stores, services with mocked `NativeModules` |
| `ios/NunbaCompanionTests/` | iOS Simulator (`xcodebuild test`) | Real Swift native modules — Keychain, URLSession, CryptoKit, Core Bluetooth, CallKit |

Run JS tests cross-platform (works on Windows / Linux / macOS):
```bash
yarn test
```

Run iOS native tests (macOS only):
```bash
cd ios
xcodebuild test \
  -workspace NunbaCompanion.xcworkspace \
  -scheme NunbaCompanion \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

CI runs both surfaces on every PR via `.github/workflows/validate.yml`.

---

## Sync policy with the Android sibling

When `Hevolve_React_Native` updates a shared JS file, the change is **manually mirrored** into this repo's `js/` folder and recorded in `docs/PORT_MANIFEST.md`. A future improvement is to extract `js/` into a published npm package (`@hevolve/core`) so both apps can `yarn add` it. Until then, explicit copying keeps the dependency direction clear (Android is canonical, iOS mirrors) and avoids ESM / babel coupling between two RN versions.

The Android-side commit hash that any given JS file was synced from is recorded in `docs/SHARED_JS_MANIFEST.json` so reviewers can diff intentional drift.

---

## Status

Currently **in scaffolding**. Core native modules are being ported sequentially with XCTest cases for each. See `docs/PORT_MANIFEST.md` for the live progress table — every module lists *Android equivalent → iOS implementation file → XCTest target → Jest contract test*.

The product surface that's already live cross-platform on the Android side and is the next port target on iOS: friends + invites + conversations + reactions + post privacy (Phase 7c), voice/video/screen calls + AgentVoiceBridge (Phase 7d), AI moderation default (Phase 7e), multi-tenant ACL (Phase 8), and optional E2E DM ratchet + X3DH (Phase 9). See the [HART OS Phase 7+8+9 notes](https://github.com/hertz-ai/HARTOS) and the cross-platform plan tracked in `docs/ARCHITECTURE.md`.

---

## Community

- 💬 [Discord](https://discord.gg/hevolve)
- 📚 [Docs](https://docs.hevolve.ai)
- 🐛 [Issues](https://github.com/hertz-ai/nunba-ios/issues)
- 🌐 [hevolve.ai](https://hevolve.ai)
- 🐙 Sibling repos — [Nunba (desktop)](https://github.com/hertz-ai/Nunba) · [Hevolve_React_Native (Android)](https://github.com/hertz-ai/Hevolve_React_Native) · [HART OS (backend)](https://github.com/hertz-ai/HARTOS)

---

## License

**[Apache License 2.0](LICENSE).** Free for any use — personal, commercial, research. No restrictions, no trial, no telemetry. Take the code, run it, ship it, modify it. Attribution appreciated, not required by us beyond the standard Apache notice.

Built by [HevolveAI](https://hevolve.ai). Powered by [HART OS](https://github.com/hertz-ai/HARTOS) and the [Hevolve Database](https://github.com/hertz-ai/Hevolve_Database).

> *Nunba: A Friend, A Well Wisher, Your LocalMind. Connect to Hivemind with your friends' agents.*
