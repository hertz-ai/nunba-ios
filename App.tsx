/**
 * Nunba Companion — iOS app root.
 *
 * Mirrors the Stack.Navigator from
 * js/shared/components/CommunityView/router/home.routes.js
 * (Android), with these intentional iOS divergences:
 *
 *   • TVHome route is omitted (tvOS is a separate target).
 *   • Routes whose screen depends on a native pod we haven't yet
 *     wired (react-native-maps, react-native-camera-kit) point
 *     at a temporary <PendingNativeDeps> placeholder so the JS
 *     bundle still loads. Replacing them is Phase 5 work.
 *
 * Auth gating:
 *   The first launch shows SignUpCombined when no access token
 *   is in OnboardingModule's Keychain. Once setAccessToken
 *   resolves, we navigate to MainScreen. (See Phase 4 of the
 *   port plan in docs/PORT_MANIFEST.md.)
 *
 * Deep linking:
 *   linkingConfig matches the URL schemes registered in
 *   ios/NunbaCompanion/Info.plist (hevolve://, nunba://) plus
 *   https://hevolve.app for Universal Links.
 */
import React, {useEffect, useState, useCallback} from 'react';
import {
  ActivityIndicator,
  AppState,
  DeviceEventEmitter,
  NativeModules,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// Use the third-party SafeAreaView — react-native's built-in one
// is deprecated in 0.81 + React 19 and renders no children in
// some host configurations (the symptom we hit: RN tree mounts an
// outer wrapper but Text/ActivityIndicator never show).
import {SafeAreaView, SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer, LinkingOptions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

// ─── Vendored screens (all from js/shared/components/CommunityView/screens) ──
// Import lazily so a single import-time error in one screen doesn't crash the
// whole bundle. The wrapper turns each into a route component that surfaces
// the import error inline rather than killing the app.
const lazy = (loader: () => Promise<{default: React.ComponentType<any>}>) =>
  React.lazy(loader);

// Screens with no heavy native-pod deps — vendored components.
const MainScreen                  = lazy(() => import('./js/shared/components/CommunityView/screens/MainScreen'));
const StoryScreen                 = lazy(() => import('./js/shared/components/CommunityView/screens/StoryScreen'));
const CommentsList                = lazy(() => import('./js/shared/components/CommunityView/components/Post/components/Footer/CommentsList'));
const LikesList                   = lazy(() => import('./js/shared/components/CommunityView/components/Post/components/Footer/LikesList'));
const AddPost                     = lazy(() => import('./js/shared/components/CommunityView/components/FeedHeader/AddPost/addPost'));
const ReportModal                 = lazy(() => import('./js/shared/components/CommunityView/components/Post/components/Header/ReportModal'));
const ReportModalComment          = lazy(() => import('./js/shared/components/CommunityView/components/Post/components/Footer/ReportModalComment'));

const EncountersScreen            = lazy(() => import('./js/shared/components/CommunityView/screens/EncountersScreen'));
// Screens that import react-native-maps — placeholder until Phase 5 (tier-2 native).
// const CreateMissedConnectionScreen = lazy(() => import('./js/shared/components/CommunityView/screens/CreateMissedConnectionScreen'));
// const MissedConnectionDetailScreen = lazy(() => import('./js/shared/components/CommunityView/screens/MissedConnectionDetailScreen'));
// const MissedConnectionsMapScreen   = lazy(() => import('./js/shared/components/CommunityView/screens/MissedConnectionsMapScreen'));

const ResonanceDashboardScreen    = lazy(() => import('./js/shared/components/CommunityView/screens/ResonanceDashboardScreen'));
const AchievementsScreen          = lazy(() => import('./js/shared/components/CommunityView/screens/AchievementsScreen'));
const ChallengesScreen            = lazy(() => import('./js/shared/components/CommunityView/screens/ChallengesScreen'));
const ChallengeDetailScreen       = lazy(() => import('./js/shared/components/CommunityView/screens/ChallengeDetailScreen'));
const SeasonScreen                = lazy(() => import('./js/shared/components/CommunityView/screens/SeasonScreen'));
const RegionsScreen               = lazy(() => import('./js/shared/components/CommunityView/screens/RegionsScreen'));
const RegionDetailScreen          = lazy(() => import('./js/shared/components/CommunityView/screens/RegionDetailScreen'));
const AgentEvolutionScreen        = lazy(() => import('./js/shared/components/CommunityView/screens/AgentEvolutionScreen'));
const CampaignsScreen             = lazy(() => import('./js/shared/components/CommunityView/screens/CampaignsScreen'));
const CampaignStudioScreen        = lazy(() => import('./js/shared/components/CommunityView/screens/CampaignStudioScreen'));
const CampaignDetailScreen        = lazy(() => import('./js/shared/components/CommunityView/screens/CampaignDetailScreen'));
const OnboardingOverlayScreen     = lazy(() => import('./js/shared/components/CommunityView/screens/OnboardingOverlayScreen'));

const ShareLandingScreen          = lazy(() => import('./js/shared/components/CommunityView/screens/ShareLandingScreen'));

const PostDetailScreen            = lazy(() => import('./js/shared/components/CommunityView/screens/PostDetailScreen'));
const SearchScreen                = lazy(() => import('./js/shared/components/CommunityView/screens/SearchScreen'));
const NotificationsScreen         = lazy(() => import('./js/shared/components/CommunityView/screens/NotificationsScreen'));
const CommunitiesScreen           = lazy(() => import('./js/shared/components/CommunityView/screens/CommunitiesScreen'));
const CommunityDetailScreen       = lazy(() => import('./js/shared/components/CommunityView/screens/CommunityDetailScreen'));
const ProfileScreen               = lazy(() => import('./js/shared/components/CommunityView/screens/ProfileScreen'));
const RecipesScreen               = lazy(() => import('./js/shared/components/CommunityView/screens/RecipesScreen'));
const RecipeDetailScreen          = lazy(() => import('./js/shared/components/CommunityView/screens/RecipeDetailScreen'));
const TasksScreen                 = lazy(() => import('./js/shared/components/CommunityView/screens/TasksScreen'));
const CodingAgentScreen           = lazy(() => import('./js/shared/components/CommunityView/screens/CodingAgentScreen'));
const AgentDashboardScreen        = lazy(() => import('./js/shared/components/CommunityView/screens/AgentDashboardScreen'));

const GameHubScreen               = lazy(() => import('./js/shared/components/CommunityView/screens/GameHubScreen'));
const GameScreen                  = lazy(() => import('./js/shared/components/CommunityView/screens/GameScreen'));

const KidsHubScreen               = lazy(() => import('./js/shared/components/CommunityView/screens/KidsHub'));
const KidsGameScreen              = lazy(() => import('./js/shared/components/CommunityView/screens/KidsGameScreen'));
const KidsProgressScreen          = lazy(() => import('./js/shared/components/CommunityView/screens/KidsProgressScreen'));
const GameCreatorScreen           = lazy(() => import('./js/shared/components/CommunityView/screens/GameCreatorScreen'));
const CustomGamesScreen           = lazy(() => import('./js/shared/components/CommunityView/screens/CustomGamesScreen'));

const ExperimentDiscoveryScreen   = lazy(() => import('./js/shared/components/CommunityView/screens/ExperimentDiscoveryScreen'));

const FederatedFeedScreen         = lazy(() => import('./js/shared/components/CommunityView/screens/FederatedFeedScreen'));

const AgentHiveScreen             = lazy(() => import('./js/shared/components/CommunityView/screens/AgentHiveScreen'));
const AgentHiveDetailScreen       = lazy(() => import('./js/shared/components/CommunityView/screens/AgentHiveDetailScreen'));
const AgentInterviewScreen        = lazy(() => import('./js/shared/components/CommunityView/screens/AgentInterviewScreen'));

const MindstoryScreen             = lazy(() => import('./js/shared/components/CommunityView/screens/MindstoryScreen'));
const AllFeaturesScreen           = lazy(() => import('./js/shared/components/CommunityView/screens/AllFeaturesScreen'));

const ChannelBindingsScreen       = lazy(() => import('./js/shared/components/CommunityView/screens/ChannelBindingsScreen'));
const ChannelSetupScreen          = lazy(() => import('./js/shared/components/CommunityView/screens/ChannelSetupScreen'));
// const QRScannerScreen          = lazy(() => import('./js/shared/components/CommunityView/screens/QRScannerScreen'));  // needs camera-kit, Phase 5
const ConversationHistoryScreen   = lazy(() => import('./js/shared/components/CommunityView/screens/ConversationHistoryScreen'));

const ProviderManagementScreen    = lazy(() => import('./js/shared/components/CommunityView/screens/ProviderManagementScreen'));

// Settings parity ports (Bucket B — Nunba MUI → RN)
const BackupSettingsScreen        = lazy(() => import('./js/shared/components/CommunityView/screens/BackupSettingsScreen'));
const ComputeDashboardScreen      = lazy(() => import('./js/shared/components/CommunityView/screens/ComputeDashboardScreen'));
const MCPToolBrowserScreen        = lazy(() => import('./js/shared/components/CommunityView/screens/MCPToolBrowserScreen'));
const MarketplaceScreen           = lazy(() => import('./js/shared/components/CommunityView/screens/MarketplaceScreen'));
const ActivityHubScreen           = lazy(() => import('./js/shared/components/CommunityView/screens/ActivityHubScreen'));

// Auth flow screens (Phase 4 — initial route when no token)
const SignUpCombined              = lazy(() => import('./js/shared/components/SignUp/SignUpCombined'));

// ─── Type-safe route param map ───────────────────────────────────

type RootStackParamList = {
  // Auth
  SignUpCombined: undefined;
  // Main
  MainScreen: undefined;
  ShareLanding: {token?: string};
  Story: {storyId?: string};
  LikesList: undefined;
  CommentsList: undefined;
  AddPost: undefined;
  Report: undefined;
  ReportComment: undefined;
  // Encounters
  Encounters: undefined;
  CreateMissedConnection: undefined;     // ← placeholder
  MissedConnectionDetail: {id?: string}; // ← placeholder
  MissedConnectionsMap: undefined;       // ← placeholder
  // Gamification
  ResonanceDashboard: undefined;
  Achievements: undefined;
  Challenges: undefined;
  ChallengeDetail: {id?: string};
  Season: undefined;
  Regions: undefined;
  RegionDetail: {id?: string};
  AgentEvolution: {agentId?: string};
  Campaigns: undefined;
  CampaignStudio: undefined;
  CampaignDetail: {id?: string};
  Onboarding: undefined;
  // Social
  PostDetail: {postId?: string};
  Search: undefined;
  Notifications: undefined;
  Communities: undefined;
  CommunityDetail: {id?: string};
  Profile: {userId?: string};
  Recipes: undefined;
  RecipeDetail: {id?: string};
  Tasks: undefined;
  CodingAgent: undefined;
  AgentDashboard: {agentId?: string};
  // Games
  GameHub: undefined;
  GameScreen: {gameId?: string};
  // Kids
  KidsHub: undefined;
  KidsGame: {gameId?: string};
  KidsProgress: undefined;
  GameCreator: undefined;
  CustomGames: undefined;
  // Experiments + Federation
  ExperimentDiscovery: undefined;
  FederatedFeed: undefined;
  // Hive
  AgentHive: undefined;
  AgentHiveDetail: {agentId?: string};
  AgentInterview: undefined;
  // Mindstory + All Features
  Mindstory: undefined;
  AllFeatures: undefined;
  // Channels
  ChannelBindings: undefined;
  ChannelSetup: undefined;
  QRScanner: undefined;                  // ← placeholder
  ConversationHistory: undefined;
  // Admin
  ProviderManagement: undefined;
  // Settings parity ports
  BackupSettings: undefined;
  ComputeDashboard: undefined;
  MCPToolBrowser: undefined;
  Marketplace: undefined;
  ActivityHub: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Deep linking ────────────────────────────────────────────────

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['hevolve://', 'nunba://', 'https://hevolve.app'],
  config: {
    screens: {
      MainScreen: '',
      ShareLanding: 's/:token',
      PostDetail: 'p/:postId',
      Profile: 'profile/:userId?',
      KidsHub: 'kids',
      KidsGame: 'kids/game/:gameId',
      Encounters: 'encounters',
      Communities: 'communities',
      CommunityDetail: 'h/:id',
      Campaigns: 'campaigns',
      CampaignDetail: 'campaigns/:id',
      Regions: 'regions',
      RegionDetail: 'regions/:id',
      ResonanceDashboard: 'resonance',
      Achievements: 'achievements',
      Challenges: 'challenges',
      ChallengeDetail: 'challenges/:id',
      Recipes: 'recipes',
      RecipeDetail: 'recipes/:id',
      GameHub: 'games',
      GameScreen: 'games/:gameId',
      Notifications: 'notifications',
      Search: 'search',
      AgentHive: 'hive',
      AgentDashboard: 'agent/:agentId',
      Mindstory: 'mindstory',
      ChannelBindings: 'channels',
    },
  },
};

// ─── Placeholder fallback for screens with pending native deps ───
// User-facing copy ONLY — no internal references to PORT_MANIFEST or
// "Phase 5".  See review-2026-05-04 § 3 CRITICAL: shipping doc-internal
// language to end-users invites App Store rejection and looks like a
// half-finished feature in the wild.  When the native dep lands, the
// route swaps to the real component and this screen disappears.

const PENDING_FRIENDLY_TITLES: Record<string, string> = {
  QRScanner: 'Scan QR Code',
  CreateMissedConnection: 'Missed Connections',
  MissedConnectionDetail: 'Missed Connections',
  MissedConnectionsMap: 'Encounters Map',
};

const PENDING_BLURB: Record<string, string> = {
  QRScanner: 'QR pairing is rolling out soon. We\'re polishing the camera flow on iOS.',
  CreateMissedConnection: 'Missed Connections are coming to iOS. We\'ll let you know the moment they\'re live.',
  MissedConnectionDetail: 'Missed Connections are coming to iOS. We\'ll let you know the moment they\'re live.',
  MissedConnectionsMap: 'Map view of nearby encounters is coming soon to iOS.',
};

function PendingNativeDeps({route}: any) {
  const friendlyTitle = PENDING_FRIENDLY_TITLES[route.name] || 'Coming Soon';
  const blurb = PENDING_BLURB[route.name] || 'This feature is on its way to iOS.';
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.title}>{friendlyTitle}</Text>
        <Text style={styles.subtitle}>{blurb}</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Suspense fallback while a lazy chunk loads ──────────────────

function LoadingScreen() {
  return (
    <View style={[styles.center, styles.root]}>
      <Text style={styles.title}>Nunba Companion</Text>
      <ActivityIndicator color="#6C63FF" size="large" />
    </View>
  );
}

// ─── Error boundary so a single broken screen doesn't crash everything ──

interface ErrorBoundaryState {
  err: Error | null;
}
class ScreenErrorBoundary extends React.Component<
  {children: React.ReactNode; routeName: string},
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {err: null};
  static getDerivedStateFromError(err: Error): ErrorBoundaryState {
    return {err};
  }
  componentDidCatch(err: Error) {
    console.warn(`[Route ${this.props.routeName}] render error:`, err);
  }
  render() {
    if (this.state.err) {
      return (
        <View style={[styles.center, styles.root]}>
          <Text style={styles.title}>{this.props.routeName}</Text>
          <Text style={styles.subtitle}>Render error — see console</Text>
          <Text style={styles.hint}>{this.state.err.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function withGuards<P extends object>(
  Component: React.ComponentType<P>,
  routeName: string,
): React.FC<P> {
  return (props: P) => (
    <ScreenErrorBoundary routeName={routeName}>
      <React.Suspense fallback={<LoadingScreen />}>
        <Component {...props} />
      </React.Suspense>
    </ScreenErrorBoundary>
  );
}

// ─── App root ────────────────────────────────────────────────────

// DIAGNOSTIC: tracer logs for CI smoke debugging. console.log
// goes through RN's logger to NSLog, visible in our captured
// simulator console (filterable via grep on NunbaCompanion[).
console.log('[App.tsx] module evaluated');

function App(): React.JSX.Element {
  console.log('[App.tsx] render called');
  // Auth gating — show signup until token is set.
  // Flag is set on app launch from OnboardingModule.getAccessToken.
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const checkAuth = useCallback(() => {
    const m = NativeModules.OnboardingModule;
    // Splash hold tuned for awesome cold-launch UX: 1500ms is enough
    // for the user to see the brand without feeling like the app is
    // slow.  The smoke-test contract is now decoupled from this
    // timing — we render a stable accessibilityIdentifier
    // ("root-loaded") post-auth-resolution, so SmokeUITests can wait
    // for the IDENTIFIER instead of racing the splash text.  See
    // review-2026-05-04 § 3 CRITICAL: 1.5s → 3s in two consecutive
    // commits chasing flake was a band-aid; the real fix is below.
    //
    // Auth-callback timeout: native modules can wedge on first launch
    // (cold-start race, simulator quirks).  Without a bound, the
    // splash hangs forever.  5 seconds is the upper bound after which
    // we assume "no token" and proceed to SignUp screen — the user
    // can always sign in from there.
    let called = false;
    const finish = (token: string | null) => {
      if (called) return;
      called = true;
      setIsAuthed(!!(token && token.length > 0));
      setTimeout(() => setAuthReady(true), 1500);
    };
    if (!m || typeof m.getAccessToken !== 'function') {
      finish(null);
      return;
    }
    setTimeout(() => finish(null), 5000); // hard upper bound
    m.getAccessToken((token: string | null) => finish(token));
  }, []);

  useEffect(() => {
    // Initial check on mount.
    checkAuth();

    // Re-check when app foregrounds (e.g. user came back from
    // OAuth in Safari) AND when JS-side auth code emits the
    // 'authChanged' DeviceEvent — emitted by services/socialApi
    // login helpers after OnboardingModule.setAccessToken resolves.
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        checkAuth();
      }
    });
    const authChangedSub = DeviceEventEmitter.addListener(
      'authChanged',
      checkAuth,
    );

    return () => {
      appStateSub.remove();
      authChangedSub.remove();
    };
  }, [checkAuth]);

  if (!authReady) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.center, styles.root]}>
          <Text style={styles.title}>Nunba Companion</Text>
          <ActivityIndicator color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {/* Stable accessibility marker for the smoke test.  Decouples
          XCUITests from splash-hold timing: SmokeUITests.swift can
          wait for app.staticTexts["root-loaded"] / the
          accessibilityIdentifier="root-loaded" with no race against
          when authReady flips.  Zero-sized so it never affects
          layout. */}
      <Text
        testID="root-loaded"
        style={{height: 0, width: 0, opacity: 0}}>
        NunbaCompanionReady
      </Text>
      <Stack.Navigator
        initialRouteName={isAuthed ? 'MainScreen' : 'SignUpCombined'}
        screenOptions={{
          headerStyle: {backgroundColor: '#0F0E17'},
          headerTintColor: '#FFFFFE',
          headerTitleStyle: {fontWeight: '700'},
          contentStyle: {backgroundColor: '#0F0E17'},
          headerShown: false,
        }}>
        {/* Auth */}
        <Stack.Screen
          name="SignUpCombined"
          component={withGuards(SignUpCombined, 'SignUpCombined')}
          options={{title: 'Welcome'}}
        />

        {/* Main */}
        <Stack.Screen name="MainScreen" component={withGuards(MainScreen, 'MainScreen')} options={{title: 'Nunba Companion'}} />
        <Stack.Screen name="ShareLanding" component={withGuards(ShareLandingScreen, 'ShareLanding')} options={{animation: 'fade'}} />
        <Stack.Screen name="Story" component={withGuards(StoryScreen, 'Story')} />
        <Stack.Screen name="LikesList" component={withGuards(LikesList, 'LikesList')} />
        <Stack.Screen name="CommentsList" component={withGuards(CommentsList, 'CommentsList')} />
        <Stack.Screen name="AddPost" component={withGuards(AddPost, 'AddPost')} />
        <Stack.Screen name="Report" component={withGuards(ReportModal, 'Report')} />
        <Stack.Screen name="ReportComment" component={withGuards(ReportModalComment, 'ReportComment')} />

        {/* Encounters */}
        <Stack.Screen name="Encounters" component={withGuards(EncountersScreen, 'Encounters')} options={{animation: 'fade'}} />
        <Stack.Screen name="CreateMissedConnection" component={PendingNativeDeps} />
        <Stack.Screen name="MissedConnectionDetail" component={PendingNativeDeps} />
        <Stack.Screen name="MissedConnectionsMap" component={PendingNativeDeps} />

        {/* Gamification */}
        <Stack.Screen name="ResonanceDashboard" component={withGuards(ResonanceDashboardScreen, 'ResonanceDashboard')} />
        <Stack.Screen name="Achievements" component={withGuards(AchievementsScreen, 'Achievements')} />
        <Stack.Screen name="Challenges" component={withGuards(ChallengesScreen, 'Challenges')} />
        <Stack.Screen name="ChallengeDetail" component={withGuards(ChallengeDetailScreen, 'ChallengeDetail')} />
        <Stack.Screen name="Season" component={withGuards(SeasonScreen, 'Season')} />
        <Stack.Screen name="Regions" component={withGuards(RegionsScreen, 'Regions')} />
        <Stack.Screen name="RegionDetail" component={withGuards(RegionDetailScreen, 'RegionDetail')} />
        <Stack.Screen name="AgentEvolution" component={withGuards(AgentEvolutionScreen, 'AgentEvolution')} />
        <Stack.Screen name="Campaigns" component={withGuards(CampaignsScreen, 'Campaigns')} />
        <Stack.Screen name="CampaignStudio" component={withGuards(CampaignStudioScreen, 'CampaignStudio')} />
        <Stack.Screen name="CampaignDetail" component={withGuards(CampaignDetailScreen, 'CampaignDetail')} />
        <Stack.Screen name="Onboarding" component={withGuards(OnboardingOverlayScreen, 'Onboarding')} options={{presentation: 'modal'}} />

        {/* Social */}
        <Stack.Screen name="PostDetail" component={withGuards(PostDetailScreen, 'PostDetail')} />
        <Stack.Screen name="Search" component={withGuards(SearchScreen, 'Search')} options={{animation: 'slide_from_bottom'}} />
        <Stack.Screen name="Notifications" component={withGuards(NotificationsScreen, 'Notifications')} />
        <Stack.Screen name="Communities" component={withGuards(CommunitiesScreen, 'Communities')} />
        <Stack.Screen name="CommunityDetail" component={withGuards(CommunityDetailScreen, 'CommunityDetail')} />
        <Stack.Screen name="Profile" component={withGuards(ProfileScreen, 'Profile')} options={{animation: 'slide_from_bottom'}} />
        <Stack.Screen name="Recipes" component={withGuards(RecipesScreen, 'Recipes')} />
        <Stack.Screen name="RecipeDetail" component={withGuards(RecipeDetailScreen, 'RecipeDetail')} />
        <Stack.Screen name="Tasks" component={withGuards(TasksScreen, 'Tasks')} />
        <Stack.Screen name="CodingAgent" component={withGuards(CodingAgentScreen, 'CodingAgent')} />
        <Stack.Screen name="AgentDashboard" component={withGuards(AgentDashboardScreen, 'AgentDashboard')} />

        {/* Games */}
        <Stack.Screen name="GameHub" component={withGuards(GameHubScreen, 'GameHub')} options={{animation: 'slide_from_bottom'}} />
        <Stack.Screen name="GameScreen" component={withGuards(GameScreen, 'GameScreen')} />

        {/* Kids */}
        <Stack.Screen name="KidsHub" component={withGuards(KidsHubScreen, 'KidsHub')} options={{animation: 'slide_from_bottom'}} />
        <Stack.Screen name="KidsGame" component={withGuards(KidsGameScreen, 'KidsGame')} options={{animation: 'slide_from_bottom'}} />
        <Stack.Screen name="KidsProgress" component={withGuards(KidsProgressScreen, 'KidsProgress')} />
        <Stack.Screen name="GameCreator" component={withGuards(GameCreatorScreen, 'GameCreator')} />
        <Stack.Screen name="CustomGames" component={withGuards(CustomGamesScreen, 'CustomGames')} />

        {/* Experiments + Federation */}
        <Stack.Screen name="ExperimentDiscovery" component={withGuards(ExperimentDiscoveryScreen, 'ExperimentDiscovery')} />
        <Stack.Screen name="FederatedFeed" component={withGuards(FederatedFeedScreen, 'FederatedFeed')} options={{animation: 'fade'}} />

        {/* Hive */}
        <Stack.Screen name="AgentHive" component={withGuards(AgentHiveScreen, 'AgentHive')} />
        <Stack.Screen name="AgentHiveDetail" component={withGuards(AgentHiveDetailScreen, 'AgentHiveDetail')} />
        <Stack.Screen name="AgentInterview" component={withGuards(AgentInterviewScreen, 'AgentInterview')} />

        {/* Mindstory + All Features */}
        <Stack.Screen name="Mindstory" component={withGuards(MindstoryScreen, 'Mindstory')} options={{animation: 'slide_from_bottom'}} />
        <Stack.Screen name="AllFeatures" component={withGuards(AllFeaturesScreen, 'AllFeatures')} options={{presentation: 'transparentModal', animation: 'fade'}} />

        {/* Channels */}
        <Stack.Screen name="ChannelBindings" component={withGuards(ChannelBindingsScreen, 'ChannelBindings')} />
        <Stack.Screen name="ChannelSetup" component={withGuards(ChannelSetupScreen, 'ChannelSetup')} />
        <Stack.Screen name="QRScanner" component={PendingNativeDeps} />
        <Stack.Screen name="ConversationHistory" component={withGuards(ConversationHistoryScreen, 'ConversationHistory')} />

        {/* Admin */}
        <Stack.Screen name="ProviderManagement" component={withGuards(ProviderManagementScreen, 'ProviderManagement')} />

        {/* Settings parity ports */}
        <Stack.Screen name="BackupSettings" component={withGuards(BackupSettingsScreen, 'BackupSettings')} />
        <Stack.Screen name="ComputeDashboard" component={withGuards(ComputeDashboardScreen, 'ComputeDashboard')} />
        <Stack.Screen name="MCPToolBrowser" component={withGuards(MCPToolBrowserScreen, 'MCPToolBrowser')} />
        <Stack.Screen name="Marketplace" component={withGuards(MarketplaceScreen, 'Marketplace')} />
        <Stack.Screen name="ActivityHub" component={withGuards(ActivityHubScreen, 'ActivityHub')} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0F0E17'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24},
  title: {color: '#FFFFFE', fontSize: 26, fontWeight: '700', marginBottom: 8},
  subtitle: {color: '#A7A9BE', fontSize: 15, textAlign: 'center', marginBottom: 12},
  hint: {color: '#6B63F4', fontSize: 13, textAlign: 'center'},
});

// SafeAreaProvider must wrap any tree that uses SafeAreaView
// (or useSafeAreaInsets) from react-native-safe-area-context.
// Required since 0.81/19 dropped the legacy react-native version.
function AppRoot(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

export default AppRoot;
