import React, {useEffect, useState} from 'react';
import {
  NativeModules,
  ScrollView,
  View,
  Text,
  Button,
  StyleSheet,
  Image,
  Linking, Platform

} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import PhoneEmailandName from './PhoneEmailandName';

const {OnboardingModule} = NativeModules;

const Stack = createNativeStackNavigator();


//   {
//     Home: Home,
//     StudentName: StudentName,
//   },
//   {
//     initialRouteName: 'Home',
//   }
// );

const options = {
  headerBackTitleVisible: false,
  cardStyleInterpolator: ({current: {progress}}) => {
    return {
      cardStyle: {
        opacity: progress,
      },
    };
  },
};

const SignUpCombined = () => {
  const startState = {
    type: 'stack',
    key: 'stack-1',
    routeNames: [
      'PhoneEmailandName',


    ],
    routes: [
      //                           { key: 'whoPays', name: 'WhoPays'},
      {key: 'PhoneEmailandName', name: 'PhoneEmailandName'},
      //
      // {key: 'home', name: 'Home'},

      //                          { key: 'studentName', name: 'StudentName'},
      //                          { key: 'studentDOB', name: 'StudentDOB'},
      //                          { key: 'studentGender', name: 'StudentGender'},
      //                          { key: 'studentPhoneEmail', name: 'StudentPhoneEmail'},
      //                          { key: 'whoPays', name: 'WhoPays'},
      //                          { key: 'askUploadVideo', name: 'AskUploadVideo'},
      //                          { key: 'map1', name: 'map'}
    ],
    index: 0,
    stale: false,
  };
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState(startState);
  //    const [studentName,setStudentName] = useState("");

  useEffect(() => {
    const restoreState = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (Platform.OS !== 'web' && initialUrl == null) {
          // Only restore state if there's no deep link and we're not on web
          //              const savedStateString = await AsyncStorage.getItem(PERSISTENCE_KEY);
          await OnboardingModule.getPageState(savedStateString => {
            const state = savedStateString
              ? JSON.parse(savedStateString)
              : undefined;

            if (state !== undefined) {
              console.log('Restore state called with state', state);
              setInitialState(state);
              //                                                                                console.log("Restore state setInitial state, Initial state now ", initialState);
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
        //            setIsReady(true);
      }
    };

    //        const restoreStudentName = async () => {
    //
    //                          await OnboardingModule.getStudentName((StudentName) => {
    //                                                                      if(StudentName!==null)
    //                                                                           setStudentName(StudentName);
    //                                                                  });
    //
    //                                                         }

    if (!isReady) {
      restoreState();
    } else {
      console.log('in else, current state is', initialState);
    }

    //        restoreStudentName();
  }, [isReady, initialState]);

  if (!isReady) {
    return null;
  }

  return (
<NavigationContainer
       initialState={initialState}
       onStateChange={state => {
         console.log('OnStateChange c11111alled with state', state);
         OnboardingModule.createPageState(JSON.stringify(state));
       }}>
<Stack.Navigator screenOptions={{headerShown: false}}>
<Stack.Screen name='PhoneEmailandName' component={PhoneEmailandName} />
</Stack.Navigator>
</NavigationContainer>
   );
};

export default SignUpCombined;