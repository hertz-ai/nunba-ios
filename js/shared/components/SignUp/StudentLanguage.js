import React, { useEffect, useState, useRef } from 'react';
import {
  NativeModules,
  Dimensions,
  TouchableHighlight,
  FlatList,
  TouchableOpacity,
  ScrollView,
  DeviceEventEmitter,
  View,
  Text,
  Button,
  StyleSheet,
  Switch,
  Image,
  TextInput,
  SafeAreaView,
  Modal,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import DropDownPicker from 'react-native-dropdown-picker';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import i18next from 'i18next';
const { height } = Dimensions.get('window');
// Define the translation resources
import useLanguageStore from '../../zustandStore';

import resources from './translations';
import axios from 'axios';

const { OnboardingModule } = NativeModules;
const { SCREEN_WIDTH, SCREEN_HEIGHT } = Dimensions.get('window');

DropDownPicker.setListMode('SCROLLVIEW');
const defaultLanguage = 'en-US';
i18next.init({
  compatibilityJSON: 'v3',
  interpolation: { escapeValue: false },
  lng: defaultLanguage,
  resources,
});

const StudentLanguage = ({ navigation }) => {
  const backButtonRef = useRef();
  const confirmButtonRef = useRef();
  const { preferred_language, setpreferred_language } = useLanguageStore();
  const [openProficiency, setOpenProficiency] = useState(false);
  const [english_proficiency, setenglish_proficiency] = useState(null);
  const [itemsProficiency, setItemsProficiency] = useState([
    { label: i18next.t('High'), value: i18next.t('High') },
    { label: i18next.t('Medium'), value: 'Medium' },
    { label: i18next.t('Low'), value: 'Low' },
  ]);
  const [recognizedText, setRecognizedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [isTransliterate, setIsTransliterate] = useState(false);
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
  const [selectedLangInModal, setSelectedLangInModal] = useState(preferred_language);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

  const [question, setQuestions] = useState([
    {
      questionTitle: 'What is your preferred language ?',
    },
    {
      questionTitle: 'Do you want to translate in english ?',
    },
    {
      questionTitle: 'Choose your english proficiency',
    },
  ]);

  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  useEffect(() => {
    setpreferred_language(null);
    console.log(preferred_language);
  }, []);
  const applyLanguageChange = () => {
    // Update the selected language when "Apply" is clicked
    if (selectedLangInModal) {
      setpreferred_language(selectedLangInModal);
    }
    setLangModalVisible(false);
  };


  console.log('first', preferred_language);

  const vicuna_url = 'http://azure_langchaingpt.hertzai.com:8088/chat';

  useEffect(() => {
    if (recognizedText) {
      const optionsForResult = `
      let userName = '${question[activeQuestionIndex]?.questionTitle} can you give the answer in one word';
      let userInput = ${JSON.stringify(recognizedText)};
      let askedQuestion = ${JSON.stringify(question[activeQuestionIndex]?.questionTitle)};
    `;

      const prompt = `
    TEXT: ${optionsForResult}
    RESPONSE FORMAT: An answer in string format only NOTHING ELSE!
  `;

      const headers = { 'Content-Type': 'application/json' };

      const payload = {
        conversation_list: [],
        prompt: prompt,
      };
      console.log('call to vicuna going on');
      axios.post(vicuna_url, payload, { headers }).then((res) => {
        const foundWord = res?.data?.replace('.', '').trim();
        console.log('found word is -------------', foundWord);
        if (activeQuestionIndex === 0) {
          languages.find((language, index) => {
            if (language.uniqueName == foundWord) {
              onSelect(index);
              setActiveQuestionIndex(activeQuestionIndex + 1);
              setRecognizedText('')
            }

          });
        } else if (activeQuestionIndex === 1) {
          if (foundWord.toLowerCase() === 'yes') {
            setIsTransliterate(true);
            setActiveQuestionIndex(activeQuestionIndex + 1);
            setRecognizedText('')
          } else if (foundWord.toLowerCase() === 'no') {
            setIsTransliterate(false);
            setActiveQuestionIndex(activeQuestionIndex + 1);
            setRecognizedText('')
          }
        } else if (activeQuestionIndex === 2) {
          if (
            foundWord.toLowerCase() === 'high' ||
            foundWord.toLowerCase() === 'low' ||
            foundWord.toLowerCase() === 'medium'
          ) {
            setRecognizedText('')
            setenglish_proficiency(foundWord);
            stopRecording();
          }
        }
      });
    }
  }, [activeQuestionIndex, recognizedText]);

  useEffect(() => {
    setpreferred_language(preferred_language);


    handleLanguageChange(preferred_language);
  }, [preferred_language]);

  const handleLanguageChange = async (languageValue) => {
    await i18next.changeLanguage(languageValue);
  };

  useEffect(() => {
    // Subscribe to the 'SpeechRecognizedEvent' event when the component mounts
    const eventListener = DeviceEventEmitter.addListener('SpeechRecognizedEvent', (event) => {
      const { SpeechRecognizedText } = event;
      setRecognizedText(SpeechRecognizedText);
    });

    // Unsubscribe from the 'SpeechRecognizedEvent' event when the component unmounts
    return () => {
      eventListener.remove();
    };
  }, []);

  const handleStartSpeechListening = () => {
    console.log("mic was clicked")
    if (isRecording) {
      // If already recording, stop recording
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
  };
  const ToggleChange = () => {
    setIsTransliterate(previousState => !previousState);
  };
  const stopRecording = () => {
    // Add any logic to stop the recording if needed
    setIsRecording(false);
  };
  useEffect(() => {
    const studentValue = async () => {
      await OnboardingModule.getStudentNameAndEmail((Name, email_address, phone_number) => {
        console.log(Name, email_address, phone_number, 'this is the email name phone');
        setPhoneNumber(phone_number);
        setEmail(email_address);
      });
    };

    studentValue()
  }, []);

  useEffect(() => {
    const restoreStudentLanguage = async () => {
      await OnboardingModule.getStudentLanguage((english_proficiency, preferred_language, isTransliterate) => {
        if (english_proficiency !== null) setenglish_proficiency(english_proficiency);
        if (preferred_language !== null) setpreferred_language(preferred_language);
        if (isTransliterate !== null) setIsTransliterate(isTransliterate);
      });
    };

    restoreStudentLanguage();
  }, []);




  function SkipButton() {
    OnboardingModule.createStudentLanguage(
      english_proficiency,
      preferred_language,
      isTransliterate
    );
    console.log(english_proficiency, preferred_language, isTransliterate, 'this is the user');

    OnboardingModule.signUp_updateStudent((user, error) => {
      console.log(user, 'this is the user');
      if (error == null || error === '') {
        navigation.navigate('AskUploadVideo');
        NativeModules.ActivityStarterModule.navigateToOtpVerification();
      } else {
        alert(error);
      }
      console.log('Error', error);
      console.log('User', user);
    });
  }



  function validate() {
    if (english_proficiency === null) {
      alert('Set your English Proficiency');
    } else if (preferred_language === null) {
      alert('Set preferred Language');
    } else {
      console.log('Data to be sent to OnboardingModule:');
      console.log('English Proficiency:', english_proficiency);
      console.log('Preferred Language:', preferred_language);
      console.log('Is Transliterate:', isTransliterate);
      OnboardingModule.createStudentLanguage(
        english_proficiency,
        preferred_language,
        isTransliterate
      );

      confirmButtonRef.current.fadeIn(600).then(() => {
        navigation.navigate('Home', {
          phoneNumber: phoneNumber,
          email: email
        });
      });
    }
  }

  console.log('selected Language is', preferred_language);
  console.log('selected value langauge is', preferred_language); // Use preferred_language instead of preferred_language

  const onSelect = (index) => {
    const selectedLanguage = languages[index].value;
    setpreferred_language(selectedLanguage); // Update preferred_language
    // Remove the line below, as preferred_language should be used instead of preferred_language
    // setselectedLang(selectedLanguage);setValue

    setLangauges((prevLanguages) => {
      return prevLanguages.map((language, i) => ({
        ...language,
        selected: i === index ? true : false,
      }));
    });

    // Translate the text when the language is selected
    i18next.changeLanguage(selectedLanguage);
  };

  const renderLanguageModal = () => {
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
                    setSelectedLangInModal(item.value); // Update selectedLangInModal
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
                  applyLanguageChange();


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

      {renderLanguageModal()}
      <Image
        style={styles.language_icon}
        source={require('../../images/language_icon.png')}
      />

      <Text style={styles.mid_subtitle}>{i18next.t('preferredLanguage')}</Text>
      <View style={styles.dropdown_container}>
        <View style={styles.dropdown_header}>


          <TouchableOpacity
            style={styles.invisible_btn}
            onPress={() => {
              setLangModalVisible(true);
              setpreferred_language(preferred_language)
            }}>
            <Text style={styles.LanguageText}> {preferred_language ? 'Change Language' : 'Select Language'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View >


        <Text>{i18next.t('inEnglish')}</Text>

        <Switch
          trackColor={{ false: "grey", true: "red" }}
          onValueChange={ToggleChange}
          value={isTransliterate}
        />
      </View>
      <Text style={styles.mid_subtitle}>{i18next.t('englishProficiency')}</Text>

      <View style={[styles.dropdown_container_Pro, { zIndex: 2 }]}>
        <DropDownPicker
          open={openProficiency}
          value={english_proficiency}
          items={itemsProficiency}
          setOpen={setOpenProficiency}
          setValue={setenglish_proficiency}
          setItems={setItemsProficiency}
          placeholder="Ex: Medium"
          style={styles.dropdown_header}
          placeholderStyle={{
            fontFamily: 'Roboto-Regular',
            fontSize: wp('4.3%'),
            color: '#676767',
          }}
          dropDownContainerStyle={{
            width: wp('57%'),
          }}
          listItemLabelStyle={{
            fontSize: wp('4.3%'),
          }}
          selectedItemLabelStyle={{
            fontSize: wp('4.3%'),
          }}
          labelStyle={{
            fontSize: wp('4.3%'),
          }}
        />
      </View>
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

              {i18next.t('Confirm')}

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
      <Text>Recognized Text: {recognizedText}</Text>
    </View>
  );
};

// React Native Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  back_btn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invisible_btn: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  back_arrow: {
    width: wp('2.2%'),
    height: undefined,
    aspectRatio: 10.07 / 17.62,
    marginRight: 4,
  },
  back_text: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4.3%'),
    fontWeight: '300',
  },
  title: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4.3%'),
    color: '#0078FF',
  },
  toggleContainer: {
    flexDirection: 'row', // This will arrange the elements in a row
    alignItems: 'center', // Align items vertically in the center
    justifyContent: 'space-between', // Distribute space between elements
    marginVertical: 10, // Adjust vertical margin as needed
  },
  title_Transliteration: {
    fontSize: 16, // Adjust font size as needed
  },
  toggleButton: {
    // You can adjust the styles of the Switch component here
  },

  language_icon: {
    width: wp('33.7%'),
    height: undefined,
    aspectRatio: 167.67 / 120.13,
    marginTop: hp('4%'),
    marginBottom: hp('5%'),
  },
  mid_subtitle: {
    fontFamily: 'Roboto-Medium',
    fontSize: wp('5.3%'),
    marginBottom: 15
  },
  mid_subtitle_pro: {
    fontFamily: 'Roboto-Medium',
    fontSize: wp('5.3%'),
    marginTop: 10,
    backgroundColor: 'red',

  },

  dropdown_header: {
    borderWidth: 0,
    width: wp('57%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4.3%'),
    color: '#676767',
    borderBottomWidth: hp('0.15%'),
    borderBottomColor: '#707070',

  },
  dropdown_container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 1,


  },
  dropdown_container_Pro: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 1,

  },
  preferredLanguageText: {
    fontFamily: 'Roboto-Medium',
    fontSize: wp('5.3%'),
  },
  LanguageText: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
    fontWeight: '400',
  },
  btn: {
    width: wp('35%'),
    height: hp('5.7%'),
    backgroundColor: '#0078FF',
    borderRadius: hp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: wp('2%')
  },
  btn_text: {
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.3%'),
    color: '#FFFFFF',
    textAlign: 'center'
  },
  voice_text: {
    marginTop: hp('5%'),
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('3%'),
    borderBottomWidth: 1,
    borderBottomColor: '#707070',
  },
  modalTitle: {
    flex: 1,
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4.3%'),
    color: '#0078FF',
    marginLeft: wp('2%'),
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: wp('3%'),
    paddingTop: hp('2%'),
  },
  modalLanguageItem: {
    paddingVertical: hp('1%'),
  },
  modalLanguageItemSelected: {
    backgroundColor: '#F2F2F2',
    borderRadius: wp('1%'),
  },
  modalLanguageText: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4.3%'),
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

export default StudentLanguage;
