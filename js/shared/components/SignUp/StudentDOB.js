/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState, useRef } from 'react';
import {
  NativeModules,
  Dimensions,
  Modal,
  FlatList,
  TouchableOpacity,
  DeviceEventEmitter,
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Animatable from 'react-native-animatable';
import axios from 'axios'
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import i18next from 'i18next';
import useLanguageStore from '../../zustandStore';
import resources from './translations';

const { OnboardingModule } = NativeModules;
const { SCREEN_WIDTH, SCREEN_HEIGHT } = Dimensions.get('window');


const StudentDOB = ({ navigation, route }) => {
  var currentDate = new Date();
  const { height } = Dimensions.get('window');
  const [date, setDate] = useState(currentDate);
  const [studentName, setStudentName] = useState('');
  const [Show, setShow] = useState(false);
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
  const [recognizedText, setRecognizedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState('')
  const [Question, setQuestion] = useState('Tell me Your Date of Birth')
  const [Error, setError] = useState('')
  const backButtonRef = useRef();
  const confirmButtonRef = useRef();

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
  const askedQuestion = "What is the your Date of Birth?";

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
  const calculateAge = () => {
    const dob = new Date(date);
    const currentDate = new Date();
    const age = currentDate.getFullYear() - dob.getFullYear();
    const currentMonth = currentDate.getMonth();
    const birthMonth = dob.getMonth();
    if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDate.getDate() < dob.getDate())) {
      return age - 1;
    }
    return age;
  };
  const userAge = calculateAge();
  const setUserAge = useLanguageStore((state) => state.setUserAge);

  useEffect(() => {
    setUserAge(userAge); // Set the userAge in the Zustand store
  }, [userAge, date]);
  useEffect(() => {
    if (recognizedText) {
      const optionsForResult = `
        let userName = 'Can you pick the Date of Birth of the person from the userInput';
        let userInput = ${JSON.stringify(recognizedText)};
        let askedQuestion = ${JSON.stringify(askedQuestion)};
      `;

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
          const vicunaDate = response.data.trim(); // Trim any whitespace
          const dateParts = vicunaDate.split('-'); // Split the date into parts
          const formattedDate = `${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}-${dateParts[2]}`;
          setResult(formattedDate); // Update the result with the formatted date
          console.log(formattedDate)
          // Update other state variables if needed
          // setStudentName(response.data); // Assuming the API response contains the name
        })
        .catch(error => {
          setError('Error:', error);
        });
    }
  }, [recognizedText]);


  console.log(recognizedText)

  const handleStartSpeechListening = () => {
    if (isRecording) {
      // If already recording, stop recording
      stopRecording();
    } else {
      // If not recording, start recording
      startRecording();
      setQuestion('Tell me Your Date of Birth');
    }
  };

  function SkipButton (){
    if (date === currentDate) {
      alert("Date of Birth cannot be today's date");
    } const dob = date.toISOString().slice(0, 10); // Format the date as "YYYY-MM-DD"
    console.log("Formatted DOB: ", dob);
      OnboardingModule.createStudentDOB(dob);
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

  const startRecording = () => {
    NativeModules.ActivityStarterModule.startSpeechListening();
    setIsRecording(true);
    setResult('')
    setError('')
    setRecognizedText('')
    setStudentName('')


  };

  const stopRecording = () => {
    // Add any logic to stop the recording if needed
    setIsRecording(false);
    setRecognizedText('');
  };
  const DateIcon = () => {
    return (
      <Image
        style={styles.date_icon}
        source={require('../../images/date_icon.png')}
      />
    );
  };
  useEffect(() => {
    const restoreStudentDOB = async () => {
      await OnboardingModule.getStudentDOB(DOB => {
        if (DOB !== null) {
          setDate(new Date(DOB));
        }
      });
    };
    const restoreStudentName = async () => {
      await OnboardingModule.getStudentName(StudentName => {
        if (StudentName !== null) setStudentName(StudentName);
      });
    };
    restoreStudentDOB();
    restoreStudentName();
  }, []);

  function validate() {
    if (date === currentDate) {
      alert("Date of Birth cannot be today's date");
    } else {
      const dob = date.toISOString().slice(0, 10); // Format the date as "YYYY-MM-DD"
      console.log("Formatted DOB: ", dob);

      OnboardingModule.createStudentDOB(dob);

      confirmButtonRef.current
        .fadeIn(600)
        .then(() => navigation.navigate('StudentGender'));
    }
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

      <Image
        style={styles.studentImg}
        source={require('../../images/student.png')}
      />
      <Text style={styles.mid_title}>
        <Text style={{ fontFamily: 'Roboto-Medium' }}>{studentName},</Text>
        {i18next.t('tellAbout')}
      </Text>
      <Text style={styles.mid_subtitle}>{i18next.t('DOB')}</Text>
      <TouchableOpacity onPress={() => setShow(true)}>
        {/* Set Show to true to show the DatePicker */}
        <View style={styles.dateModal}>
          <DateIcon />
          <Text style={styles.dateText}> {date.toLocaleDateString()}</Text>
        </View>
      </TouchableOpacity>
      {Show && ( // Show the DatePicker only when Show is true
        <DateTimePicker
          style={styles.datePickerStyle}
          value={date} // Initial date from state
          display="calendar"
          mode="date" // The enum of date, datetime and time
          placeholder="dd/mm/yyyy"
          format="DD-MM-YYYY"
          maxDate={currentDate}
          confirmBtnText="Confirm"
          cancelBtnText="Cancel"
          iconComponent={<DateIcon />}
          customStyles={{
            dateIcon: {
              display: 'none',
            },
            dateInput: {
              borderWidth: 0,
              alignItems: 'flex-start',
            },
            dateText: {
              fontFamily: 'Roboto-Regular',
              fontSize: wp('4.3%'),
              color: '#676767',
            },
            placeholderText: {
              fontFamily: 'Roboto-Regular',
              fontSize: wp('4.3%'),
              color: '#676767',
            },
          }}
          onChange={(event, selectedDate) => {
            setDate(selectedDate);
            setShow(false); // Hide the DatePicker when a date is selected
          }}
        />
      )}
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

// StudentDOB.sharedElements = route => {
//   return [
//     {
//       id: "confirmBtn",
//       animation: 'fade',
//       resize: 'none',
//       align: 'center-center'
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
  dateModal: {
    flexDirection: 'row',
    paddingTop: hp('2.4%'),
    alignContent: 'space-between',
  },
  dateText: {
    fontFamily: 'Roboto-Regular',
    fontSize: wp('4.3%'),
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

  studentImg: {
    // resizeMode: "center",
    width: wp('33%'),
    height: undefined,
    aspectRatio: 152.88 / 162.93,
    marginTop: hp('3.8%'),
    // position:"relative"
  },

  mid_title: {
    // width: 240,
    // height: 26,
    marginTop: hp('5.6%'),
    fontFamily: 'Roboto-Regular',
    fontSize: wp('5.3%'),
    // backgroundColor: "blue"
  },

  mid_subtitle: {
    // width: 54,
    // height: 26,
    marginTop: hp('2.4%'),
    fontFamily: 'Roboto-Medium',
    fontSize: wp('5.3%'),
  },

  datePickerStyle: {
    width: wp('57%'),
    marginTop: hp('1%'),
    borderBottomWidth: hp('0.15%'),
    borderBottomColor: '#707070',
  },

  date_icon: {
    // resizeMode: "center",
    width: wp('5%'),
    height: undefined,
    aspectRatio: 21.88 / 25,
    marginBottom: hp('1%'),
    // marginTop: 2.5,
  },

  btn: {
    width: wp('40%'),
    height: hp('5.7%'),
    marginTop: hp('7.5%'),
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
    fontSize: wp('4.3%'),
    color: '#FFFFFF',
    textAlign: 'center'
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
});

export default StudentDOB;
