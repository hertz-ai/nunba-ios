import React, { useEffect, useState } from 'react';
import { NativeModules, Linking, Platform } from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import Home from './Home';
import StudentLanguage from './StudentLanguage';
import StudentName from './StudentName';
import StudentDOB from './StudentDOB';
import StudentGender from './StudentGender';
import StudentPhoneEmail from './StudentPhoneEmail';
import WhoPays from './WhoPays';
import Grade from './Grade';
import AskUploadVideo from './AskUploadVideo';

const { OnboardingModule } = NativeModules;

const Stack = createNativeStackNavigator();

const options = {
  headerBackTitleVisible: false,
  cardStyleInterpolator: ({ current: { progress } }) => {
    return {
      cardStyle: {
        opacity: progress,
      },
    };
  },
};

const CompleteSignup = () => {
  const startState = {
    type: 'stack',
    key: 'stack-1',
    routeNames: [
      'StudentLanguage',
      'Home',
      'StudentName',
      'StudentDOB',
      'StudentGender',
      'StudentPhoneEmail',
      'Grade',
      'WhoPays',
      'AskUploadVideo',
    ],
    routes: [
      { key: 'StudentLanguage', name: 'StudentLanguage' },
    ],
    index: 0,
    stale: false,
  };
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState(startState);

  useEffect(() => {
    const restoreState = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (Platform.OS !== 'web' && initialUrl == null) {
          await OnboardingModule.getPageState((savedStateString) => {
            const state = savedStateString
              ? JSON.parse(savedStateString)
              : undefined;

            if (state !== undefined) {
              console.log('Restore state called with state', state);
              setInitialState(state);
            } else {
              console.log(
                'State undefined Restore state called, initial state is',
                initialState,
              );
            }
            setIsReady(true);
          });
        }
      } finally {
        // setIsReady(true);
      }
    };

    if (!isReady) {
      restoreState();
    } else {
      console.log('in else, current state is', initialState);
    }
  }, [isReady, initialState]);

  if (!isReady) {
    return null;
  }

  return (
    <NavigationContainer
      initialState={initialState}
      onStateChange={(state) => {
        console.log('OnStateChange called with state', state);
        OnboardingModule.createPageState(JSON.stringify(state));
      }}>
      <Stack.Navigator screenOptions={{ headerShown: false }} headerMode="none">
        {/* <Stack.Screen name='PhoneEmailandName' component={PhoneEmailandName} /> */}
        <Stack.Screen name="StudentLanguage" component={StudentLanguage} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen
          name="StudentName"
          component={StudentName}
          options={() => options}
        />

        <Stack.Screen name="StudentDOB" component={StudentDOB} />
        <Stack.Screen name="StudentGender" component={StudentGender} />
        <Stack.Screen name="StudentPhoneEmail" component={StudentPhoneEmail} />
        <Stack.Screen name="Grade" component={Grade} />
        <Stack.Screen name="WhoPays" component={WhoPays} />
        <Stack.Screen name="AskUploadVideo" component={AskUploadVideo} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default CompleteSignup;
