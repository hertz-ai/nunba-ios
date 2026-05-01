/**
 * Nunba Companion — iOS app root.
 *
 * Sets up React Navigation NativeStack with placeholder screens.
 * Real screen components are pending — they live in
 * Hevolve_React_Native/components/ which are mostly cross-platform
 * but require per-component classification before vendoring.
 *
 * Deep linking config matches the URL schemes registered in
 * ios/NunbaCompanion/Info.plist (hevolve://, nunba://).
 */
import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import {NavigationContainer, LinkingOptions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

// Route map — eventual home for the screens registered on Android
// in components/CommunityView/router/home.routes.js. Each screen
// here is a placeholder until the corresponding component is ported.
type RootStackParamList = {
  Home: undefined;
  Profile: undefined;
  KidsHub: undefined;
  Encounters: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Deep linking config — mirrors Android's `linkingConfig` ──────

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['hevolve://', 'nunba://', 'https://hevolve.app'],
  config: {
    screens: {
      Home: '',
      Profile: 'profile/:userId?',
      KidsHub: 'kids',
      Encounters: 'encounters',
    },
  },
};

// ─── Placeholder screens ─────────────────────────────────────────

function HomeScreen({navigation}: any) {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Text style={styles.title}>Nunba Companion</Text>
        <Text style={styles.subtitle}>iOS port — scaffold</Text>

        <View style={styles.navList}>
          {(['Profile', 'KidsHub', 'Encounters'] as const).map((screen) => (
            <TouchableOpacity
              key={screen}
              style={styles.navButton}
              onPress={() => navigation.navigate(screen)}>
              <Text style={styles.navButtonText}>{screen}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function PlaceholderScreen({route, navigation}: any) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.title}>{route.name}</Text>
        <Text style={styles.subtitle}>
          Pending port from Hevolve_React_Native components/
        </Text>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.navButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── App root ────────────────────────────────────────────────────

function App(): React.JSX.Element {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {backgroundColor: '#0F0E17'},
          headerTintColor: '#FFFFFE',
          headerTitleStyle: {fontWeight: '700'},
          contentStyle: {backgroundColor: '#0F0E17'},
        }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{title: 'Nunba Companion'}}
        />
        <Stack.Screen name="Profile" component={PlaceholderScreen} />
        <Stack.Screen name="KidsHub" component={PlaceholderScreen} />
        <Stack.Screen name="Encounters" component={PlaceholderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0F0E17'},
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: '#FFFFFE',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {color: '#A7A9BE', fontSize: 16, marginBottom: 32},
  navList: {width: '100%', gap: 12},
  navButton: {
    backgroundColor: '#6B63F4',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  navButtonText: {color: '#FFFFFE', fontWeight: '600', fontSize: 16},
});

export default App;
