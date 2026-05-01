/* eslint-disable no-trailing-spaces */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState, useRef } from 'react';
import {
  NativeModules,
  FlatList,
  Modal,
  Dimensions,
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
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import i18next from 'i18next';
import useLanguageStore from '../../zustandStore';
import { CountryList, CountryPicker } from 'react-native-country-codes-picker';
import axios from 'axios';

import resources from './translations';

const { OnboardingModule } = NativeModules;
const { SCREEN_WIDTH, SCREEN_HEIGHT } = Dimensions.get('window');
const { height } = Dimensions.get('window');



const StudentPhoneEmail = ({ navigation }) => {
  const backButtonRef = useRef();
  const confirmButtonRef = useRef();

  const [studentPhone, setStudentPhone] = useState(null);
  const [studentEmail, setStudentEmail] = useState(null);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const { preferred_language, setpreferred_language } = useLanguageStore();

  const [languages, setLangauges] = useState([
    { name: 'English', selected: true, value: 'en-US', uniqueName: 'English' },
    { name: 'हिन्दी', selected: false, value: 'hi-IN', uniqueName: 'Hindi' },
    { name: 'বাংলা (Bengali)', selected: false, value: 'bn-IN', uniqueName: 'Bengali' },
    { name: 'தமிழ் (Tamil)', selected: false, value: 'ta-IN', uniqueName: 'Tamil' },
    { name: 'ਪੰਜਾਬੀ (Punjabi)', selected: false, value: 'pa-IN', uniqueName: 'Punjabi' },
    { name: 'ગુજરાતી (Gujarati)', selected: false, value: 'gu-IN', uniqueName: 'Gujarati' },
    { name: 'ಕನ್ನಡ (Kannada)', selected: false, value: 'kn-IN', uniqueName: 'Kannada' },
    { name: 'తెలుగు (Telugu)', selected: false, value: 'te-IN', uniqueName: 'Telugu' },
    { name: 'मराठी (Marathi)', selected: false, value: 'mr-IN', uniqueName: 'Marathi' },
    { name: 'മലയാളം (Malayalam)', selected: false, value: 'ml-IN', uniqueName: 'Malayalam' },
    { name: 'عربي(Arabic)', selected: false, value: 'ar', uniqueName: 'Arabic' },
    { name: 'български (Bulgarian )', selected: false, value: 'bg', uniqueName: 'Bulgarian' },
    { name: '客家漢語 (Hakka Chinese)', selected: false, value: 'zh', uniqueName: 'HakkaChinese' },
    { name: 'Nederlands (Dutch)', selected: false, value: 'nl', uniqueName: 'Dutch ' },
    { name: 'suomalainen (Finnish )', selected: false, value: 'fi', uniqueName: 'Finnish ' },
    { name: 'Français (French)', selected: false, value: 'fr', uniqueName: 'French  ' },
    { name: ' Deutsch (German  )', selected: false, value: 'de', uniqueName: 'German  ' },
    { name: 'ελληνικά (Greek)', selected: false, value: 'el', uniqueName: 'Greek' },
    { name: 'עִברִית (Hebrew)', selected: false, value: 'he', uniqueName: 'Hebrew  ' },
    { name: 'magyar (Hungarian)', selected: false, value: 'hu', uniqueName: 'Hungarian  ' },
    { name: 'íslenskur (Icelandic  )', selected: false, value: 'is', uniqueName: 'Icelandic  ' },
    { name: 'Indonesia (Indonesian)', selected: false, value: 'id', uniqueName: 'Indonesian' },
    { name: '한국인 (Korean)', selected: false, value: 'ko', uniqueName: 'Korean' },
    { name: 'latviski (Latvian  )', selected: false, value: 'lv', uniqueName: 'Latvian' },
    { name: 'Melayu (Malay)', selected: false, value: 'ms', uniqueName: 'Malay' },
    { name: 'فارسی (Persian)', selected: false, value: 'fa', uniqueName: 'Persian' },
    { name: 'Polski (Polish)', selected: false, value: 'pl', uniqueName: 'Polish' },
    { name: 'Português (Portuguese)', selected: false, value: 'pt', uniqueName: 'Portuguese' },
    { name: 'română (Romanian)', selected: false, value: 'ro', uniqueName: 'Romanian' },
    { name: 'Русский (Russian)', selected: false, value: 'ru', uniqueName: 'Russian' },
    { name: 'Española (Spanish)', selected: false, value: 'es', uniqueName: 'Spanish' },
    { name: 'kiswahili (Swahili )', selected: false, value: 'sw', uniqueName: 'Swahili' },
    { name: 'svenska (Swedish)', selected: false, value: 'sv', uniqueName: 'Swedish' },
    { name: 'แบบไทย (Thai )', selected: false, value: 'th', uniqueName: 'Thai' },
    { name: 'Türkçe(Turkish )', selected: false, value: 'tr', uniqueName: 'Turkish' },
    { name: 'українська (Ukrainian )', selected: false, value: 'uk', uniqueName: 'Ukrainian' },
    { name: 'اردو (Urdu)', selected: false, value: 'ur', uniqueName: 'Urdu' },
    { name: 'Tiếng Việt(Vietnamese )', selected: false, value: 'vi', uniqueName: 'Vietnamese' },
    { name: 'Cymraeg (Welsh)', selected: false, value: 'cy', uniqueName: 'Welsh' },

  ]);
  const [show, setShow] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [question, setQuestions] = useState([
    {
      questionTitle: 'Tell me Your Mobile Number?',
    },
    {
      questionTitle: 'Tell me your Email Address?',
    },

  ]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  const [result, setResult] = useState('')
  const [Error, setError] = useState('')
  const [RecognizedTextForPhone, setRecognizedTextForPhone] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [StudentName, setStudentName] = useState('')
  useEffect(() => {
    const restoreStudentPhoneAndEmail = async () => {
      await OnboardingModule.getStudentNameAndEmail(
        (studentName, StudentEmail, StudentPhone) => {
          console.log(StudentEmail, StudentPhone, 'This is the studentEmail')

          if (StudentPhone !== null) {
            // Use regex to extract the country code and the phone number
            const phoneMatch = StudentPhone.match(/^\+(\d{1,3})(\d{10})$/);
            let countryCode = '';
            let phoneWithoutCountryCode = StudentPhone;
    
            if (phoneMatch) {
                countryCode = phoneMatch[1]; // The country code
                phoneWithoutCountryCode = phoneMatch[2]; // The phone number without the country code
            }
    
            // Assuming you have functions to set the country code and phone number separately
            setCountryCode(countryCode);
            setStudentPhone(phoneWithoutCountryCode);
        }
          if (StudentEmail !== null) setStudentEmail(StudentEmail);
          if (studentName !== null) setStudentName(StudentEmail);
        },
      );
    };

    restoreStudentPhoneAndEmail();
  }, []);





  const vicuna_url = "http://hevolve.hertzai.com:5459/gpt-4";
  function isEmailValid(email) {
    // You can use a regular expression to check for a valid email pattern
    const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return emailPattern.test(email);
  }
  useEffect(() => {
    if (RecognizedTextForPhone) {
      const optionsForResult = `
        let userName = '${question[activeQuestionIndex]?.questionTitle} can you select the mobile number from the following voice input: ${RecognizedTextForPhone}';
        let userInput = ${JSON.stringify(RecognizedTextForPhone)};
        let askedQuestion = ${JSON.stringify(question[activeQuestionIndex]?.questionTitle)};
      `;

      const prompt = `
        TEXT: ${optionsForResult}
        RESPONSE FORMAT: Please provide the extracted mobile number in a string format. Remove any unnecessary characters or spaces. For example, "1234567890" (10 digits).
      `;

      const headers = { 'Content-Type': 'application/json' };

      const payload = {
        "model": "gpt-4",
        "data": [{ "role": "user", "content": prompt }]
      }
      console.log('call to vicuna going on');
      axios.post(vicuna_url, payload, { headers })
        .then((res) => {
          console.log("api result", res.data);



          if (mobileNumberPattern.test(mobileNumber)) {
            // Log the data if it's a valid mobile number
            console.log('Mobile Number:', mobileNumber);
            setStudentPhone(mobileNumber);
            setActiveQuestionIndex(activeQuestionIndex + 1);
            setRecognizedTextForPhone('');
          } else if (isEmailValid(mobileNumber) && activeQuestionIndex === 1) {
            // Log the data if it's a valid email
            console.log('Email:', mobileNumber);
            setStudentEmail(mobileNumber);
            setRecognizedTextForPhone('');
          }
        })
        .catch((error) => {
          console.error("Error in Axios request:", error);
          // Handle the error, for example, show an error message to the user.
        });
    }
  }, [activeQuestionIndex, RecognizedTextForPhone]);
  const reg = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w\w+)+$/;
  useEffect(() => {
    // Initialize i18next with the selected language from your state management system
    i18next.init({
      compatibilityJSON: 'v3',
      interpolation: { escapeValue: false },
      lng: preferred_language || '', // Set initial language to preferred_language if available, otherwise empty string
      resources,
    });
  }, [preferred_language]);




 


  useEffect(() => {
    // Subscribe to the 'SpeechRecognizedEvent' event when the component mounts
    const eventListener = DeviceEventEmitter.addListener(
      'SpeechRecognizedEvent',
      event => {
        const { SpeechRecognizedText } = event;
        setRecognizedTextForPhone(SpeechRecognizedText);
      },
    );

    // Unsubscribe from the 'SpeechRecognizedEvent' event when the component unmounts
    return () => {
      eventListener.remove();
    };
  }, []);

  const handleStartSpeechListening = () => {
    if (isRecording) {
      console.log("i am stoping recording")
      stopRecording();
    } else {
      // If not recording, start recording
      console.log("i am starting recording")
      startRecording();
    }
  };

  const startRecording = () => {
    NativeModules.ActivityStarterModule.startSpeechListening();
    setIsRecording(true);
    setRecognizedTextForPhone('')


  };

  const stopRecording = () => {
    // Add any logic to stop the recording if needed
    setIsRecording(false);
  };

  function validate() {
    if (studentPhone.length !== 10) {
      alert('Enter valid Contact');
    } else if (!reg.test(studentEmail)) {
      alert('Enter valid Mail');
    } else {
      OnboardingModule.createStudentNameAndEmail(StudentName,studentEmail,studentPhone);
      confirmButtonRef.current
        .fadeIn(600)
        .then(() => navigation.navigate('Grade'));
    }
  }
  function SkipButton() {
    if (studentPhone.length !== 10) {
      alert('Enter valid Contact');
    } else if (!reg.test(studentEmail)) {
      alert('Enter valid Mail');
    } else {
      OnboardingModule.createStudentNameAndEmail(StudentName,studentEmail,studentPhone);}
    OnboardingModule.signUp_updateStudent((user, error) => {
      if (null == error || '' == error) {
        confirmButtonRef.current
          .fadeIn(600)
          .then(() => {
            navigation.navigate('AskUploadVideo');
            NativeModules.ActivityStarterModule.navigateToOtpVerification();
          });
      }
      else {
        alert(error);
      }
      console.log('Error', error);
      console.log('User', user);
    });
  }




  const renderLanguageModal = () => {
    const onSelect = (index) => {
      setLangauges((prevLanguages) => {
        return prevLanguages.map((language, i) => ({
          ...language,
          selected: i === index ? true : false,
        }));
      });

      // Translate the text when language is selected
      i18next.changeLanguage(languages[index].value);

      // Update the selected language in your state management system
      setpreferred_language(languages[index].value);
    };
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={langModalVisible}
        onRequestClose={() => {
          setLangModalVisible(false);
        }}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.title}>Select Language</Text>
            <FlatList
              data={languages}
              keyExtractor={(item, index) => index.toString()}
              style={{ maxHeight: height / 2 }}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.languageItem,
                    { borderColor: item.selected ? 'blue' : 'black' },
                  ]}
                  onPress={() => {
                    onSelect(index);
                  }}>
                  {item.selected ? (
                    <Image
                      source={require('../../images/selected.png')}
                      style={[styles.icon, { tintColor: 'blue' }]}
                    />
                  ) : (
                    <Image
                      source={require('../../images/non_selected.png')}
                      style={styles.icon}
                    />
                  )}
                  <Text
                    style={{
                      marginLeft: 20,
                      fontSize: 18,
                      color: item.selected ? 'blue' : 'black',
                    }}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <View style={styles.btns}>
              <TouchableOpacity
                style={styles.btn1}
                onPress={() => {
                  setLangModalVisible(false);
                }}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btn2}
                onPress={() => {
                  setLangModalVisible(false);
                  // Handle the selected language here
                  setpreferred_language(languages.find((lang) => lang.selected).value);
                }}>
                <Text style={{ color: '#fff' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animatable.View
          ref={backButtonRef}
          // animation='dissolve'
          duration={600}
          // delay={300}
          easing="ease-in-out"
          useNativeDriver={true}>
          <TouchableOpacity
            style={styles.back_btn}
            onPress={() =>
              backButtonRef.current.fadeOut(600).then(() => navigation.goBack())
            }>
            <Image
              style={styles.back_arrow}
              source={require('../../images/back_arrow.png')}
            />
            <Text style={styles.back_text}>{i18next.t('back')}</Text>
          </TouchableOpacity>
        </Animatable.View>
        <TouchableOpacity
          style={styles.invisible_btn}
          onPress={() => {
            setLangModalVisible(true);
          }}>
          <Text style={styles.back_text}>{preferred_language ? 'Change Language' : 'Select Language'}</Text>
        </TouchableOpacity>
      </View>
      {renderLanguageModal()}
      <Text style={styles.subtitle}>{i18next.t('fewMoreStep')}</Text>
      <Text style={styles.mid_title}>{i18next.t('ContactDetails')}</Text>

      <Text style={styles.mid_subtitle}>{i18next.t('MobileNumber')}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => setShow(true)}
          style={styles.countryButton}
        >
          {countryCode ? <Text style={styles.buttonText1}>
            {countryCode}
          </Text> : <Text style={styles.buttonText}>
            {'Select Country Code'}
          </Text>}
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          placeholder="Ex: 0123456789"
          value={studentPhone}
          keyboardType="numeric"
          onChangeText={newPhone => setStudentPhone(newPhone)}
        />
      </View>

      {show && (
        <CountryPicker
        searchMessage = {true}
          show={show}
          pickerButtonOnPress={(item) => {
            console.log(item)
            setCountryCode(item.dial_code);
            setShow(false);
          }}
        />
      )}



      <Text style={styles.mid_subtitle}>{i18next.t('Email')}</Text>
      <TextInput
        style={styles.text_input}
        placeholder="Ex: Rishabh@gmail.com"
        value={studentEmail}
        onChangeText={newEmail => setStudentEmail(newEmail)}
      />
      <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row', width: wp('100%') }}>
        <Animatable.View
          ref={confirmButtonRef}
          duration={600}
          easing="ease-in-out">
          <TouchableOpacity style={styles.btn} onPress={SkipButton} >
            <Text style={styles.btn_text}>
              {i18next.t('SKIP')}
            </Text>
          </TouchableOpacity>
        </Animatable.View>
        <Animatable.View
          ref={confirmButtonRef}
          duration={600}
          easing="ease-in-out">
          <TouchableOpacity style={styles.btn} onPress={validate}>
            <Text style={styles.btn_text}>
              {
                 i18next.t('Confirm')
               }
            </Text>
          </TouchableOpacity>
        </Animatable.View>

      </View>



      <Text style={styles.voice_text}>{i18next.t('voiceCommands')}</Text>
      <TouchableOpacity onPress={handleStartSpeechListening}>
        <Image
          style={styles.micImg}
          source={
            isRecording
              ? require('../../images/mic.png') // Use the microphone icon for recording
              : require('../../images/mic.png') // Use the normal microphone icon
          }
        />
        <Text>{isRecording ? 'Stop Recording' : 'Start Recording'}</Text>
      </TouchableOpacity>
      <Text>{question[activeQuestionIndex]?.questionTitle}</Text>
      <Text>Recognized Text: {RecognizedTextForPhone}</Text>
    </View>
  );
};

// React Native Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    // justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  header: {
    paddingHorizontal: 6,
    alignSelf: 'stretch',
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    margin: 4,
  },
  back_btn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invisible_btn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  back_arrow: {
    width: wp('2.2%'),
    height: undefined,
    aspectRatio: 10.07 / 17.62,
    marginRight: 2,
  },

  back_text: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4.3%'),
  },

  title: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4.3%'),
    color: '#0078FF',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, .5)',
  },
  modalView: {
    margin: 20,
    width: Dimensions.get('window').width - 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  languageItem: {
    width: '100%',
    height: 50,
    borderRadius: 10,
    borderWidth: 0.5,
    marginTop: 10,
    paddingLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  btns: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginTop: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn1: {
    width: '40%',
    height: 50,
    borderWidth: 0.5,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  },
  btn2: {
    width: '40%',
    height: 50,
    borderWidth: 0.5,
    borderRadius: 10,
    backgroundColor: '#4B68E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    // width: 350,
    // height: 26,
    // marginLeft: 94,
    marginTop: hp('3%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
  },

  mid_title: {
    marginVertical: hp('7%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
    alignSelf: 'center',
    // backgroundColor: "blue"
  },

  mid_subtitle: {
    // marginTop: 64,
    fontFamily: 'Roboto-Medium',
    fontSize: wp('5.3%'),
  },


  btn: {
    width: wp('40%'),
    height: hp('5.7%'),
    // marginTop: hp('4%'),
    backgroundColor: '#0078FF',
    borderRadius: hp('3%'),
    alignItems: 'center',
    textAlign: 'center',
    justifyContent: 'center',
    marginHorizontal: wp('2%')
  },

  btn_text: {
    // width: 74,
    // height: 26,
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.3%'),
    color: '#FFFFFF',
    textAlign: 'center'
  },
  voice_text: {
    // width: 390,
    // height: 26,
    marginTop: hp('7%'),
    // marginTop: 'auto',
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.3%'),
    color: '#0078FF',
  },
  micImg: {
    // resizeMode: "center",
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
    borderWidth: 1
  },
  buttonText: {
    color: 'black',
    fontSize: wp('3.3%'),
  },
  buttonText1: {
    color: 'black',
    fontSize: wp('5.3%'), paddingVertical: 4
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
  text_input: {
    width: wp('57%'),
    // marginTop: 8,
    marginBottom: hp('8%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
    color: '#676767',
    borderBottomWidth: hp('0.15%'),
    borderBottomColor: '#707070',
    // backgroundColor:'blue'
  },

});

export default StudentPhoneEmail;
