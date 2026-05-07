# Nunba ↔ Hevolve RN ↔ iOS Three-Way Parity Matrix

**Source-of-truth**: Nunba (React web) at
`C:\Users\sathi\PycharmProjects\Nunba-HART-Companion\landing-page\src\`.
Hevolve_React_Native is a **port from Nunba** with ~60% screen
coverage. Nunba-Companion-iOS is a **port from Hevolve_React_Native**
that vendors the cross-platform JS via `docs/SHARED_JS_MANIFEST.json`.

This document is the running ledger. Update it whenever you port a
screen or close a gap.

## Topology

```
              Nunba (React/MUI/web)
              ─────────────────────
              373 components
              ~37 user-facing routes
              5 web-only features (Autopilot, MCP Tools,
                                    Marketplace, ActivityHub, Compute)
                          │
                          │  port (manual, MUI→RN-Paper)
                          ▼
            Hevolve_React_Native (Android RN)
            ────────────────────────────────
            ~227 vendorable components (audit Cat A+B)
            ~50 routes registered in home.routes.js
            ~60% Nunba coverage; gaps documented below
                          │
                          │  vendor verbatim (yarn sync)
                          ▼
            Nunba-Companion-iOS (iOS RN)
            ────────────────────────────
            227 vendored components in js/shared/
            53 routes wired in App.tsx (incl. auth + 4 deferred to Phase 5)
            8 native modules ported (Swift)
            148 tests passing on iPhone + iPad simulators in CI
```

## Audit Numbers

| Layer | Components | Routes | Notes |
|-------|-----------|--------|-------|
| **Nunba (web)** | 373 (232 social) | 37 user-facing + 16 admin | MUI-heavy; 241 Dialog instances need translation to RN-Paper |
| **Hevolve RN (Android)** | 227 vendorable + 2 dropped (TV) + 3 mixed (Platform-conditional) | 50 in home.routes.js | iOS port-source |
| **iOS (this repo)** | 227 vendored verbatim | 53 wired in App.tsx | 4 routes use placeholder (Phase 5 native deps) |

## Three-way feature-area matrix

Legend: ✅ ported · 🟡 partial · ❌ missing · 🚫 out-of-scope · 🆕 Nunba-only (Android gap)

### Social Feed

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Feed | `/social` | `Feed/FeedPage.js` (581 lines) | ✅ MainScreen | ✅ wired |
| Post detail | `/social/post/:postId` | `Post/PostDetailPage.js` | ✅ PostDetailScreen | ✅ wired |
| Comment thread | (in Post detail) | `Post/CommentThread.js` | ✅ CommentsList | ✅ wired |
| Likes list | (modal) | (in PostDetailPage) | ✅ LikesList | ✅ wired |
| Add post | (modal) | `Feed/CreatePostDialog.js` | ✅ AddPost | ✅ wired |
| Report post | (modal) | inline | ✅ ReportModal | ✅ wired |
| Report comment | (modal) | inline | ✅ ReportModalComment | ✅ wired |
| Thought experiment card | inline | `Feed/ThoughtExperimentCard.jsx` | ✅ component | ✅ vendored |
| Pledge dialog | (modal) | `Feed/PledgeDialog.jsx` | ❓ check | ❓ |

### Profiles

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| User profile | `/social/profile/:userId` | `Profile/ProfilePage.js` | ✅ ProfileScreen | ✅ wired |
| Profile edit | (modal) | `Profile/ProfileEditDialog.js` | ❓ partial | ❓ |
| Agent profile | `/social/agent/:agentId` | `Agents/AgentProfilePage.jsx` | ✅ AgentDashboardScreen | ✅ wired |
| Story | (modal) | (Stories component) | ✅ StoryScreen | ✅ wired |

### Gamification

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Resonance dashboard | `/social/resonance` | `Gamification/ResonanceDashboard.js` (599 lines) | ✅ ResonanceDashboardScreen | ✅ wired |
| Achievements | `/social/achievements` | `Gamification/AchievementsPage.js` | ✅ AchievementsScreen | ✅ wired |
| Challenges | `/social/challenges` | `Gamification/ChallengesPage.js` | ✅ ChallengesScreen | ✅ wired |
| Challenge detail | `/social/challenges/:id` | `Gamification/ChallengeDetailPage.js` | ✅ ChallengeDetailScreen | ✅ wired |
| Season | `/social/seasons` | `Gamification/SeasonPage.js` | ✅ SeasonScreen | ✅ wired |
| Recipes list | `/social/recipes` | `Recipes/RecipeListPage.js` | ✅ RecipesScreen | ✅ wired |
| Recipe detail | `/social/recipes/:id` | `Recipes/RecipeDetailPage.js` | ✅ RecipeDetailScreen | ✅ wired |

### Encounters / Missed Connections

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Encounters hub | `/social/encounters` | `Encounters/EncountersPage.js` | ✅ EncountersScreen | ✅ wired |
| Encounter detail | `/social/encounters/:id` | `Encounters/EncounterDetailPage.js` | ✅ MissedConnectionDetailScreen | 🟡 placeholder (needs react-native-maps — Phase 5) |
| Create missed connection | (in detail flow) | inline | ✅ CreateMissedConnectionScreen | 🟡 placeholder (Phase 5) |
| Map view | (modal) | `MissedConnectionMapView.js` | ✅ MissedConnectionsMapScreen | 🟡 placeholder (Phase 5) |
| Discoverable toggle | inline | `Encounters/DiscoverableTogglePanel.jsx` | ✅ component | ✅ vendored |
| Icebreaker draft | (modal) | `Encounters/IcebreakerDraftSheet.jsx` | ✅ component | ✅ vendored |

### Communities + Regions + Campaigns

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Communities | `/social/communities` | `Communities/CommunityListPage.js` | ✅ CommunitiesScreen | ✅ wired |
| Community detail | `/social/h/:communityId` | `Communities/CommunityDetailPage.js` | ✅ CommunityDetailScreen | ✅ wired |
| Regions | `/social/regions` | `Regions/RegionsPage.js` | ✅ RegionsScreen | ✅ wired |
| Region detail | `/social/regions/:id` | `Regions/RegionDetailPage.js` | ✅ RegionDetailScreen | ✅ wired |
| Campaigns | `/social/campaigns` | `Campaigns/CampaignsPage.js` | ✅ CampaignsScreen | ✅ wired |
| Campaign detail | `/social/campaigns/:id` | `Campaigns/CampaignDetailPage.js` | ✅ CampaignDetailScreen | ✅ wired |
| Campaign studio | `/social/campaigns/create` | `Campaigns/CampaignStudio.js` | ✅ CampaignStudioScreen | ✅ wired |

### Games (Adult)

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Game hub | `/social/games` | `Games/GameHub.jsx` (491 lines) | ✅ GameHubScreen | ✅ wired |
| Game instance | `/social/games/:gameId` | `Games/UnifiedGameScreen.jsx` | ✅ GameScreen | ✅ wired |
| Board games (TicTacToe/Checkers/Connect4/Reversi/Mancala) | inline | `Games/board-games/*.js` | ✅ rules engine present | ✅ vendored |
| Phaser arcade games (7) | inline | `Games/phaser-games/*.js` | ⚠️ rendered via WebView | 🆕 ⚠️ same approach (PhaserWebViewBridge) |
| Multiplayer lobby | inline | `Games/AdultLobby.jsx` | ✅ MultiplayerLobby.js | ✅ vendored |
| Scoreboard | inline | `Games/AdultScoreboard.jsx` | ✅ MultiplayerScoreboard.js | ✅ vendored |

### Kids Learning Zone (the largest feature area)

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Kids hub | `/social/kids` | `KidsLearning/KidsLearningHub.jsx` (579 lines) | ✅ KidsHub/index.js | ✅ wired |
| Kids game | `/social/kids/game/:gameId` | `KidsLearning/KidsGameScreen.jsx` | ✅ KidsGameScreen | ✅ wired |
| Progress | `/social/kids/progress` | `KidsLearning/KidsProgressScreen.jsx` | ✅ KidsProgressScreen | ✅ wired |
| Game creator | `/social/kids/create` | `KidsLearning/GameCreatorScreen.jsx` | ✅ GameCreatorScreen | ✅ wired |
| Custom games | `/social/kids/custom` | `KidsLearning/CustomGamesScreen.jsx` | ✅ CustomGamesScreen | ✅ wired |
| 35+ game templates | (template engine) | `KidsLearning/templates/*.jsx` | ✅ 18 templates ported | ✅ vendored |
| Voice game templates | inline | `templates/Voice*.jsx` | ✅ 6 voice templates | ✅ vendored |
| Server-driven UI | inline | `KidsLearning/ServerDrivenUI.jsx` | ✅ ServerDrivenUI.js | ✅ vendored |
| Audio managers (Sound/TTS/AudioChannel) | inline | `shared/SoundManager.js` etc. | ✅ all 3 ported | ✅ vendored |
| Kids video player | inline | `media/KidsVideoPlayer.jsx` | ✅ KidsVideoPlayer.js | ✅ vendored (uses react-native-video — Phase 5 verifies pod) |

### Chat + Agent

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Agent chat | `/social/agent/:agentId/chat` | `Chat/AgentChatPage.js` | ✅ AgentDashboardScreen | ✅ wired |
| Coding agent | `/social/coding` | `Chat/AgentChatPage.js` (alias) | ✅ CodingAgentScreen | ✅ wired |
| Agent evolution | `/social/agents/:id/evolution` | `Evolution/AgentEvolutionPage.js` | ✅ AgentEvolutionScreen | ✅ wired |
| Thought experiment tracker | `/social/tracker` | `Tracker/ThoughtExperimentTracker.jsx` | ⚠️ partial via AgentInterview | 🟡 ⚠️ partial |
| Agent hive | `/social/hive` | `Tracker/AgentHiveView.jsx` | ✅ AgentHiveScreen | ✅ wired |
| Agent interview | (in tracker) | `Tracker/AgentInterviewPanel.jsx` | ✅ AgentInterviewScreen | ✅ wired |

### Channels + Notifications + Settings

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Notifications | `/social/notifications` | `Notifications/NotificationsPage.js` | ✅ NotificationsScreen | ✅ wired |
| Channel bindings | `/social/channels` | `Channels/ChannelBindingsPage.js` | ✅ ChannelBindingsScreen | ✅ wired |
| Channel setup | (modal in bindings) | `ChannelSetupWizard.js` | ✅ ChannelSetupScreen | ✅ wired |
| Conversation history | `/social/channels/history` | `Channels/ConversationHistoryPanel.js` | ✅ ConversationHistoryScreen | ✅ wired |
| QR pairing | inline | `Channels/QRPairingDisplay.js` | ✅ QRScannerScreen (scanner+display) | 🟡 placeholder (Phase 5: needs camera-kit pod) |
| Privacy settings | `/social/settings/privacy` | `Settings/PrivacySettingsPage.jsx` | ✅ PrivacySettingsScreen | ✅ wired |
| Backup settings | `/social/settings/backup` | `Settings/BackupSettingsPage.jsx` | ✅ BackupSettingsScreen | ✅ wired (commit 14a1c7c) |
| Theme settings | `/social/settings/appearance` | `Settings/ThemeSettingsPage.jsx` | ✅ ThemeSettingsScreen (simplified) | ✅ wired (commit 65ba2f9f) |

### Search

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Search | `/social/search` | `pages/SearchPage.js` (?) | ✅ SearchScreen | ✅ wired |

### Mindstory + Federation + Tasks + Misc

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Mindstory | `/social/mindstory` | `Mindstory/MindstoryPage.jsx` | ✅ MindstoryScreen | ✅ wired |
| Federated feed | (no Nunba route) | n/a | ✅ FederatedFeedScreen | ✅ wired (Hevolve enhancement) |
| Tasks | (no Nunba route) | n/a | ✅ TasksScreen | ✅ wired (Hevolve enhancement) |
| All features | (no Nunba route) | n/a | ✅ AllFeaturesScreen | ✅ wired (Hevolve enhancement) |
| Experiment discovery | `/social/experiments` | `Experiments/ExperimentDiscoveryPage.jsx` | ✅ ExperimentDiscoveryScreen | ✅ wired |
| Provider management | inline | (admin) | ✅ ProviderManagementScreen | ✅ wired |
| Share landing | (deep-link) | `pages/ShareLandingPage.js` | ✅ ShareLandingScreen | ✅ wired |
| Onboarding overlay | (modal) | inline | ✅ OnboardingOverlayScreen | ✅ wired |

### Auth / Signup

| Screen | Nunba route | Nunba file | Android RN | iOS |
|--------|-------------|-----------|-----------|-----|
| Signup combined | `/signup` | `pages/NewSignup.js` | ✅ SignUpCombined.js | ✅ wired (initial route when no token) |
| Signup steps (Name/DOB/Gender/Lang/Email/Phone) | (within NewSignup) | inline | ✅ separate components | ✅ vendored (auth flow Phase 4) |
| OTP modal | (modal) | `pages/OTPModal.js`/`OtpAuthModal.js` | ✅ via NativeModule | ✅ via OnboardingModule.setAccessToken |
| Institution signup | `/institution/signup` | `pages/signuplite.js` | ❌ not in Hevolve | ❌ Android gap |

## 🆕 Android gaps — Nunba features missing in Hevolve_React_Native

These are features that exist in Nunba (web) but were never ported to the Android RN codebase. **Since iOS vendors from Hevolve_RN, these are also iOS gaps** — but porting them to iOS would require translating Nunba's MUI implementation directly to RN.

For each: documenting the Nunba file + complexity so a future port pass (Android OR iOS) can pick them up.

| Feature | Nunba file | Complexity | Priority | Notes |
|---------|-----------|------------|----------|-------|
| Autopilot | `Autopilot/AutopilotPage.jsx` | Medium | Low | Automation scheduler (rules + triggers + actions). Touches socialApi.autopilotApi. 836 LOC + autopilotStore — multi-day port deferred. |
| MCP Tool Browser | `Tools/MCPToolBrowser.jsx` | Medium | Medium | ✅ Ported 2026-05-07 (Hevolve_RN 8dde2c70). Card grid + lazy tools fetch + DeviceEventEmitter `nunba:selectAgent` (RN-equivalent of web custom event). |
| Marketplace | `Marketplace/MarketplacePage.jsx` | Medium | Low | ✅ Ported 2026-05-07 (Hevolve_RN 8dde2c70). Listings grid + 7 category tabs + debounced search + Hire button + Load-more pagination. |
| Activity Hub | `ActivityHub/ActivityHub.js` | Large | Medium | ✅ Ported 2026-05-07 (Hevolve_RN 8dde2c70). 4-section dashboard (Right Now / Play / Contribute / Grow) aggregating gamesApi + computeApi + challengesApi + resonanceApi. |
| Compute Dashboard | `Compute/ComputeDashboardPage.js` | Large | Medium | ✅ Ported 2026-05-07 (Hevolve_RN 1f1d90d1, iOS 14a1c7c) — opt-in toggle, personal+hive impact, transparency copy. |
| Backup Settings | `Settings/BackupSettingsPage.jsx` | Small | Low | ✅ Ported 2026-05-07 (Hevolve_RN 1f1d90d1, iOS 14a1c7c) — backup create / restore / linked-device unlink. |
| Theme Settings | `Settings/ThemeSettingsPage.jsx` | Small | Low | ✅ Ported 2026-05-07 (Hevolve_RN 65ba2f9f) — simplified scope: 8-preset grid + AI generator + reset. Dropped per-color HexColorPicker (`react-colorful` is web-only), animation-intensity sliders, and font picker; documented in inline screen comment. |
| Institution Signup | `pages/signuplite.js` | Small | Low | Uses deprecated `mailer.hertzai.com` (per #262 convergence — that backend is being replaced by HARTOS). Defer until B2B onboarding flow is re-designed against HARTOS auth. |

**Recommendation**: when Hevolve adds any of these screens, sync them to iOS via the manifest. Until then, these are documented gaps — not bugs.

**2026-05-07 progress**: 6 of 8 Bucket B items ported in one day:
Backup Settings, Compute Dashboard, MCP Tool Browser, Marketplace,
Activity Hub, Theme Settings (simplified). Remaining two:
- **Autopilot**: 836-LOC screen + 701-LOC autopilotStore (1537 LOC
  total). Multi-day port deferred.
- **Institution Signup**: uses deprecated mailer.hertzai.com — defer
  until B2B onboarding is re-designed against HARTOS auth.

## 🚫 Out-of-scope (deliberately not ported)

- **Admin suite** (16 Nunba screens under `/admin/*`): operator UI, web-only, role-gated. Mobile users don't access admin.
- **Landing / marketing pages** (`/`, `/AboutHevolve`, `/Plan`, etc.): web-only. Mobile boots into authenticated flow.
- **Pupit docs** (`/docs`): SDK documentation site, web-only.
- **Apple Watch port**: separate WatchOS project. Apple Watch ≠ Wear OS.
- **tvOS port**: separate target. tvOS ≠ Android TV.
- **OpenGL ES 3.0 avatar renderer**: Android-only. iOS would use Metal — future phase.
- **Wear Data Layer / TVHomeScreen**: dropped per audit.

## Sync mechanism

| Direction | Mechanism | Frequency |
|-----------|-----------|-----------|
| Hevolve_RN → iOS | `yarn sync` (manifest-driven script) | On-demand, drift gated by CI sync-drift job |
| Nunba → Hevolve_RN | Manual port (MUI → RN) | When Hevolve team picks up a Nunba feature |
| Nunba → iOS | (indirect via Hevolve) | Wait for Hevolve to land it |

If a feature is **urgent on iOS but not yet in Hevolve**, the choice is:
1. Port from Nunba directly into `js/ios/` (bypasses shared/) — iOS-only escape hatch.
2. First port to Hevolve_RN, then sync. Cleanest but slower.

Default to (2) unless time-pressured.

## Status snapshot (last update: 2026-05-02)

| Layer | Items | Done | Pending |
|-------|-------|------|---------|
| Native modules (iOS Swift) | 8 priority modules | 8 | 0 (drops: Wear, TV, FCM-iOS-equivalent) |
| Vendored shared JS | 280 files | 280 | 0 |
| Routes wired | 53 | 49 ✅ + 4 placeholder (Phase 5) | iPad/iPhone build green |
| Tests passing | 296 (148 × 2 platforms) | 296 | 0 |
| Auth flow port | Signup → token persist | Wired in App.tsx | Per-step screens vendored, integration test pending |
| Tier-2 native (camera/maps) | 4 native modules | 0 | Phase 5 |
| Nunba-only screens (Android gaps) | 8 | 0 | Defer until Hevolve adds |

## How to update this doc

When porting a screen or closing a gap:
1. Move the row from ❌/🟡 to ✅
2. Note the commit SHA in the "Status snapshot" section
3. If the change adds Android gap awareness, add a row to "Android gaps"
4. Run `yarn validate:manifest` to confirm vendored content matches
5. Run `yarn sync:check` (locally) or wait for CI sync-drift to confirm no upstream drift

## Sources

- Nunba: `C:\Users\sathi\PycharmProjects\Nunba-HART-Companion\landing-page\src\`
  - 373 components, 232 social, 40 feature directories, 584 MUI imports, 241 Dialog instances
- Hevolve_React_Native: `C:\Users\sathi\StudioProjects\Hevolve_React_Native\`
  - 227 cross-platform components (audit Cat A+B), 50 routes in home.routes.js
- Nunba-Companion-iOS: this repo
  - 280 vendored JS files in 6 manifest groups, 53 routes in App.tsx, 8 native modules

Audit history:
- 2026-05-01: initial parity scaffold
- 2026-05-02: comprehensive three-way matrix + 227-file vendor pass + 53-route wiring
