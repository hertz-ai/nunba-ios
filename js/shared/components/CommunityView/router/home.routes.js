import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EntypoIcons from 'react-native-vector-icons/Entypo';
import IonIcons from 'react-native-vector-icons/Ionicons';
import { Text } from 'react-native';
import MainScreen from '../screens/MainScreen';
import StoryScreen from '../screens/StoryScreen';
import CommentsList from '../components/Post/components/Footer/CommentsList'
import LikesList from '../components/Post/components/Footer/LikesList';
import AddPost from '../components/FeedHeader/AddPost/addPost';
import ReportModal from '../components/Post/components/Header/ReportModal';
import ReportModalComment from '../components/Post/components/Footer/ReportModalComment';
// Encounters (Geolocation)
import EncountersScreen from '../screens/EncountersScreen';
import MissedConnectionDetailScreen from '../screens/MissedConnectionDetailScreen';
import CreateMissedConnectionScreen from '../screens/CreateMissedConnectionScreen';
import MissedConnectionsMapScreen from '../screens/MissedConnectionsMapScreen';
// Gamification Screens
import ResonanceDashboardScreen from '../screens/ResonanceDashboardScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import ChallengesScreen from '../screens/ChallengesScreen';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import SeasonScreen from '../screens/SeasonScreen';
import RegionsScreen from '../screens/RegionsScreen';
import RegionDetailScreen from '../screens/RegionDetailScreen';
import AgentEvolutionScreen from '../screens/AgentEvolutionScreen';
import CampaignsScreen from '../screens/CampaignsScreen';
import CampaignStudioScreen from '../screens/CampaignStudioScreen';
import CampaignDetailScreen from '../screens/CampaignDetailScreen';
import OnboardingOverlayScreen from '../screens/OnboardingOverlayScreen';
// Share deep-link resolver
import ShareLandingScreen from '../screens/ShareLandingScreen';
// Social feature screens
import PostDetailScreen from '../screens/PostDetailScreen';
import SearchScreen from '../screens/SearchScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CommunitiesScreen from '../screens/CommunitiesScreen';
import CommunityDetailScreen from '../screens/CommunityDetailScreen';
import FriendsScreen from '../screens/FriendsScreen';
import InvitesScreen from '../screens/InvitesScreen';
import CallChannelScreen from '../screens/CallChannelScreen';
import BackupSettingsScreen from '../screens/BackupSettingsScreen';
import ComputeDashboardScreen from '../screens/ComputeDashboardScreen';
import MCPToolBrowserScreen from '../screens/MCPToolBrowserScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import ActivityHubScreen from '../screens/ActivityHubScreen';
import ThemeSettingsScreen from '../screens/ThemeSettingsScreen';
import AutopilotScreen from '../screens/AutopilotScreen';
import InstitutionSignupScreen from '../screens/InstitutionSignupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RecipesScreen from '../screens/RecipesScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import TasksScreen from '../screens/TasksScreen';
import CodingAgentScreen from '../screens/CodingAgentScreen';
import AgentDashboardScreen from '../screens/AgentDashboardScreen';
// Adult Games
import GameHubScreen from '../screens/GameHubScreen';
import GameScreen from '../screens/GameScreen';
// Kids Learning Zone
import KidsHubScreen from '../screens/KidsHub';
import KidsGameScreen from '../screens/KidsGameScreen';
import KidsProgressScreen from '../screens/KidsProgressScreen';
import GameCreatorScreen from '../screens/GameCreatorScreen';
import CustomGamesScreen from '../screens/CustomGamesScreen';
// Experiments
import ExperimentDiscoveryScreen from '../screens/ExperimentDiscoveryScreen';
// Agent Hive
import AgentHiveScreen from '../screens/AgentHiveScreen';
import AgentHiveDetailScreen from '../screens/AgentHiveDetailScreen';
import AgentInterviewScreen from '../screens/AgentInterviewScreen';
// Mindstory AI Video
import MindstoryScreen from '../screens/MindstoryScreen';
// All Features grid
import AllFeaturesScreen from '../screens/AllFeaturesScreen';
// TV Support
import TVHomeScreen from '../screens/TVHomeScreen';
// Federation (P2P content)
import FederatedFeedScreen from '../screens/FederatedFeedScreen';
// Channel Management
import ChannelBindingsScreen from '../screens/ChannelBindingsScreen';
import ChannelSetupScreen from '../screens/ChannelSetupScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import ConversationHistoryScreen from '../screens/ConversationHistoryScreen';
// Provider Management (admin)
import ProviderManagementScreen from '../screens/ProviderManagementScreen';

const Stack = createNativeStackNavigator();

const HomeRoutes = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainScreen"
        component={MainScreen}
        options={{
          title: 'Community',
          headerShown: false,
        }}
      />
      {/* Share deep-link resolver (hevolve.ai/s/:token) */}
      <Stack.Screen name="ShareLanding" component={ShareLandingScreen} options={{headerShown: false, animation: 'fade'}} />

      <Stack.Screen
        name="Story"
        component={StoryScreen}
       
      />
      <Stack.Screen
        name="LikesList"
        component={LikesList
        }
        options={{
          headerShown: false,
        }}
      
      />
      <Stack.Screen
        name="CommentsList"
        component={CommentsList
        }
       options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddPost"
        component={AddPost
        }
       options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Report"
        component={ReportModal
        }
       options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ReportComment"
        component={ReportModalComment
        }
       options={{
          headerShown: false,
        }}
      />
      {/* Encounters (Geolocation) */}
      <Stack.Screen name="Encounters" component={EncountersScreen} options={{headerShown: false, animation: 'fade'}} />
      <Stack.Screen name="MissedConnectionDetail" component={MissedConnectionDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="CreateMissedConnection" component={CreateMissedConnectionScreen} options={{headerShown: false}} />
      <Stack.Screen name="MissedConnectionsMap" component={MissedConnectionsMapScreen} options={{headerShown: false}} />

      {/* Gamification Screens */}
      <Stack.Screen name="ResonanceDashboard" component={ResonanceDashboardScreen} options={{headerShown: false}} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} options={{headerShown: false}} />
      <Stack.Screen name="Challenges" component={ChallengesScreen} options={{headerShown: false}} />
      <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="Season" component={SeasonScreen} options={{headerShown: false}} />
      <Stack.Screen name="Regions" component={RegionsScreen} options={{headerShown: false}} />
      <Stack.Screen name="RegionDetail" component={RegionDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="AgentEvolution" component={AgentEvolutionScreen} options={{headerShown: false}} />
      <Stack.Screen name="Campaigns" component={CampaignsScreen} options={{headerShown: false}} />
      <Stack.Screen name="CampaignStudio" component={CampaignStudioScreen} options={{headerShown: false}} />
      <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="Onboarding" component={OnboardingOverlayScreen} options={{headerShown: false, presentation: 'modal'}} />

      {/* Social feature screens */}
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="Search" component={SearchScreen} options={{headerShown: false, animation: 'slide_from_bottom'}} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{headerShown: false}} />
      <Stack.Screen name="Communities" component={CommunitiesScreen} options={{headerShown: false}} />
      <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="Friends" component={FriendsScreen} options={{headerShown: false}} />
      <Stack.Screen name="Invites" component={InvitesScreen} options={{headerShown: false, presentation: 'modal'}} />
      <Stack.Screen name="CallChannel" component={CallChannelScreen} options={{headerShown: false, presentation: 'fullScreenModal'}} />
      <Stack.Screen name="BackupSettings" component={BackupSettingsScreen} options={{headerShown: false}} />
      <Stack.Screen name="ComputeDashboard" component={ComputeDashboardScreen} options={{headerShown: false}} />
      <Stack.Screen name="MCPToolBrowser" component={MCPToolBrowserScreen} options={{headerShown: false}} />
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{headerShown: false}} />
      <Stack.Screen name="ActivityHub" component={ActivityHubScreen} options={{headerShown: false}} />
      <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} options={{headerShown: false}} />
      <Stack.Screen name="Autopilot" component={AutopilotScreen} options={{headerShown: false}} />
      <Stack.Screen name="InstitutionSignup" component={InstitutionSignupScreen} options={{headerShown: false, presentation: 'modal'}} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{headerShown: false, animation: 'slide_from_bottom'}} />
      <Stack.Screen name="Recipes" component={RecipesScreen} options={{headerShown: false}} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="Tasks" component={TasksScreen} options={{headerShown: false}} />
      <Stack.Screen name="CodingAgent" component={CodingAgentScreen} options={{headerShown: false}} />
      <Stack.Screen name="AgentDashboard" component={AgentDashboardScreen} options={{headerShown: false}} />

      {/* Adult Games */}
      <Stack.Screen name="GameHub" component={GameHubScreen} options={{headerShown: false, animation: 'slide_from_bottom'}} />
      <Stack.Screen name="GameScreen" component={GameScreen} options={{headerShown: false}} />

      {/* Kids Learning Zone */}
      <Stack.Screen name="KidsHub" component={KidsHubScreen} options={{headerShown: false, animation: 'slide_from_bottom'}} />
      <Stack.Screen name="KidsGame" component={KidsGameScreen} options={{headerShown: false, animation: 'slide_from_bottom'}} />
      <Stack.Screen name="KidsProgress" component={KidsProgressScreen} options={{headerShown: false}} />
      <Stack.Screen name="GameCreator" component={GameCreatorScreen} options={{headerShown: false}} />
      <Stack.Screen name="CustomGames" component={CustomGamesScreen} options={{headerShown: false}} />

      {/* Experiments */}
      <Stack.Screen name="ExperimentDiscovery" component={ExperimentDiscoveryScreen} options={{headerShown: false}} />

      {/* Federation (P2P Feed) */}
      <Stack.Screen name="FederatedFeed" component={FederatedFeedScreen} options={{headerShown: false, animation: 'fade'}} />

      {/* Agent Hive */}
      <Stack.Screen name="AgentHive" component={AgentHiveScreen} options={{headerShown: false}} />
      <Stack.Screen name="AgentHiveDetail" component={AgentHiveDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="AgentInterview" component={AgentInterviewScreen} options={{headerShown: false}} />

      {/* Mindstory AI Video */}
      <Stack.Screen name="Mindstory" component={MindstoryScreen} options={{headerShown: false, animation: 'slide_from_bottom'}} />

      {/* All Features grid (See All fallback) */}
      <Stack.Screen name="AllFeatures" component={AllFeaturesScreen} options={{headerShown: false, presentation: 'transparentModal', animation: 'fade'}} />

      {/* TV Support */}
      <Stack.Screen name="TVHome" component={TVHomeScreen} options={{headerShown: false}} />

      {/* Channel Management */}
      <Stack.Screen name="ChannelBindings" component={ChannelBindingsScreen} options={{headerShown: false}} />
      <Stack.Screen name="ChannelSetup" component={ChannelSetupScreen} options={{headerShown: false}} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{headerShown: false}} />
      <Stack.Screen name="ConversationHistory" component={ConversationHistoryScreen} options={{headerShown: false}} />

      {/* Provider Management (admin) */}
      <Stack.Screen name="ProviderManagement" component={ProviderManagementScreen} options={{headerShown: false}} />
    </Stack.Navigator>
  );
};

export default HomeRoutes;
