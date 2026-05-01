# Nunba Companion (iOS)

iOS-native React Native companion app for HARTOS. Sibling to
`Hevolve_React_Native/` (which targets Android). Same product,
two platforms, two codebases — by design.

## Why two repos, not one

The Android app has ~100 native Java/Kotlin modules covering Wear OS
data layer, Android TV Leanback, OpenGL ES 3.0 avatar renderer,
WAMP Autobahn-Java, FCM data messages, BLE/NFC bridges, and a
12k-line PeerLink stack. None of those auto-port to iOS. iOS needs
its own native modules in Swift, its own APNs handler instead of FCM,
and its own Metal renderer instead of OpenGL ES. Mixing the two
build systems in one repo would slow both teams and risk regressions
on the working Android app.

## What IS shared

The JS surface — anything that doesn't import `NativeModules`
directly — is **copied** from the Android repo into `js/`. That
covers:

- Zustand stores (gamification, kids learning, fleet command, etc.)
- Theme tokens + color palettes
- Game configs (`data/configs/*.json`)
- Pure-JS utilities, hooks, types
- React components rendered via cross-platform RN libraries
  (`react-native-paper`, `react-native-vector-icons`, etc.)
- Jest tests for that JS

`docs/PORT_MANIFEST.md` is the ground-truth list of what's been
copied + what was deliberately skipped (Wear OS / TV / GL specific).

## What is NOT shared

Anything that hits the platform layer — copied JS may import
`NativeModules.X.method()`, but the **implementation** of `X`
lives in `ios/NunbaCompanion/Modules/X.swift`. The contract
(method names, argument types, return shape) matches the Android
side so the JS doesn't care which platform it runs on.

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
├── js/                        Shared JS (copied from Hevolve_React_Native)
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
│   └── Podfile                Pinned to RN 0.81.4 iOS pods
│
├── __tests__/                 Jest tests for shared JS
└── docs/
    ├── PORT_MANIFEST.md       What's ported, what's pending, what's dropped
    └── ARCHITECTURE.md        How the iOS native bridge is laid out
```

## Build prerequisites

iOS builds require macOS + Xcode 15+. This repo can be **edited** on
Windows or Linux (all source files are platform-agnostic text), but
`pod install` and `xcodebuild` only run on macOS.

```bash
# On macOS
nvm use 20
yarn install
cd ios && pod install && cd ..
yarn ios
```

## Tests

Two test surfaces, kept separate by intent:

| Where | Runs on | What it tests |
|-------|---------|---------------|
| `__tests__/*.test.js` | Node (jest) | JS logic, stores, services with mocked NativeModules |
| `ios/NunbaCompanionTests/` | iOS Simulator (xcodebuild test) | Real Swift native modules, Keychain, URLSession, CryptoKit |

Run JS tests cross-platform:
```bash
yarn test
```

Run iOS native tests (macOS only):
```bash
cd ios
xcodebuild test -workspace NunbaCompanion.xcworkspace \
  -scheme NunbaCompanion \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Sync policy with Android

When `Hevolve_React_Native` updates a shared JS file, the change
should be **manually mirrored** into this repo's `js/` folder.
A future improvement is to extract `js/` into a published npm
package (`@hevolve/core`) so both apps can `yarn add` it. For now,
explicit copying keeps the dependency direction clear and avoids
ESM/babel coupling between two RN versions.

See `docs/PORT_MANIFEST.md` for the file-by-file copy log.

## Status

Currently **in scaffolding**. Core native modules being ported
sequentially with XCTest cases for each. See task tracker for
progress on individual modules.
