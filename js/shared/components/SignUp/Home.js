/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import React, { useState, useEffect, useRef } from 'react';
import * as Animatable from 'react-native-animatable';
import {
  NativeModules,
  Animated,
  Dimensions,
  View,
  Modal,
  DeviceEventEmitter,
  FlatList,
  Text,
  Button,
  StyleSheet,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Easing,
} from 'react-native';
import axios from 'axios'
import i18next from 'i18next';
import StudentName from './StudentName';
// import useOrientation from '../hooks/useOrientation';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
// import * as MagicMove from 'react-native-magic-move';
// import 'react-navigation-magic-move';
import resources from './translations';

import useLanguageStore from '../../zustandStore';
const { height } = Dimensions.get('window');
const { SCREEN_WIDTH, SCREEN_HEIGHT } = Dimensions.get('window');
// var SCREEN_WIDTH, SCREEN_HEIGHT;
const { ActivityStarterModule } = NativeModules;



const Home = ({ navigation,route }) => {
  const { phoneNumber, email } = route.params;
  const backButtonRef = useRef();
  const confirmButtonRef = useRef();
  const {preferred_language, setpreferred_language } = useLanguageStore();
  const [langModalVisible, setLangModalVisible] = useState(false);

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
  const [result, setResult] = useState('')
  const [Error, setError] = useState('')
  const [Question, setQuestion] = useState('Are you Teacher OR Student?')
  const [recognizedText, setRecognizedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  // const orientation = useOrientation();
  // console.log(orientation);
  // SCREEN_WIDTH = orientation.width;
  // SCREEN_HEIGHT = orientation.height;
  // console.log(SCREEN_WIDTH,SCREEN_HEIGHT);
  const vicuna_url = "http://azure_langchaingpt.hertzai.com:8088/chat";
  const askedQuestion = "Are you Student Or Teacher?";


  useEffect(() => {
    // Initialize i18next with the selected language from your state management system
    i18next.init({
      compatibilityJSON: 'v3',
      interpolation: { escapeValue: false },
      lng: preferred_language || '', // Set initial language to preferred_language if available, otherwise empty string
      resources,
    });
  }, [preferred_language]);
  console.log("this is the l",preferred_language)

  useEffect(() => {

    if (recognizedText) {
      // Combine the variables into a single template string
      const optionsForResult = `
      let userName = 'can you find out from the input user is Teacher or Student ;
        let userInput = ${JSON.stringify(recognizedText)};
        let askedQuestion = ${JSON.stringify(askedQuestion)};
      `;

      // Create the prompt using the combined variables
      const prompt = `
        TEXT: ${optionsForResult}
        RESPONSE FORMAT: An answer in string format only NOTHING ELSE!
      `;

      const headers = { 'Content-Type': 'application/json' };

      const payload = {
        conversation_list: [],
        prompt: prompt
      };
      axios.post(vicuna_url, payload, { headers: headers })
        .then(response => {
          console.log(response.data);
          setResult(response.data);
          const result = response.data;

          const cleanedResult = result.replace(".", "").trim() // Remove trailing whitespace and full stops
          console.log("cleaned results are -------------------------------- ", cleanedResult)
          if (cleanedResult === "Student") {
            console.log('Navigating to StudentName');
            setQuestion('You are a student');
            navigation.navigate('StudentName', {
              phoneNumber: phoneNumber,
              email: email
            });
            // setTimeout(() => {
            // }, 4000); // Wait for 4 seconds before navigating
          } else if (cleanedResult === "Teacher") {
            console.log('Navigating to SignupTeacher');
            setQuestion('You are a teacher');
            ActivityStarterModule.navigateToSignupTeacher();
            // setTimeout(() => {
            // }, 4000); // Wait for 4 seconds before navigating
          }
        })

        .catch(error => {
          setError('Error:', error)
        });
    }
  }, [recognizedText]);
  console.log(recognizedText)
  useEffect(() => {
    // Subscribe to the 'SpeechRecognizedEvent' event when the component mounts
    const eventListener = DeviceEventEmitter.addListener(
      'SpeechRecognizedEvent',
      event => {
        const { SpeechRecognizedText } = event;
        setRecognizedText(SpeechRecognizedText);
      },
    );

    // Unsubscribe from the 'SpeechRecognizedEvent' event when the component unmounts
    return () => {
      eventListener.remove();
    };
  }, []);

  const handleStartSpeechListening = () => {
    // setRecognizedText("")
    if (isRecording) {
      // If already recording, stop recording
      console.log("stopping recording")
      stopRecording();
    } else {
      // If not recording, start recording
      console.log("starting recording")
      startRecording();
      setQuestion('Are you Student Or Teacher?');
    }
  };

  const startRecording = () => {
    NativeModules.ActivityStarterModule.startSpeechListening();
    setIsRecording(true);
    // setResult('')
    // setError('')
    // setRecognizedText('')



  };

  const stopRecording = () => {
    // Add any logic to stop the recording if needed
    setIsRecording(false);
    // setRecognizedText('');
  };
  // const skipButtonRef = useRef();
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
        setLangModalVisible(false)
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
                    console.log('Selected index:', index); // Log the index
                    onSelect(index);
                  }}
                >
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
    // <ScrollView>
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
      <Text style={styles.title}>{i18next.t('Knowmebetter')}</Text>
      <Text style={styles.subtitle}>{i18next.t('Student')}</Text>
      <TouchableWithoutFeedback
        // style= { {backgroundColor:"blue"} }
        onPress={() => {
          // return setstudentImgClick(true);
          return navigation.navigate('StudentName');
        }}>
       <Animatable.Image
         animation="fadeInUp"
         duration={600}
         style={styles.studentImg}
         source={require('../../images/student.png')}
       />
      </TouchableWithoutFeedback>
      {renderLanguageModal()}

      <Text style={styles.or}>{i18next.t('OR')}</Text>
      <Text style={styles.subtitle}>{i18next.t('Teacher')}</Text>
      <TouchableWithoutFeedback
        // style= { {backgroundColor:"blue"} }
        onPress={() => {
          // return setstudentImgClick(true);
          ActivityStarterModule.navigateToSignupTeacher();
        }}>
      <Animatable.Image
        animation="fadeInUp"
        duration={600}
        style={styles.studentImg}
        source={require('../../images/student.png')}
      />

      </TouchableWithoutFeedback>
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
      {isRecording && <Text>{Question}</Text>}
      <Text>recognized Text : {recognizedText}</Text>
    </View>
    // </ScrollView>
  );
};

// Home.sharedElements = route => {
//   return [
//     {
//       id: "studentImg",
//       animation: 'move',
//       resize: 'auto',
//       align: 'center-center',
//     }
//   ];
// };

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
    textAlign: 'center',
  },
  invisible_btn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    // width: 206,
    marginTop: hp('4%'),
    // marginHorizontal: 103,
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
    // fontSize: 19,
    fontSize: wp('4.5%'),
    // backgroundColor: "blue"
  },
  back_arrow: {
    width: wp('2.2%'),
    height: undefined,
    aspectRatio: 10.07 / 17.62,
    marginRight: 2,
  },
  btn_text: {
    // width: 74,
    // height: 26,
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.1%'),
    color: '#FFFFFF',
  },

  back_text: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4.3%'),
  },

  subtitle: {
    marginTop: hp('2.25%'),
    // width: 142,
    fontFamily: 'Roboto',
    fontSize: wp('5.3%'),
    color: '#0078FF',
    // backgroundColor: "blue"
  },
  studentImg: {
    // resizeMode: "center",
    width: wp('52%'),
    height: undefined,
    aspectRatio: 259.12 / 276.15,
    marginTop: hp('2%'),
    // marginLeft: 76,
    // marginRight: 76.88
  },
  or: {
    // width: 53,
    marginTop: hp('4%'),
    marginBottom: hp('0.5%'),
    fontFamily: 'Roboto-Medium',
    fontWeight: 'bold',
    fontSize: wp('6%'),
    color: '#0078FF',
  },
  teacherImg: {
    resizeMode: 'center',
    width: wp('53%'),
    height: undefined,
    aspectRatio: 264.57 / 246.79,
    marginTop: hp('2.5%'),
    marginBottom: hp('2%'),
  },
  selectLanguageButton: {
    position: 'absolute',
    top: hp('1%'),
    right: wp('2%'),
    zIndex: 1,
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
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  btn1: {
    width: '40%',
    height: 50,
    borderWidth: 0.5,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btns: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
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
    width: wp('9.5%'),
    height: undefined,
    aspectRatio: 55 / 80,
    display: 'flex',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: hp('1%'),
    marginBottom: hp('1%'),
  },
});

export default Home;
