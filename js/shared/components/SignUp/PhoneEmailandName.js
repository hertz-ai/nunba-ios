/* eslint-disable no-trailing-spaces */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState, useRef } from 'react';
import {
  NativeModules,
  TouchableHighlight,
  DeviceEventEmitter,
  TouchableOpacity,
  ScrollView,
  View,
  Text,
  Button,
  StyleSheet,
  Image,
  TextInput,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import i18next from 'i18next';
import useLanguageStore from '../../zustandStore';
import axios from 'axios';
// The package exposes CountryPicker as its DEFAULT export only (index.js does
// `export default CountryPicker`). The previous named import resolved to
// `undefined`, so rendering <CountryPicker /> when the picker opened threw
// "Element type is invalid … got: undefined" — the "Select Country Code" crash.
import CountryPicker from 'react-native-country-codes-picker';

import resources from './translations';

// i18next is initialized here at module scope because this screen is the
// entry point of the iOS signup flow and renders WITHOUT any sibling
// screen (e.g. StudentLanguage) having run its own init() first. Without
// this, i18next.t(...) returns empty strings and every label on this
// screen — including the Submit button — renders blank. Mirror of the
// init() in the sibling SignUp screens; guarded so we don't re-init if a
// sibling already initialized it.
const defaultLanguage = 'en-US';
if (!i18next.isInitialized) {
  i18next.init({
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
    lng: defaultLanguage,
    resources,
  });
}

const { OnboardingModule, ActivityStarterModule } = NativeModules;

const PhoneEmailandName = ({ navigation }) => {
  const { width, height } = useWindowDimensions(); // Use the hook
  const orientation = width < height ? 'portrait' : 'landscape'; // Determine orientation

  const backButtonRef = useRef();
  const confirmButtonRef = useRef();
  const [show, setShow] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const { preferred_language, setpreferred_language } = useLanguageStore();
  const [studentName, setStudentName] = useState();
  const [userDetails, setuserDetails] = useState(false);

  const [question, setQuestions] = useState([
    {
      questionTitle: 'Tell me Your Mobile Number?',
    },
    {
      questionTitle: 'Tell me your Email Address?',
    },
  ]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [result, setResult] = useState('');
  const [Error, setError] = useState('');
  const [RecognizedTextForPhone, setRecognizedTextForPhone] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showFullSignup, setShowFullSignup] = useState(false);


  useEffect(() => {
    const restoreStudentNameAndEmail = async () => {
      if (
        !OnboardingModule ||
        typeof OnboardingModule.getStudentNameAndEmail !== 'function'
      ) {
        return;
      }
      OnboardingModule.getStudentNameAndEmail(
        (StudentName, StudentEmail, studentPhone) => {
          console.log(StudentName, StudentEmail, studentPhone, 'hello');
          if (StudentName != null) {
            setStudentName(StudentName);
          }
          if (StudentEmail != null) {
            console.log('this is the inner', StudentEmail);
            setStudentEmail(StudentEmail);
          }
          if (studentPhone != null) {
            console.log('this is the inner', studentPhone);
            setStudentPhone(studentPhone);
            // This is a phone-only screen — restore the saved phone but keep
            // the phone + country-code view. (Previously this flipped
            // userDetails=true, which switched the screen to the Email step on
            // every relaunch once a phone had been saved.)
          }
        },
      );
    };

    restoreStudentNameAndEmail();
  }, []);
  const navigateToFullSignUp = () => {
    ActivityStarterModule.navigateFullSignUp();
  };

  const reg = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w\w+)+$/;

  useEffect(() => {
    const eventListener = DeviceEventEmitter.addListener(
      'SpeechRecognizedEvent',
      (event) => {
        const { SpeechRecognizedText } = event;
        setRecognizedTextForPhone(SpeechRecognizedText);
      },
    );

    return () => {
      eventListener.remove();
    };
  }, []);

  const handleStartSpeechListening = () => {
    if (isRecording) {
      console.log('I am stopping recording');
      stopRecording();
    } else {
      console.log('I am starting recording');
      startRecording();
    }
  };

  const startRecording = () => {
    NativeModules.ActivityStarterModule.startSpeechListening();
    setIsRecording(true);
    setRecognizedTextForPhone('');
  };

  const stopRecording = () => {
    setIsRecording(false);
  };
  const handleCountrySelection = (item) => {
    if (!userDetails) {
      console.log(item);
      setCountryCode(item.dial_code);
    }
    setShow(false);
  };

  // Navigate onward after a successful signup. On the iOS port the native
  // ActivityStarterModule (which owns native-activity navigation on
  // Android) isn't implemented yet, so guard the call and surface a clear
  // message instead of throwing "undefined is not an object".
  const proceedAfterSignup = () => {
    const starter = NativeModules.ActivityStarterModule;
    if (starter && typeof starter.navigateToOtpVerification === 'function') {
      confirmButtonRef.current
        ?.fadeIn(600)
        .then(() => {
          starter.navigateToOtpVerification();
        });
    } else {
      alert(
        'Your details have been saved. OTP verification is coming soon on iOS.',
      );
    }
  };

  // Shared submit handler for both portrait and landscape layouts. Persists
  // the entered details via the native module (when available) and kicks
  // off signup. Each native call is guarded with a typeof check — same
  // pattern as services/currentUser.js — so a missing method on the iOS
  // port degrades gracefully rather than crashing the screen.
  const submitSignup = (phoneNumber) => {
    console.log(
      'this is the create student',
      studentName,
      studentEmail,
      phoneNumber,
    );
    if (
      OnboardingModule &&
      typeof OnboardingModule.createStudentNameAndEmail === 'function'
    ) {
      OnboardingModule.createStudentNameAndEmail(
        studentName,
        studentEmail,
        phoneNumber,
      );
    }
    if (OnboardingModule && typeof OnboardingModule.signUp === 'function') {
      OnboardingModule.signUp((user, error) => {
        console.log('User:', user);
        console.log('Error:', error);
        if (null == error || '' == error) {
          proceedAfterSignup();
        } else {
          alert(error);
        }
      });
    } else {
      // No native signUp on this platform (iOS port). The details are
      // already persisted above; surface the next step gracefully.
      proceedAfterSignup();
    }
  };

  return (
    <>
      {orientation === 'portrait' ? (
        <View style={styles.container}>
          <Text style={styles.subtitle}>
            {i18next.t('Few more steps and we are all set')}
          </Text>
          <Text style={styles.mid_title}>
            {i18next.t('Your Personal Details, Please 😁')}
          </Text>

          <Text style={styles.mid_subtitle}>Name</Text>
          <TextInput
            style={styles.text_input}
            placeholder="Ex: Rishabh"
            value={studentName}
            onChangeText={(newName) => setStudentName(newName)}
          />

          {userDetails ? (
            <>
              <Text style={styles.mid_subtitle}>Email</Text>
              <TextInput
                style={styles.text_input}
                placeholder="Ex: Rishabh@gmail.com"
                value={studentEmail}
                onChangeText={(newEmail) => setStudentEmail(newEmail)}
              />
            </>
          ) : (
            <>
              <Text style={styles.mid_subtitle}>Phone Number</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  onPress={() => setShow(true)}
                  style={styles.countryButton}
                >
                  {countryCode ? (
                    <Text style={styles.buttonText1}>{countryCode}</Text>
                  ) : (
                    <Text style={styles.buttonText}>{'Select Country Code'}</Text>
                  )}
                </TouchableOpacity>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ex: 0123456789"
                  value={studentPhone}
                  keyboardType="numeric"
                  onChangeText={(newPhone) => setStudentPhone(newPhone)}
                />
              </View>

              {show && (
                <CountryPicker
                  show={show}
                  pickerButtonOnPress={handleCountrySelection}
                />
              )}
            </>
          )}
          <View
            style={{
              display: 'flex',

              display: 'flex',
              justifyContent: showFullSignup ? 'space-between' : 'center',
              alignItems: 'center',
              flexDirection: 'row',
              width: wp('100%'),
            }}
          >
            {showFullSignup && (
              <Animatable.View
                ref={confirmButtonRef}
                duration={600}
                style={{ marginLeft: wp('2%') }}
                easing="ease-in-out"
              >
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => {
                    ActivityStarterModule.navigateToCompleteSignUp();
                  }}
                >
                  <Text style={styles.btn_text}>Full Signup</Text>
                </TouchableOpacity>
              </Animatable.View>)}
            <Animatable.View
              ref={confirmButtonRef}
              duration={600}
              easing="ease-in-out"
            >
              <TouchableOpacity
                style={styles.btn1}
                onPress={() => {
                  if (!studentName) {
                    alert('Name cannot be blank');
                    return;
                  }
                  // This screen is phone-only: validate the field that's
                  // actually shown. Only the email view (userDetails) requires
                  // an email; the phone view requires phone + country code.
                  if (userDetails) {
                    if (!reg.test(studentEmail)) {
                      alert('Enter valid Email');
                      return;
                    }
                    submitSignup(studentPhone);
                  } else {
                    if (!studentPhone) {
                      alert('Enter valid Contact');
                      return;
                    }
                    if (!countryCode) {
                      alert('Select Country Code');
                      return;
                    }
                    submitSignup(countryCode + studentPhone);
                  }
                }}
              >
                <Text style={styles.btn_text}>{i18next.t('Submit')}</Text>
              </TouchableOpacity>
            </Animatable.View>
          </View>

          <Text style={styles.voice_text}>
            {i18next.t('You can use this mic for voice commands!')}
          </Text>
          <TouchableOpacity onPress={handleStartSpeechListening}>
            <Image
              style={styles.micImg}
              source={require('../../images/mic.png')}
            />
            <Text>{isRecording ? 'Stop Recording' : 'Start Recording'}</Text>
          </TouchableOpacity>
          <Text>{question[activeQuestionIndex]?.questionTitle}</Text>
          <Text>Recognized Text: {RecognizedTextForPhone}</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <Text style={landscapeStyles.mid_title}>
            {i18next.t('Your Personal Details, Please 😁')}
          </Text>

          <View style={landscapeStyles.nameEmailContainer}>
            <Text style={landscapeStyles.mid_subtitle}>Name :</Text>
            <TextInput
              style={landscapeStyles.text_input}
              placeholder="Ex: Rishabh"
              value={studentName}
              onChangeText={(newName) => setStudentName(newName)}
            />

            <Text style={landscapeStyles.mid_subtitle}>E-mail :</Text>
            <TextInput
              style={landscapeStyles.text_input}
              placeholder={
                studentEmail ? studentEmail : 'Ex: Rishabh@gmail.com'
              }
              value={studentEmail}
              onChangeText={(newEmail) => setStudentEmail(newEmail)}
            />
          </View>

          <View
            style={{
              display: 'flex',
              justifyContent: showFullSignup ? 'space-between' : 'center',

              alignItems: 'center',
              flexDirection: 'row',
              width: wp('100%'),
            }}
          >
            {showFullSignup && (<Animatable.View
              ref={confirmButtonRef}
              duration={600}
              style={{ marginLeft: wp('2%') }}
              easing="ease-in-out"
            >
              <TouchableOpacity
                style={styles.btn}
                onPress={() => {
                  ActivityStarterModule.navigateToCompleteSignUp();
                }}
              >
                <Text style={styles.btn_text}>Full Signup</Text>
              </TouchableOpacity>
            </Animatable.View>)}


            <Animatable.View
              ref={confirmButtonRef}
              duration={600}
              easing="ease-in-out"
            >
              <TouchableOpacity
                onPress={() => {
                  if (!studentName) {
                    alert('Name cannot be blank');
                    return;
                  }
                  // Phone-only screen: only the email view (userDetails)
                  // requires an email; the phone view requires phone + code.
                  if (userDetails) {
                    if (!reg.test(studentEmail)) {
                      alert('Enter valid Email');
                      return;
                    }
                    submitSignup(studentPhone);
                  } else {
                    if (!studentPhone) {
                      alert('Enter valid Contact');
                      return;
                    }
                    if (!countryCode) {
                      alert('Select Country Code');
                      return;
                    }
                    submitSignup(countryCode + studentPhone);
                  }
                }}
                style={landscapeStyles.btn}
              >
                <Text style={landscapeStyles.btn_text}>
                  {i18next.t('Submit')}
                </Text>
              </TouchableOpacity>
            </Animatable.View>
          </View>

          <Text style={landscapeStyles.voice_text}>
            {i18next.t('You can use this mic for voice commands!')}
          </Text>
          <TouchableOpacity onPress={handleStartSpeechListening}>
            <Image
              style={landscapeStyles.micImg}
              source={require('../../images/mic.png')}
            />
            <Text>{isRecording ? 'Stop Recording' : 'Start Recording'}</Text>
          </TouchableOpacity>
          <Text>{question[activeQuestionIndex]?.questionTitle}</Text>
          <Text>Recognized Text: {RecognizedTextForPhone}</Text>
        </View>
      )}
    </>
  );
};

// React Native Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  subtitle: {
    // Clear the iPhone status bar / notch — the screen isn't wrapped in a
    // SafeAreaView, so the first element must inset itself or it renders
    // behind the clock (~59pt safe-area top on notched devices).
    marginTop: hp('8%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
  },
  mid_title: {
    marginVertical: hp('7%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
    alignSelf: 'center',
  },
  mid_subtitle: {
    fontFamily: 'Roboto-Medium',
    fontSize: wp('5.3%'),
  },
  text_input: {
    width: wp('57%'),
    marginBottom: hp('8%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
    color: '#676767',
    borderBottomWidth: hp('0.15%'),
    borderBottomColor: '#707070',
  },
  btn: {
    width: wp('40%'),
    height: hp('5.7%'),
    backgroundColor: '#0078FF',
    borderRadius: hp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn1: {
    width: wp('40%'),
    height: hp('5.7%'),
    backgroundColor: '#0078FF',
    borderRadius: hp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('2%'),
  },
  btn_text: {
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.3%'),
    color: '#FFFFFF',
  },
  voice_text: {
    marginTop: hp('7%'),
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.3%'),
    color: '#0078FF',
  },
  micImg: {
    width: wp('11.5%'),
    height: undefined,
    aspectRatio: 55 / 80,
    display: 'flex',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: wp('80%'),
    borderRadius: 4,
    marginBottom: hp('8%'),
  },
  countryButton: {
    width: wp('20%'),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderBottomColor: '#707070',
    borderWidth: 1,
  },
  buttonText: {
    color: 'black',
    fontSize: wp('3.3%'),
  },
  buttonText1: {
    color: 'black',
    fontSize: wp('5.3%'),
    paddingVertical: 4,
  },
  textInput: {
    width: wp('57%'),
    borderBottomWidth: hp('0.15%'),
    borderBottomColor: '#707070',
    backgroundColor: 'white',
    marginLeft: 10,
    fontSize: wp('5.3%'),
    color: 'black',
  },
});

const landscapeStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  nameEmailContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('5%'),
    marginTop: hp('4%'),
  },
  text_input: {
    width: wp('30%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('2.3%'),
    color: '#676767',
    borderBottomWidth: hp('0.15%'),
    borderBottomColor: '#707070',
    height: 'auto',
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginRight: 20,
  },
  subtitle: {
    marginTop: hp('1%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('2.3%'),
  },
  mid_title: {
    marginVertical: hp('2%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('3.0%'),
    alignSelf: 'center',
  },
  mid_subtitle: {
    fontFamily: 'Roboto-Medium',
    fontSize: wp('2.3%'),
  },
  btn: {
    width: wp('20%'),
    backgroundColor: '#0078FF',
    borderRadius: hp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('3%'),
  },
  btn_text: {
    fontFamily: 'Roboto-Medium',
    fontSize: wp('2.3%'),
    color: '#FFFFFF',
  },
  voice_text: {
    marginTop: hp('4%'),
    fontFamily: 'Roboto-Medium',
    fontSize: wp('2.3%'),
    color: '#0078FF',
  },
  micImg: {
    width: wp('4.5%'),
    height: undefined,
    aspectRatio: 55 / 80,
    display: 'flex',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
});

export default PhoneEmailandName;
