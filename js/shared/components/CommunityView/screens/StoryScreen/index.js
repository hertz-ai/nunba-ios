import React, {useState, useEffect} from 'react';
import {
  Text,
  SafeAreaView,
  ActivityIndicator,
  ImageBackground,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import styles from './styles';

const StoryScreen = () => {
  const route = useRoute();
  const [userStories, setUserStories] = useState(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [activeStory, setActiveStory] = useState(null);
  const id = route.params.id;

  useEffect(() => {
    const userStory = route.params.stories;
    setUserStories(userStory);
    setActiveStoryIndex(0);
  }, [userStories, route]);

  useEffect(() => {
    if (userStories) {
      if (activeStoryIndex < 0) {
        setActiveStoryIndex(0);
      }
      if (activeStoryIndex > userStories.length - 1) {
        setActiveStoryIndex(userStories.length - 1);
      }

      setActiveStory(userStories[activeStoryIndex]);
    }
  }, [activeStoryIndex, userStories]);

  if (!activeStory) {
    return (
      <SafeAreaView>
        <ActivityIndicator size="large" color="#0000ff" />
      </SafeAreaView>
    );
  }

  const handlePress = evt => {
    const x = evt.nativeEvent.locationX;
    const screenWidth = Dimensions.get('window').width;
    if (x > screenWidth / 2) {
      handleNextStory();
    } else {
      handlePrevStory();
    }
  };

  const navigateToNextUser = () => { navigation.goBack(); };
  const navigateToPrevUser = () => { navigation.goBack(); };

  const handleNextStory = () => {
    if (activeStoryIndex >= userStories.length - 1) {
      navigateToNextUser();
    }
    setActiveStoryIndex(activeStoryIndex + 1);
  };
  const handlePrevStory = () => {
    if (activeStoryIndex <= 0) {
      navigateToPrevUser();
    }
    setActiveStoryIndex(activeStoryIndex - 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={handlePress}>
        <ImageBackground
          source={{uri: activeStory.imageUri}}
          style={styles.image}
        />
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

export default StoryScreen;
