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
import { CountryList, CountryPicker } from 'react-native-country-codes-picker';

import resources from './translations';

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
            setuserDetails(true);
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
                  } else if (!reg.test(studentEmail)) {
                    alert('Enter valid Email');
                    return;
                  } else if (!studentPhone) {
                    alert('Enter valid Contact');
                    return;
                  } else {
                    console.log(
                      'this is the create student',
                      studentName,
                      studentEmail,
                      studentPhone,
                    );
                    OnboardingModule.createStudentNameAndEmail(
                      studentName,
                      studentEmail,
                      studentPhone,
                    );

                    OnboardingModule.signUp((user, error) => {
                      console.log('User:', user);
                      console.log('Error:', error);
                      if (null == error || '' == error) {
                        console.log('User Detail:', user);

                        confirmButtonRef.current.fadeIn(600).then(() => {
                          NativeModules.ActivityStarterModule.navigateToOtpVerification();
                          console.log('User with in Detail:', user);
                        });
                      } else {
                        alert(error);
                      }
                      console.log('Error this ', error);
                      console.log('User this', user);
                    });
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
                  } else if (!reg.test(studentEmail)) {
                    alert('Enter valid Email');
                    return;
                  } else if (!studentPhone) {
                    alert('Enter valid Contact');
                    return;
                  } else if (!countryCode) {
                    alert('Select Country Code');
                    return;
                  } else {
                    const fullPhoneNumber = countryCode + studentPhone;
                    console.log(
                      'this is the create student',
                      studentName,
                      studentEmail,
                      fullPhoneNumber,
                    );
                    OnboardingModule.createStudentNameAndEmail(
                      studentName,
                      studentEmail,
                      fullPhoneNumber,
                    );

                    OnboardingModule.signUp((user, error) => {
                      console.log('User:', user);
                      console.log('Error:', error);
                      if (null == error || '' == error) {
                        console.log('User Detail:', user);

                        confirmButtonRef.current.fadeIn(600).then(() => {
                          NativeModules.ActivityStarterModule.navigateToOtpVerification();
                          console.log('User with in Detail:', user);
                        });
                      } else {
                        alert(error);
                        console.log(error, 'this is the error');
                      }
                      console.log('Error this ', error);
                      console.log('User this', user);
                    });
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
    marginTop: hp('3%'),
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
