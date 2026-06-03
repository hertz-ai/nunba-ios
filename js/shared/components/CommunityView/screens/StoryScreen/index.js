import React, {useState, useEffect} from 'react';
import {
  Text,
  SafeAreaView,
  ActivityIndicator,
  ImageBackground,
  TouchableWithoutFeedback,
  Dimensions,
  View,
  StatusBar,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
// 2026-06-03: dropped react-native-video-controls (v5-era wrapper).
// See StoryCard for the longer note — same v6 compat reason here.
import Video from 'react-native-video';
import styles from './styles';

// Stories come from the feed rail wrapped as [story] so we always
// iterate an array.  Each story uses `resourceUri` for the media URL
// (image OR video) and `user.imageUri` for the avatar.  The earlier
// `activeStory.imageUri` reference was never populated and rendered
// the screen blank.  navigation was also referenced without being
// resolved from useNavigation(), which threw on next/prev-user taps
// and crashed the app back to launcher.  Both fixed here, plus a
// guard so an empty stories array degrades to "go back" instead of
// hanging on ActivityIndicator forever.
const StoryScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  const userStories = (route.params && route.params.stories) || [];
  const activeStory = userStories[activeStoryIndex];

  useEffect(() => {
    if (!userStories.length) {
      try { navigation.goBack(); } catch (_e) {}
    }
  }, [userStories.length, navigation]);

  if (!activeStory) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color="#FFFFFF" />
      </SafeAreaView>
    );
  }

  const goNext = () => {
    if (activeStoryIndex >= userStories.length - 1) {
      try { navigation.goBack(); } catch (_e) {}
      return;
    }
    setActiveStoryIndex(activeStoryIndex + 1);
  };
  const goPrev = () => {
    if (activeStoryIndex <= 0) {
      try { navigation.goBack(); } catch (_e) {}
      return;
    }
    setActiveStoryIndex(activeStoryIndex - 1);
  };

  const handlePress = evt => {
    const x = evt.nativeEvent.locationX;
    const screenWidth = Dimensions.get('window').width;
    if (x > screenWidth / 2) {
      goNext();
    } else {
      goPrev();
    }
  };

  const mediaUri = activeStory.resourceUri || activeStory.imageUri;
  const isVideo = (activeStory.contentType || '').includes('video');
  const caption = activeStory.caption || '';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={{flex: 1, backgroundColor: '#000'}}>
          {isVideo ? (
            <Video
              source={{uri: mediaUri}}
              style={styles.image}
              paused={false}
              muted={false}
              resizeMode="cover"
              repeat={false}
              controls={false}
              ignoreSilentSwitch="ignore"
              onEnd={goNext}
            />
          ) : (
            <ImageBackground source={{uri: mediaUri}} style={styles.image}>
              {caption ? (
                <Text style={{color: '#fff', fontSize: 18, padding: 16}}>
                  {caption}
                </Text>
              ) : null}
            </ImageBackground>
          )}
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

export default StoryScreen;
