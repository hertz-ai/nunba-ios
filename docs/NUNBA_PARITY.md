# Nunba (React Web) Parity Tracking

The original/upstream codebase is **Nunba**
(`Nunba-HART-Companion/landing-page/src/`), a React + MUI web app.
**Hevolve_React_Native** (Android RN) was ported FROM Nunba — it
covers ~60% of Nunba's screens. **Nunba-Companion-iOS** (this repo)
copies the React Native port and adds iOS-native bindings.

This document is the source of truth for screen-level parity.

## Topology

```
                  Nunba (React/MUI/web)
                  ─────────────────────
                  ~373 components
                  37+ user-facing routes
                          │
                          │  port (manual, MUI→RN)
                          ▼
                Hevolve_React_Native (Android RN)
                ────────────────────────────────
                ~223 components
                ~60% screen coverage
                          │
                          │  vendor (yarn sync)
                          ▼
                Nunba-Companion-iOS (iOS RN)
                ────────────────────────────
                Same ~60% as Android (when JS works)
                + iOS-native modules (Tier-1 done)
                + 4 placeholder screens (Home/Profile/KidsHub/Encounters)
```

Nunba moves fastest. Android lags Nunba. iOS lags Android because
iOS is a fresh sibling — but JS is vendored, so once Hevolve_React_Native
catches up to a Nunba screen, iOS gets it via `yarn sync`.

## Coverage by feature area

| Feature area | Nunba files | Android RN files | iOS status (this repo) | Coverage |
|--------------|-------------|------------------|------------------------|----------|
| Social Feed & Core | 10 | 1 | 🟦 placeholder route only | ~10% |
| Profiles | 5 | 1 | 🟦 placeholder route only | ~10% |
| Gamification (Challenges/Achievements/Seasons) | 5 | 3 | 🟦 not yet routed | 0% |
| Encounters (Missed Connections) | 5 | 1 | 🟦 placeholder route only | ~10% |
| Regions | 3 | 2 | 🟦 not yet routed | 0% |
| Communities | 3 | 1 | 🟦 not yet routed | 0% |
| Campaigns | 3 | 3 | 🟦 not yet routed | 0% |
| Games Hub (Adult) | 25 | 4 | 🟦 not yet routed | 0% |
| Kids Learning | 92 | 15 | 🟦 placeholder route only | ~5% |
| Chat & Agent Interview | 2 | 2 | 🟦 not yet routed | 0% |
| Tracker (Hive + Experiments) | 6 | 2 | 🟦 not yet routed | 0% |
| Channels | 5 | 2 | 🟦 not yet routed | 0% |
| Settings | 4 | 1 | 🟦 not yet routed | 0% |
| Admin | 13 | 1 | ❌ not in scope (operator UI) | ❌ |
| Autopilot | 4 | 0 | ❌ not in Android either | ❌ |
| MCP Tools | 1 | 0 | ❌ not in Android either | ❌ |
| Marketplace | 1 | 0 | ❌ not in Android either | ❌ |
| Activity Hub | 1 | 0 | ❌ not in Android either | ❌ |
| Compute Dashboard | 1 | 0 | ❌ not in Android either | ❌ |
| Mindstory | 1 | 0 (stub) | ❌ deferred | ❌ |

Legend:
- ✅ Done — screen exists, navigation wired, tested
- 🟦 Pending — no screen yet on iOS; route may or may not be wired
- ❌ Out of scope — not user-facing, or not in Android either

## Screen-level cross-reference

### Social feed + core navigation

| Nunba route | Component | Android RN | iOS |
|-------------|-----------|------------|-----|
| `/social` | SocialFeed (FeedPage.js) | ✅ FederatedFeedScreen | 🟦 |
| `/social/profile/:userId` | SocialProfile | ✅ ProfileScreen | 🟦 |
| `/social/post/:postId` | PostDetailPage | ✅ PostDetailScreen | 🟦 |
| `/social/search` | SearchPage | ✅ SearchScreen | 🟦 |

### Gamification

| Nunba route | Android RN | iOS |
|-------------|------------|-----|
| `/social/achievements` | ✅ AchievementsScreen | 🟦 |
| `/social/challenges` | ✅ ChallengesScreen | 🟦 |
| `/social/challenges/:id` | ✅ ChallengeDetailScreen | 🟦 |
| `/social/seasons` | ✅ SeasonScreen | 🟦 |
| `/social/resonance` | ✅ ResonanceDashboard | 🟦 |
| `/social/recipes` | ✅ RecipesScreen | 🟦 |

### Communities + regions + campaigns

| Nunba route | Android RN | iOS |
|-------------|------------|-----|
| `/social/communities` | ✅ CommunitiesScreen | 🟦 |
| `/social/h/:communityId` | ✅ CommunityDetailScreen | 🟦 |
| `/social/regions` | ✅ RegionsScreen | 🟦 |
| `/social/regions/:regionId` | ✅ RegionDetailScreen | 🟦 |
| `/social/campaigns` | ✅ CampaignsScreen | 🟦 |
| `/social/campaigns/:id` | ✅ CampaignDetailScreen | 🟦 |
| `/social/campaigns/create` | ✅ CampaignStudioScreen | 🟦 |

### Games hub

Nunba has **25 game files** (5 board games, 7 Phaser arcade scenes,
6 game engines). Android has 4. iOS has 0. Phaser games likely don't
port cleanly to RN — they're canvas-based. Board games + engines
do port.

| Nunba route | Android RN | iOS |
|-------------|------------|-----|
| `/social/games` | ✅ GameHubScreen | 🟦 |
| `/social/games/:gameId` | ✅ GameScreen | 🟦 |
| Board games: TicTacToe, ConnectFour, Checkers, Reversi, Mancala | ⚠️ partial | 🟦 |
| Phaser arcade: Snake, Pong, Breakout, BubbleShooter, Match3, Runner, Flappy | ❌ | 🟦 |
| Engines: BoardGame, Phaser, Sudoku, Trivia, WordScramble, WordSearch | ⚠️ partial | 🟦 |

### Kids Learning hub

Nunba has **92 files**. Android has 15. Big gap on game templates +
audio features.

| Nunba route | Android RN | iOS |
|-------------|------------|-----|
| `/social/kids` | ✅ KidsHub | 🟦 placeholder |
| `/social/kids/game/:gameId` | ✅ KidsGameScreen | 🟦 |
| `/social/kids/progress` | ✅ KidsProgressScreen | 🟦 |
| `/social/kids/create` | ✅ GameCreatorScreen | 🟦 |
| `/social/kids/custom` | ✅ CustomGamesScreen | 🟦 |
| Game categories: Creativity, English, Interactive, Life Skills, Math, Science | ⚠️ partial | 🟦 |
| Audio: AudioChannelManager, SoundManager, MediaPreloader, TTSManager, PeerConnectionManager | ⚠️ partial | 🟦 |

### Channels + agents + tracker

| Nunba route | Android RN | iOS |
|-------------|------------|-----|
| `/social/channels` | ✅ ChannelBindingsScreen | 🟦 |
| `/social/channels/history` | ✅ ConversationHistoryScreen | 🟦 |
| `/social/agents/:id/evolution` | ✅ AgentEvolutionScreen | 🟦 |
| `/social/agent/:id` | ✅ AgentDashboardScreen | 🟦 |
| `/social/agent/:id/chat` | ⚠️ AgentInterviewScreen (limited) | 🟦 |
| `/social/coding` | ✅ CodingAgentScreen | 🟦 |
| `/social/hive` | ✅ AgentHiveScreen | 🟦 |
| `/social/tracker` | ❌ NOT PORTED (role-gated) | ❌ |

### Encounters + notifications + settings

| Nunba route | Android RN | iOS |
|-------------|------------|-----|
| `/social/encounters` | ✅ EncountersScreen | 🟦 placeholder |
| `/social/encounters/:id` | ✅ (in EncountersScreen) | 🟦 |
| `/social/notifications` | ✅ NotificationsScreen | 🟦 |
| `/social/settings/privacy` | ✅ PrivacySettingsScreen | 🟦 |
| `/social/settings/backup` | ❌ | ❌ |
| `/social/settings/appearance` | ❌ | ❌ |

### Out-of-scope on iOS (not in Android either)

- `/social/autopilot` — Autopilot task UI (4 Nunba files)
- `/social/tools` — MCP Tool browser
- `/social/marketplace` — Agent/template marketplace
- `/social/activity` — Activity Hub
- `/social/compute` — Compute Dashboard
- `/admin/*` — Admin suite (13 Nunba files)
- Landing pages (`/AboutHevolve`, `/Plan`, `/contact`, etc.) — handled by mobile signup flow, not in-app

## What it takes to close the iOS-side gap

### Per-screen porting work

For each Android RN screen you want on iOS, the work breakdown is:

1. **Vendor the JS** — verify `js/shared/` has the screen's
   imports (most components live in `components/CommunityView/...`
   which we haven't yet vendored). Add to
   `docs/SHARED_JS_MANIFEST.json`, run `yarn sync`.
2. **Resolve native dependencies** — the screen may use
   `NativeModules.X` for X we haven't ported. Check against
   `docs/PORT_MANIFEST.md`; port any missing module.
3. **Wire the route** — add to `App.tsx` Stack.Navigator + the
   `linking.config.screens` map.
4. **Smoke test** — extend `SmokeUITests.swift` to navigate to
   the screen and assert it renders.

Realistic per-screen effort: 1-3 hours for a vendored RN screen with
all native deps already done. Days for a screen that introduces
new native modules.

### Components NOT yet vendored

`docs/SHARED_JS_MANIFEST.json` currently vendors only stores, theme,
utils, hooks, services. The full `components/` tree is deliberately
NOT vendored because:

- ~200 component files in `components/CommunityView/`
- Many import RN-specific libraries that may need iOS pod additions
- Per-component classification needed (cross-platform vs Android-only)

A future sweep should add a `components` group to the manifest with
a curated list of cross-platform components.

## Scope decisions that made sense

These are **not** parity gaps — they're deliberately out of scope:

| Decision | Rationale |
|----------|-----------|
| No tvOS port | Apple TV is a separate SDK with its own UX paradigm. Android TV → tvOS is a future project, not a port. |
| No watchOS port | Apple Watch uses WatchConnectivity, not Wear Data Layer. Separate WatchOS project. |
| No admin suite | Operator-only UI; not user-facing. Not in Android RN either. |
| No landing pages | Web-only marketing pages. Mobile app boots into authenticated flow. |
| No Pupit docs | Web-only documentation site. |
| No B2B Institution flow | Web sales path, not mobile. |
| Mindstory deferred | AI video generation; needs Metal renderer + ffmpeg integration. |

## Sources

- Nunba: `C:\Users\sathi\PycharmProjects\Nunba-HART-Companion\landing-page\src\`
- Android RN: `C:\Users\sathi\StudioProjects\Hevolve_React_Native\components\`
- iOS RN (this): `js/shared/` (vendored from Android), `App.tsx` (routing), `ios/NunbaCompanion/Modules/` (native)

Audit conducted 2026-05-01 by reviewer agent. Nunba file count: 373.
Android component count: 223. iOS placeholder routes: 4.
