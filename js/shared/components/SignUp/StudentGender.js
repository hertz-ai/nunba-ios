/* eslint-disable no-trailing-spaces */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState, useRef } from 'react';
import {
  NativeModules,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  View,
  Text,
  Modal,
  DeviceEventEmitter,
  FlatList,
  Button,
  StyleSheet,
  Image,
  TextInput,
  SafeAreaView,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import i18next from 'i18next';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import axios from 'axios';
import useLanguageStore from '../../zustandStore';
import resources from './translations';

const { height } = Dimensions.get('window');




const { OnboardingModule } = NativeModules;
const { SCREEN_WIDTH, SCREEN_HEIGHT } = Dimensions.get('window');

const StudentGender = ({ navigation }) => {
  const backButtonRef = useRef();
  const confirmButtonRef = useRef();
  const [Error, setError] = useState('')
  const [Question, setQuestion] = useState('Tell me Your name')
  const [gender, setGender] = useState('default');
  const [langModalVisible, setLangModalVisible] = useState(false);
  const { preferred_language, setpreferred_language } = useLanguageStore();
  const [recognizedText, setRecognizedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

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

  useEffect(() => {
    // Initialize i18next with the selected language from your state management system
    i18next.init({
      compatibilityJSON: 'v3',
      interpolation: { escapeValue: false },
      lng: preferred_language || '', // Set initial language to preferred_language if available, otherwise empty string
      resources,
    });
  }, [preferred_language]);


  const vicuna_url = "http://azure_langchaingpt.hertzai.com:8088/chat";
  const askedQuestion = "Are you a Male or Female?";


  useEffect(() => {
    const restoreStudentGender = async () => {
      await OnboardingModule.getStudentGender(StudentGender => {
        if (StudentGender !== null) setGender(StudentGender);
      });
    };

    restoreStudentGender();
  }, []);
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
  useEffect(() => {

    if (recognizedText) {
      // Combine the variables into a single template string
      const optionsForResult = `
      let userName = 'Can you pick the Name of the preson from the userInput';
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
          console.log(response.data)
          setResult(response.data);

          // Update student name using the response data
          // Assuming the API response contains the name



          console.log(result);

        })

        .catch(error => {
          setError('Error:', error)
        });
    }
  }, [recognizedText]);
  console.log(recognizedText)



  function SkipButton (){
    OnboardingModule.createStudentGender(gender);
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

  const handleStartSpeechListening = () => {
    if (isRecording) {
      // If already recording, stop recording
      stopRecording();
    } else {
      // If not recording, start recording
      startRecording();
    }
  };

  const startRecording = () => {
    NativeModules.ActivityStarterModule.startSpeechListening();
    setIsRecording(true);
  };

  const stopRecording = () => {
    // Add any logic to stop the recording if needed
    setIsRecording(true);
    setResult('')
    setError('')
    setRecognizedText('')
  };

  function validate() {
    if (gender === 'default') {
      alert('Please select a gender');
    } else {
      OnboardingModule.createStudentGender(gender);
      confirmButtonRef.current
        .fadeIn(600)
        .then(() => navigation.navigate('StudentPhoneEmail'));
    }
  }
  const GenderComponent = () => {
    return (
      <View style={styles.genderComponent}>
        <TouchableOpacity
          style={styles.boyComponent}
          onPress={() => setGender('boy')}>
          <Text style={styles.boy_text}>{i18next.t('Boy')}</Text>
          <Image
            style={styles.boyImg}
            source={require('../../images/boy.png')}
          />
        </TouchableOpacity>

        <View style={styles.or_view}>
          <Text style={styles.or}>{i18next.t('OR')}</Text>
        </View>

        <TouchableOpacity
          style={styles.girlComponent}
          onPress={() => setGender('girl')}>
          <Text style={styles.girl_text}>{i18next.t('Girl')}</Text>
          <Image
            style={styles.girlImg}
            source={require('../../images/girl.png')}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const BoyComponent = () => {
    return (
      <View
        style={[
          styles.boyComponent,
          { marginTop: hp('2.8%'), marginBottom: hp('0.1%') },
        ]}>
        <Text style={[styles.boy_text, { fontFamily: 'Roboto-Medium' }]}>
          {i18next.t('Boy')}
        </Text>
        <Image style={styles.boyImg} source={require('../../images/boy.png')} />
      </View>
    );
  };

  const GirlComponent = () => {
    return (
      <View style={[styles.girlComponent, { marginTop: hp('2.8%') }]}>
        <Text style={[styles.girl_text, { fontFamily: 'Roboto-Medium' }]}>
          Girl
        </Text>
        <Image
          style={styles.girlImg}
          source={require('../../images/girl.png')}
        />
      </View>
    );
  };
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
      <Text style={styles.mid_title}>{i18next.t('MaleFemale')}</Text>

      {gender === 'default' && <GenderComponent />}
      {gender === 'boy' && <BoyComponent />}
      {gender === 'girl' && <GirlComponent />}
      <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row',width:wp('100%') }}>
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
              { i18next.t('Confirm')
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
      {isRecording && <Text>{Question}</Text>}
      <Text>recognized Text: {recognizedText}</Text>
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

  subtitle: {
    // width: 350,
    // height: 26,
    // marginLeft: 94,
    marginTop: hp('3%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
  },

  mid_title: {
    marginTop: hp('6%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
    alignSelf: 'center',
    // backgroundColor: "blue"
  },

  genderComponent: {
    display: 'flex',
    alignSelf: 'stretch',
    // alignItems:"center",
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: hp('2.8%'),
    marginHorizontal: wp('2%'),
    // backgroundColor: "blue",
  },

  boyComponent: {
    // display:"flex",
    flexDirection: 'column',
    flexWrap: 'wrap',
    alignItems: 'center',
    // backgroundColor: "blue",
  },
  boy_text: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('6.6%'),
    color: '#0078FF',
  },
  boyImg: {
    width: wp('17.5%'),
    height: undefined,
    aspectRatio: 87.12 / 276.09,
    marginTop: hp('1.6%'),
  },

  or_view: {
    flex: 1,
    alignItems: 'center',
    // backgroundColor: "blue"
  },
  or: {
    marginTop: hp('17%'),
    // marginLeft: 84.88,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: wp('8.3%'),
    color: '#0078FF',
    // backgroundColor: "blue",
  },

  girlComponent: {
    // alignSelf: 'flex-end',
    flexDirection: 'column',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  girl_text: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('6.6%'),
    color: '#0078FF',
  },
  girlImg: {
    // resizeMode: "center",
    width: wp('17.5%'),
    height: undefined,
    aspectRatio: 86 / 273.89,
    marginTop: hp('1.6%'),
  },

  btn: {
    width: wp('40%'),
    height: hp('5.7%'),
    marginTop: hp('4%'),
    backgroundColor: '#0078FF',
    borderRadius: hp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal:wp('2%')
  },

  btn_text: {
    // width: 74,
    // height: 26,
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.1%'),
    color: '#FFFFFF',
  },

  voice_text: {
    // marginTop: hp('5%'),
    marginTop: 'auto',
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
    marginBottom: 20,
  },
  btn1: {
    width: '40%',
    height: 50,
    borderWidth: 0.5,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default StudentGender;
