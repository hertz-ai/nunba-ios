/* eslint-disable no-trailing-spaces */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState, useRef } from 'react';
import {
  NativeModules,
  Dimensions,
  TouchableHighlight,
  TouchableOpacity,
  ScrollView,
  View,
  Text,
  FlatList,
  Modal,
  Button,
  StyleSheet,
  DeviceEventEmitter,
  Image,
  TextInput,
  SafeAreaView,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import i18next from 'i18next';
import axios from 'axios';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

import useLanguageStore from '../../zustandStore';
import resources from './translations';
import Icon from 'react-native-vector-icons/FontAwesome';
const { OnboardingModule } = NativeModules;
const { SCREEN_WIDTH, SCREEN_HEIGHT } = Dimensions.get('window');
const { height } = Dimensions.get('window');

const Professional = [
  { label: i18next.t('atSchool'), value: 'School' },
  { label: i18next.t('atCollege'), value: 'College' },
  { label: i18next.t('Professional'), value: 'Professional' },
  { label: i18next.t('forExam'), value: 'Exams' },
  { label: i18next.t('other'), value: 'Others' },


]
const Adult_Learner = [
  { label: i18next.t('atSchool'), value: 'School' },
  { label: i18next.t('atCollege'), value: 'College' },
  { label: i18next.t('forExam'), value: 'Exams' },
  { label: i18next.t('Professional'), value: 'Professional' },
  { label: i18next.t('adultLearner'), value: 'Adult_Learner' },
  { label: i18next.t('other'), value: 'Others' },

]
const Self_Learner = [
  { label: i18next.t('atSchool'), value: 'School' },
  { label: i18next.t('atCollege'), value: 'College' },

  { label: i18next.t('forExam'), value: 'Exams' },
  { label: i18next.t('selfLearner'), value: 'Self_Learner' },
  { label: i18next.t('other'), value: 'Others' },
]



const Grade = ({ navigation }) => {
  const backButtonRef = useRef();
  const confirmButtonRef = useRef();
  const [question, setQuestions] = useState([
    {
      questionTitle: 'what best describes You ?',
    },
    {
      questionTitle: 'Select a Board / Specialization ?',
    },
    {
      questionTitle: 'Select Or enter Exam',
    },
  ]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  const userAge = 25
  const vicuna_url = 'http://azure_langchaingpt.hertzai.com:8088/chat';

  // const userAge = useLanguageStore((state) => state.userAge);

  const [StandardName, setStandardName] = useState('');

  // For School

  const [openSchool, setOpenSchool] = useState(false);
  const [valueClass, setValueClass] = useState(' ');
  const [itemSchool, setItemSchool] = useState([]);


  //For Board

  const [openBoard, setOpenBoard] = useState(false);
  const [valueBoard, setValueBoard] = useState(null);
  const [itemBoard, setItemBoard] = useState([]);


  // For College
  const [openSem, setOpenSem] = useState(false);
  const [valueSem, setValueSem] = useState(null);
  const [itemSemester, setItemSemester] = useState([]);


  //For Specialization

  const [openSpecialization, setOpenSpecialization] = useState(false);
  const [valueSpecialization, setValueSpecialization] = useState(null);
  const [itemSpecialization, setItemSpecialization] = useState([]);
  //For otion
  const [openWhoSelect, setWhoSelect] = useState(false);
  const [valueWhoSelect, setValueWhoSelect] = useState(null);
  const [itemsWhoSelect, setItemsWhoSelect] = useState([

  ]);


  //For professional
  const [openProfessional, setOpenProfessional] = useState(false)
  const [ValueProfessional, setValueProfessional] = useState('')
  const [itemProfessional, setItemProfessional] = useState([])


  //For Exam
  const [openExam, setOpenExam] = useState(false);
  const [valueExam, setValueExam] = useState(null);
  const [itemExam, setItemExam] = useState([]);

  //for Course
  const [openCourse, setOpenCourse] = useState(false);
  const [valueCourse, setValueCourse] = useState(null);
  const [itemCourse, setItemCourse] = useState([]);

  //for Goal
  const [openGoal, setOpenGoal] = useState(false);
  const [valueGoal, setValueGoal] = useState(null);
  const [itemGoal, setItemGoal] = useState([]);

  //for Learner
  const [openLearner, setOpenLearner] = useState(false);
  const [valueLearner, setValueLearner] = useState(null);
  const [itemLearner, setItemLearner] = useState([]);

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

  //array for Search
  const [SearchInput, setSearchInput] = useState('');


  const [result, setResult] = useState('')
  const [recognizedText, setRecognizedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [Error, setError] = useState('')
  console.log(itemProfessional)


  useEffect(() => {
    if (userAge >= 22) {
      setItemsWhoSelect(Adult_Learner);
    } else if (userAge >= 19) {
      setItemsWhoSelect(Professional);
    } else if (userAge > 8) {
      setItemsWhoSelect(Self_Learner);
    } else {

    }
  }, [userAge]);
  useEffect(() => {
    fetchGradeDetails();
    const restoreWhoSelect = async () => {
      await OnboardingModule.getWhoSelect((category, boardOrSpecializationOrProfession, stdorSemOrGoalOrCourseOrExamName) => {
        console.log('restore11')
        console.log('Category:', category);
        console.log('BoardOrSpecializationOrProfession:', boardOrSpecializationOrProfession);
        console.log('StdorSemOrGoalOrCourseOrExamName33:', stdorSemOrGoalOrCourseOrExamName);
        setValueWhoSelect(category ? { label: category, value: category } : null);
        setValueBoard(boardOrSpecializationOrProfession ? { label: boardOrSpecializationOrProfession, value: boardOrSpecializationOrProfession } : null);
        setValueClass(stdorSemOrGoalOrCourseOrExamName ? { label: stdorSemOrGoalOrCourseOrExamName, value: stdorSemOrGoalOrCourseOrExamName } : null);

        if (category === 'School') {
          setValueWhoSelect({ label: category, value: category });
          setValueBoard(boardOrSpecializationOrProfession ? { label: boardOrSpecializationOrProfession, value: boardOrSpecializationOrProfession } : null);
          setValueClass(stdorSemOrGoalOrCourseOrExamName ? { label: stdorSemOrGoalOrCourseOrExamName, value: stdorSemOrGoalOrCourseOrExamName } : null);

        }
        else if (category === 'College') {
          setValueWhoSelect({ label: category, value: category });
          setValueSpecialization(boardOrSpecializationOrProfession ? { label: boardOrSpecializationOrProfession, value: boardOrSpecializationOrProfession } : null);
          setValueSem(stdorSemOrGoalOrCourseOrExamName ? { label: stdorSemOrGoalOrCourseOrExamName, value: stdorSemOrGoalOrCourseOrExamName } : null);

        }
        else if (category === 'Professional') {
          setValueWhoSelect({ label: category, value: category });
          setValueProfessional(boardOrSpecializationOrProfession ? { label: boardOrSpecializationOrProfession, value: boardOrSpecializationOrProfession } : null);
          setValueGoal(stdorSemOrGoalOrCourseOrExamName ? { label: stdorSemOrGoalOrCourseOrExamName, value: stdorSemOrGoalOrCourseOrExamName } : null);

        }
        else if (category === 'Exams') {
          setValueWhoSelect({ label: category, value: category });
          setValueExam(boardOrSpecializationOrProfession ? { label: boardOrSpecializationOrProfession, value: boardOrSpecializationOrProfession } : null);
          setValueClass(stdorSemOrGoalOrCourseOrExamName ? { label: stdorSemOrGoalOrCourseOrExamName, value: stdorSemOrGoalOrCourseOrExamName } : null);

        }
        else if (category === 'Adult_Learner') {
          setValueWhoSelect({ label: category, value: category });
          setValueBoard(boardOrSpecializationOrProfession ? { label: boardOrSpecializationOrProfession, value: boardOrSpecializationOrProfession } : null);
          setValueGoal(stdorSemOrGoalOrCourseOrExamName ? { label: stdorSemOrGoalOrCourseOrExamName, value: stdorSemOrGoalOrCourseOrExamName } : null);

        }
        else if (category === 'Self_Learner') {
          setValueWhoSelect({ label: category, value: category });
          setValueBoard(boardOrSpecializationOrProfession ? { label: boardOrSpecializationOrProfession, value: boardOrSpecializationOrProfession } : null);
          setValueLearner(stdorSemOrGoalOrCourseOrExamName ? { label: stdorSemOrGoalOrCourseOrExamName, value: stdorSemOrGoalOrCourseOrExamName } : null);

        }
        else if (category === 'Others') {
          setValueWhoSelect({ label: category, value: category });
          setValueBoard(boardOrSpecializationOrProfession ? { label: boardOrSpecializationOrProfession, value: boardOrSpecializationOrProfession } : null);
          setValueGoal(stdorSemOrGoalOrCourseOrExamName ? { label: stdorSemOrGoalOrCourseOrExamName, value: stdorSemOrGoalOrCourseOrExamName } : null);

        }




      });


    };

    restoreWhoSelect();
  }, []);
  function SkipButton (){
    OnboardingModule.createWhoSelect(category, boardOrSpecializationOrProfession, stdorSemOrGoalOrCourseOrExamName);
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


  let category = ''
  let boardOrSpecializationOrProfession = ''
  let stdorSemOrGoalOrCourseOrExamName = ''
  if (valueWhoSelect && valueWhoSelect.value === 'School') {
    category = valueWhoSelect?.value || undefined;
    boardOrSpecializationOrProfession = valueBoard?.value || undefined;
    stdorSemOrGoalOrCourseOrExamName = valueClass?.value || undefined;
    console.log("********School*******", category, stdorSemOrGoalOrCourseOrExamName, boardOrSpecializationOrProfession)

  } else if (valueWhoSelect && valueWhoSelect.value === 'College') {
    category = valueWhoSelect?.value || undefined
    boardOrSpecializationOrProfession = valueSpecialization?.value || undefined
    stdorSemOrGoalOrCourseOrExamName = valueSem?.value || undefined
    console.log("********College*******", category, stdorSemOrGoalOrCourseOrExamName, boardOrSpecializationOrProfession)


  } else if (valueWhoSelect && valueWhoSelect.value === 'Professional') {
    category = valueWhoSelect?.value || undefined
    boardOrSpecializationOrProfession = ValueProfessional?.value || undefined
    stdorSemOrGoalOrCourseOrExamName = valueGoal?.value || undefined
    console.log("********Professional*******", category, stdorSemOrGoalOrCourseOrExamName, boardOrSpecializationOrProfession)


  } else if (valueWhoSelect && valueWhoSelect.value === 'Exams') {
    category = valueWhoSelect?.value || undefined
    boardOrSpecializationOrProfession = valueExam?.value || undefined
    stdorSemOrGoalOrCourseOrExamName = 'null';
    console.log("********Exam*******", category, stdorSemOrGoalOrCourseOrExamName, boardOrSpecializationOrProfession)


  } else if (valueWhoSelect && valueWhoSelect.value === 'Adult_Learner') {
    category = valueWhoSelect?.value || undefined
    boardOrSpecializationOrProfession = 'null';
    stdorSemOrGoalOrCourseOrExamName = valueGoal?.value || undefined
    console.log("********Adult_Learner*******", category, stdorSemOrGoalOrCourseOrExamName, boardOrSpecializationOrProfession)


  } else if (valueWhoSelect && valueWhoSelect.value === 'Self_Learner') {
    category = valueWhoSelect?.value || undefined
    boardOrSpecializationOrProfession = 'null';
    stdorSemOrGoalOrCourseOrExamName = valueLearner?.value || undefined
    console.log("********Self_Learner*******", category, stdorSemOrGoalOrCourseOrExamName, boardOrSpecializationOrProfession)


  } else if (valueWhoSelect && valueWhoSelect.value === 'Others') {
    category = valueWhoSelect?.value || undefined
    boardOrSpecializationOrProfession = 'null',
      stdorSemOrGoalOrCourseOrExamName = valueGoal?.value || undefined;
    console.log("********Others*******", category, stdorSemOrGoalOrCourseOrExamName, boardOrSpecializationOrProfession)


  }
  useEffect(() => {
    console.log("Category:1", category);
    console.log("Board/Specialization/Profession:", boardOrSpecializationOrProfession);
    console.log("Std/Sem/Goal/Course/Exam Name:", stdorSemOrGoalOrCourseOrExamName);
  }, [category, boardOrSpecializationOrProfession, stdorSemOrGoalOrCourseOrExamName,]);



  useEffect(() => {
    // Initialize i18next with the selected language from your state management system
    i18next.init({
      compatibilityJSON: 'v3',
      interpolation: { escapeValue: false },
      lng: preferred_language || '', // Set initial language to preferred_language if available, otherwise empty string
      resources,
    });
  }, [preferred_language]);

  //forSearch
  const handleForBoard = (inputValue) => {
    const newItem = { label: inputValue, value: inputValue };
    setItemBoard((prevItemBoard) => [...prevItemBoard, newItem]);
    setValueBoard(newItem);
    setOpenBoard(false);
    setSearchInput('')
  };


  const handleForSchool = (inputValue) => {
    const newValue = { label: inputValue, value: inputValue };
    setItemSchool((prevItemSchool) => [...prevItemSchool, newValue]);
    setValueClass(newValue);
    setOpenSchool(false);
    setSearchInput('')


  };
  const handleForSpecialization = (inputValue) => {
    const newValue = { label: inputValue, value: inputValue };
    setItemSpecialization((prevSpecialization) => [...prevSpecialization, newValue]);
    setValueSpecialization(newValue);
    setOpenSpecialization(false)
    setSearchInput('')
  };
  const handleForSemester = (inputValue) => {
    const newValue = { label: inputValue, value: inputValue };
    setItemSemester((Semester) => [...Semester, newValue]);
    setValueSem(newValue);
    setOpenSem(false)
    setSearchInput('')
  };
  const handleForProfessional = (inputValue) => {
    const newValue = { label: inputValue, value: inputValue };
    setItemProfessional((Professional) => [...Professional, newValue]);
    setValueProfessional(newValue);
    setOpenProfessional(false)
    setSearchInput('')
  };

  const handleForGoal = (inputValue) => {
    const newValue = { label: inputValue, value: inputValue };
    setItemGoal((Goal) => [...Goal, newValue]);
    setValueGoal(newValue);
    setOpenGoal(false)
    setSearchInput('')
  };

  const handleForExam = (inputValue) => {
    const newValue = { label: inputValue, value: inputValue };
    setItemExam((Exam) => [...Exam, newValue]);
    setValueExam(newValue);
    setOpenExam(false)
    setSearchInput('')
  };
  const handleForLearner = (inputValue) => {
    const newValue = { label: inputValue, value: inputValue };
    setItemLearner((Learner) => [...Learner, newValue]);
    setValueLearner(newValue);
    setOpenLearner(false)
    setSearchInput('')
  };




  //for Selection


  const handleSelectItemWhoSelect = (item) => {
    setValueWhoSelect(item);
    setWhoSelect(false);
  };


  const ForSelectBoard = (item) => {
    setValueBoard(item);
    setOpenBoard(false);

  };
  const forSelectClass = (item) => {
    setValueClass(item);
    setOpenSchool(false);
  };
  const forSelectSpecialization = (item) => {
    setValueSpecialization(item);
    setOpenSpecialization(false);
  };

  const forSelectSemester = (item) => {
    setValueSem(item);
    setOpenSem(false);
  };
  const handleSelectProfessional = (item) => {
    setValueProfessional(item);
    setOpenProfessional(false);
  };

  const handleSelectExam = (item) => {
    setValueExam(item);
    setOpenExam(false);
  };

  const handleSelectGoal = (item) => {
    setValueGoal(item);
    setOpenGoal(false);
  };


  const handleSelectLearner = (item) => {
    setValueLearner(item);

    setOpenLearner(false);
  };

  useEffect(() => {

    if (recognizedText) {
      // Combine the variables into a single template string
      const optionsForResult = `
      let userName = '${question[activeQuestionIndex]?.questionTitle} You are in school or College preparing for exam or you are professional or adult learner or self learner or E-Learning you have to select the option from that ';
      let userInput = ${JSON.stringify(recognizedText)};
      let askedQuestion = ${JSON.stringify(question[activeQuestionIndex]?.questionTitle)};
    `;

      // Create the prompt using the combined variables
      const prompt = `
        TEXT: ${optionsForResult}
        RESPONSE FORMAT: can you give me the answet who are you You are in school or College preparing for exam or you are professional or adult learner or self learner or E-Learning !
      `;

      const headers = { 'Content-Type': 'application/json' };

      const payload = {
        conversation_list: [],
        prompt: prompt
      };
      axios.post(vicuna_url, payload, { headers: headers })
        .then(response => {

          if (response.data === 'School') {
            setValueWhoSelect(response.data)
          }
          else if (response.data == "College") {

          }





        })

        .catch(error => {
          setError('Error:', error)
        });
    }
  }, [recognizedText]);
  const fetchGradeDetails = async () => {
    const url = 'http://aws_hevolve.hertzai.com:6006/getstandard_category';
    try {
      const response = await fetch(url);
      const data = await response.json();

      const School = [];
      const College = [];
      const Other = [];
      const Professional = [];
      const AdultLearner = [];
      const Board = [];
      const Specialization = [];
      const Goal = [];
      const Course = [];
      const Exam = []
      const Self_Learner = []

      // Iterate through the "standard" data
      for (let i = 0; i < data.standard.length; i++) {
        const standardItem = data.standard[i];
        switch (standardItem.institution_category) {
          case 1:
            School.push({ label: standardItem.standard, value: standardItem.standard });
            break;
          case 2:
            College.push({ label: standardItem.standard, value: standardItem.standard });
            break;
          case 3:
            Professional.push({ label: standardItem.standard, value: standardItem.standard });
            break;
          case 4:
            Exam.push({ label: standardItem.standard, value: standardItem.standard });

            break;
          case 5:
            Self_Learner.push({ label: standardItem.standard, value: standardItem.standard });
            break;
          case 6:
            Other.push({ label: standardItem.standard, value: standardItem.standard });
            break;


        }
      }

      // Iterate through the "board" data
      for (let i = 0; i < data.board.length; i++) {
        const boardItem = data.board[i];
        Board.push({ label: boardItem.board_name, value: boardItem.board_name });
      }
      //For Course
      for (let i = 0; i < data.course.length; i++) {
        const courseItem = data.course[i];
        Specialization.push({ label: courseItem.name, value: courseItem.name });
      }
      //For Goal
      for (let i = 0; i < data.goal.length; i++) {
        const goalItem = data.goal[i];
        Goal.push({ label: goalItem.goals, value: goalItem.goals });
      }

      // The rest of your code...

      setItemSemester(College);
      setItemSchool(School);
      setItemProfessional(Professional);
      setItemBoard(Board);
      setItemCourse(Course);
      setItemGoal(Goal);
      setItemSpecialization(Specialization);
      setItemExam(Exam);
      setItemLearner(Self_Learner)

      return data;
    } catch (error) {
      console.error(error);
    }
  };



  useEffect(() => {
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
    setResult('')
    setError('')
    setRecognizedText('')
  };

  const stopRecording = () => {
    // Add any logic to stop the recording if needed
    setIsRecording(false);
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
    <View style={styles.Maincontainer}>
      <View style={styles.header}>
        <View style={styles.headerFirstElement}>
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
          </TouchableOpacity></View>

        <View style={styles.HeadTextContainer}>
          <Text style={styles.subtitle}>{i18next.t('fewMoreStep')}</Text>
          <Text style={styles.mid_subtitle}>{i18next.t('Institutions')}</Text>
        </View>
      </View >
      {renderLanguageModal()}


      <View style={[styles.MainDropDownContainer]}>

        <View style={styles.firstDropDown}>
          <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setWhoSelect(!openWhoSelect)}>
            <Text style={{ color: 'black' }}>
              {valueWhoSelect ? valueWhoSelect.label : i18next.t('describeyou')}

            </Text>
            {openWhoSelect ? (
              <Icon name="chevron-up" size={16} color="black" />
            ) : (
              <Icon name="chevron-down" size={16} color="black" />
            )}
          </TouchableOpacity>

          {openWhoSelect && (
            <View style={styles.dropforabsolute}>

              <FlatList

                data={itemsWhoSelect.filter((item) =>
                  item.label.toLowerCase().includes(SearchInput.toLowerCase())
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectItemWhoSelect(item)}>
                    <Text style={styles.dropdown_item}>{item.label}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.label}
                style={{ maxHeight: 130 }} // Adjust the maxHeight as needed
              />

            </View>
          )}
        </View>
        <View style={styles.SecondandThirdDropdown}>
          {valueWhoSelect && valueWhoSelect.value === 'School' ? (
            <>
              <View style={[styles.SecondDropmain_2,]} >
                {/* Second Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenBoard(!openBoard)}>
                  <Text style={{ color: 'black' }}>
                    {valueBoard ? valueBoard.label : i18next.t('board')}
                  </Text>
                  {openBoard ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}

                </TouchableOpacity>
                {openBoard && (
                  <View style={styles.dropforabsolute}>
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Board...'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: valueBoard === null && SearchInput !== '' ? wp('35%') : wp('35%'), borderRadius: 10 }
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForBoard(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add </Text>
                      </TouchableOpacity>

                    </View>




                    <FlatList
                      data={itemBoard.filter((item) => {
                        return (
                          item.label &&
                          typeof item.label === 'string' &&
                          item.label.toLowerCase().includes(SearchInput.toLowerCase())
                        );
                      })}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => ForSelectBoard(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}
                    />

                  </View>
                )}

              </View>
              <View style={[styles.SecondDropmain_3,]}>
                {/* Third Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenSchool(!openSchool)}>
                  <Text style={{ color: 'black' }}>
                    {valueClass ? valueClass.label : i18next.t('classforvalue')}
                  </Text>
                  {openSchool ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}
                </TouchableOpacity>
                {openSchool && (
                  <View style={styles.dropforabsolute}>
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Class...'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: valueClass === null && SearchInput !== '' ? wp('35%') : wp('35%'), borderRadius: 10 } // Adjust percentages as needed
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForSchool(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add </Text>
                      </TouchableOpacity>

                    </View>


                    <FlatList
                      data={itemSchool.filter((item) => item.label.toLowerCase().includes(SearchInput.toLowerCase()))}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => forSelectClass(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}

                    />

                  </View>
                )}
              </View>
            </>
          ) : null}


          {valueWhoSelect && valueWhoSelect.value === 'College' ? (
            <>

              <View style={[styles.SecondDropmain_2,]} >
                {/* Second Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenSpecialization(!openSpecialization)}>
                  <Text style={{ color: 'black' }}>{valueSpecialization ? valueSpecialization.label : i18next.t('specialization')}</Text>{openSpecialization ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}
                </TouchableOpacity>
                {openSpecialization && (
                  <View style={styles.dropforabsolute}>
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Specialization...'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: valueSpecialization === null && SearchInput !== '' ? wp('35%') : wp('35%'), borderRadius: 10 } // Adjust percentages as needed
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForSpecialization(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add </Text>
                      </TouchableOpacity>


                    </View>

                    <FlatList
                      data={itemSpecialization.filter((item) => item.label.toLowerCase().includes(SearchInput.toLowerCase()))}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => forSelectSpecialization(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}

                    />

                  </View>
                )}
              </View>
              <View style={[styles.SecondDropmain_3,]}>
                {/* Third Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenSem(!openSem)}>
                  <Text style={{ color: 'black' }}>{valueSem ? valueSem.label : i18next.t('semester')}</Text>
                  {openSem ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}
                </TouchableOpacity>
                {openSem && (
                  <View style={styles.dropforabsolute}>
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Semester...'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: valueSem === null && SearchInput !== '' ? wp('35%') : wp('35%'), borderRadius: 10 } // Adjust percentages as needed
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForSemester(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add </Text>
                      </TouchableOpacity>

                    </View>

                    <FlatList
                      data={itemSemester.filter((item) => item.label.toLowerCase().includes(SearchInput.toLowerCase()))}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => forSelectSemester(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}

                    />

                  </View>
                )}
              </View>

            </>

          ) : null}
          {valueWhoSelect && valueWhoSelect.value === 'Professional' ? (
            <>

              <View style={[styles.SecondDropmain_2,]} >
                {/* Second Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenProfessional(!openProfessional)}>
                  <Text style={{ color: 'black' }}>{ValueProfessional ? ValueProfessional.label : i18next.t('Professionalplaceholder')}</Text>
                  {openProfessional ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}
                </TouchableOpacity>
                {openProfessional && (
                  <View style={styles.dropforabsolute}>
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Professional'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: ValueProfessional === null && SearchInput !== '' ? wp('35%') : wp('35%'), borderRadius: 10 } // Adjust percentages as needed
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForProfessional(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add</Text>
                      </TouchableOpacity>

                    </View>

                    <FlatList
                      data={itemProfessional.filter((item) => item.label.toLowerCase().includes(SearchInput.toLowerCase()))}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectProfessional(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}

                    />

                  </View>
                )}
              </View>
              <View style={[styles.SecondDropmain_3,]}>
                {/* Third Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenGoal(!openGoal)}>
                  <Text style={{ color: 'black' }}>{valueGoal ? valueGoal.label : 'goaltoachieve'}</Text>
                  {openGoal ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}
                </TouchableOpacity>
                {openGoal && (
                  <View style={styles.dropforabsolute} >
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Goal'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: itemGoal === null && SearchInput !== '' ? wp('35%') : wp('35%'), borderRadius: 10 } // Adjust percentages as needed
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForGoal(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add</Text>
                      </TouchableOpacity>

                    </View>
                    <FlatList
                      data={itemGoal.filter((item) => item.label.toLowerCase().includes(SearchInput.toLowerCase()))}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectGoal(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}

                    />

                  </View>
                )}
              </View>

            </>
          ) : null}
          {valueWhoSelect && valueWhoSelect.value == 'Exams' ? (
            <>

              <View style={[styles.SecondDropmain_2,]} >
                {/* Second Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenExam(!openExam)}>
                  <Text style={{ color: 'black' }}>{valueExam ? valueExam.label : i18next.t('EnterExam')}</Text>
                  {openExam ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}
                </TouchableOpacity>
                {openExam && (
                  <View style={styles.dropforabsolute} >
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Exam'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: valueExam === null && SearchInput !== '' ? wp('35%') : wp('35%') } // Adjust percentages as needed
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForExam(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add</Text>
                      </TouchableOpacity>

                    </View>

                    <FlatList
                      data={itemExam.filter((item) => item.label.toLowerCase().includes(SearchInput.toLowerCase()))}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectExam(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}

                    />


                  </View>
                )}
              </View>


            </>
          ) : null}
          {valueWhoSelect && valueWhoSelect.value === 'Adult_Learner' ? (
            <>


              <View style={[styles.SecondDropmain_2,]}>
                {/* Third Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenGoal(!openGoal)}>
                  <Text style={{ color: 'black' }}>{valueGoal ? valueGoal.label : i18next.t('goaltoachieve')} </Text>
                  {openGoal ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}
                </TouchableOpacity>
                {openGoal && (
                  <View style={styles.dropforabsolute}>
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Goal'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: itemGoal === null && SearchInput !== '' ? wp('35%') : wp('35%'), borderRadius: 10 } // Adjust percentages as needed
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForGoal(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add</Text>
                      </TouchableOpacity>

                    </View>

                    <FlatList
                      data={itemGoal.filter((item) => item.label.toLowerCase().includes(SearchInput.toLowerCase()))}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectGoal(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}

                    />

                  </View>
                )}
              </View>


            </>
          ) : null}
          {valueWhoSelect && valueWhoSelect.value === 'Self_Learner' ? (
            <>

              <View style={[styles.SecondDropmain_2,]}>
                {/* Third Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenLearner(!openLearner)}>
                  <Text style={{ color: 'black' }}>{valueLearner ? valueLearner.label : i18next.t('EnterExam')}</Text>
                  {openLearner ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}
                </TouchableOpacity>
                {openLearner && (
                  <View style={styles.dropforabsolute}>
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Goal'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: valueLearner === null && SearchInput !== '' ? wp('35%') : wp('35%'), borderRadius: 10 } // Adjust percentages as needed
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForLearner(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add</Text>
                      </TouchableOpacity>

                    </View>
                    <FlatList
                      data={itemLearner.filter((item) => item.label.toLowerCase().includes(SearchInput.toLowerCase()))}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectLearner(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}


                    />

                  </View>
                )}
              </View>


            </>
          ) : null}
          {valueWhoSelect && valueWhoSelect.value === 'Others' ? (
            <>

              <View style={[styles.SecondDropmain_2,]}>
                {/* Third Dropdown */}
                <TouchableOpacity style={{ display: 'flex', justifyContent: 'space-between', padding: 5, alignItems: 'center', flexDirection: 'row', width: wp('57%') }} onPress={() => setOpenGoal(!openGoal)}>
                  <Text style={{ color: 'black' }}>{valueGoal ? valueGoal.label : i18next.t('goaltoachieve')}
                  </Text>
                  {openGoal ? (
                    <Icon name="chevron-up" size={16} color="black" />
                  ) : (
                    <Icon name="chevron-down" size={16} color="black" />
                  )}
                </TouchableOpacity>
                {openGoal && (
                  <View style={styles.dropforabsolute} >
                    <View style={styles.rowContainer}>
                      <TextInput
                        placeholder='Search Goal'
                        onChangeText={(text) => setSearchInput(text)}
                        style={[
                          styles.forInputBox,
                          { width: valueExam === null && SearchInput !== '' ? wp('35%') : wp('35%'), borderRadius: 10 } // Adjust percentages as needed
                        ]}
                      />

                      <TouchableOpacity onPress={() => handleForGoal(SearchInput)} style={styles.addExamButton}>
                        <Text style={styles.addExamButtonText}>Add</Text>
                      </TouchableOpacity>

                    </View>
                    <FlatList
                      data={itemGoal.filter((item) => item.label.toLowerCase().includes(SearchInput.toLowerCase()))}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectGoal(item)}>
                          <Text style={styles.dropdown_item}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.label}
                      style={{ maxHeight: 130 }}

                    />

                  </View>
                )}
              </View>


            </>
          ) : null}

        </View>
      </View>


      <View style={styles.FooterElement}>
        <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row',width:wp('100%') }}>
        <Animatable.View
            ref={confirmButtonRef}
            duration={600}
            easing="ease-in-out">
            <TouchableOpacity style={styles.btn} onPress={SkipButton}>
              <Text style={styles.btn_text}>
              {i18next.t('SKIP')}
              </Text>
            </TouchableOpacity>
          </Animatable.View>
          <Animatable.View
            ref={confirmButtonRef}
            duration={600}
            easing="ease-in-out">
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                console.log('11111111111111111category:', category)
                console.log('22222222222222board:', boardOrSpecializationOrProfession)
                console.log('333333333333exam:', stdorSemOrGoalOrCourseOrExamName)
                OnboardingModule.createWhoSelect(category, boardOrSpecializationOrProfession, stdorSemOrGoalOrCourseOrExamName);
                confirmButtonRef.current
                  .fadeIn(600)
                  .then(() => navigation.navigate('WhoPays'));
              }}>
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
        <Text>{question[activeQuestionIndex]?.questionTitle}</Text>
        <Text>recognized Text: {recognizedText}</Text>

      </View>
    </View>
  );
};

// React Native Styles
const styles = StyleSheet.create({
  Maincontainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    // justifyContent: 'center',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',

  },

  header: {
    paddingHorizontal: 6,
    alignSelf: 'stretch',
    alignItems: 'center',
    display: 'flex',
    marginBottom: 20,
  },
  headerFirstElement: {
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingVertical: 10,
    textAlign: 'center'

  },
  HeadTextContainer: {
  },
  subtitle: {
    marginVertical: 15,
    fontFamily: 'Roboto-Regular',
    textAlign: 'center',
    fontSize: wp('5.3%'),
  },
  mid_subtitle: {
    // marginTop: 64,
    marginVertical: 7,
    fontFamily: 'Roboto-Medium',
    fontSize: wp('5.3%'),
    textAlign: 'center'

  },

  back_btn: {
    flexDirection: 'row',
    alignItems: 'center',
    textAlign: 'center',

  },
  invisible_btn: {
    flexDirection: 'row',
    alignItems: 'center',
    textAlign: 'center',
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
    textAlign: 'center',
  },




  // for the language dropdown
  title: {
    fontFamily: 'Roboto-Medium',
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
    textAlign: 'center',
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
    textAlign: 'center',
    borderRadius: 10,
    backgroundColor: '#4B68E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  MainDropDownContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    // alignSelf: "flex-start"
    position: 'relative'


  },
  firstDropDown: {
    display: 'flex',
    width: wp('57%'),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    zIndex: 20,
    marginBottom: hp('10%'),
    padding: 5,
    position: 'absolute',
    backgroundColor: '#ffff',




  },
  dropdown_item: {
    display: 'flex',
    width: wp('50%'),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    padding: 10,
    color: 'black',
    borderWidth: 1,
  },

  dropdownItem: {
    padding: 4,
    color: 'black',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',

  },
  dropdownList: {
    borderRadius: 10,
    flex: 1,
    width: '100%',
    maxHeight: 100,
  },


  SecondandThirdDropdown: {
    display: 'flex',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: wp('57%'),
    position: 'relative'

  },


  SecondDropmain_2: {
    backgroundColor: '#ffff',

    display: 'flex',
    width: wp('57%'),
    justifyContent: 'center',
    marginBottom: hp('10%'),
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 5,
    position: 'absolute',
    zIndex: 18,
    top: 150

  },
  SecondDropmain_3: {
    backgroundColor: '#ffff',
    display: 'flex',
    width: wp('57%'),
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    position: 'absolute',
    zIndex: 16,
    top: 300

  },



  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addExamButton: {
    backgroundColor: '#FFFFFf',
    borderRadius: 5,
    borderWidth: 1
  },
  addExamButtonText: {
    color: 'black',
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 6
    ,
  },
  forInputBox: {
    display: 'flex',
    width: wp('50%'),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: 'black',
    borderWidth: 1,
    margin: 2
  },



  FooterElement: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: wp('40%'),
    height: hp('5.7%'),
    // marginTop: hp('4%'),
    backgroundColor: '#0078FF',
    borderRadius: hp('3%'),
    marginHorizontal:wp('2%'),

    textAlign: 'center',
  },
  forInputBox_Container: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  btn_text: {
    // width: 74,
    // height: 26,
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.3%'),
    textAlign: 'center',
    color: '#FFFFFF',

  },

  voice_text: {
    marginTop: hp('4.5%'),
    // marginTop: 'auto',
    fontFamily: 'Roboto-Medium',
    fontSize: wp('4.3%'),
    color: '#0078FF',
  },
  micImg: {
    width: wp('11.5%'),
    height: undefined,
    aspectRatio: 55 / 80,
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
    alignSelf: 'center'
  },

});

export default Grade;
