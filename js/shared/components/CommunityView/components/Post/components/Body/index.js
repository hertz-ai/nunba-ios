import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Image, Text, View, TouchableOpacity, NativeModules, Dimensions } from 'react-native';
import styles from './styles';
import useThemeStore from '../../../../../../colorThemeZustand';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useNavigation } from '@react-navigation/native';
const { OnboardingModule } = NativeModules;
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import VideoPlayer from 'react-native-video-controls';
const Body = ({ resourceUri, contentType, caption, userData }) => {
  const navigation = useNavigation();
  const [textShown, setTextShown] = useState(false);
  const [lengthMore, setLengthMore] = useState(false);
  const { theme } = useThemeStore();
  const [userId, setUserId] = useState();
  const [muted, setMuted] = useState(true);

  const toggleMute = () => {
    setMuted(!muted);
  };
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        OnboardingModule.getUser_id((userId) => {
         // console.log('User ID:', userId);
          setUserId(userId);
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  const toggleNumberOfLines = () => {
    setTextShown(!textShown);
  };
  const muteIcon = muted ? 'volume-mute' : 'volume-high'
  const containercaption = {
    ...styles.caption,
    color: theme === 'dark' ? 'black' : 'black',
  };

  const containervideo = {
    ...styles.videoContainer,
    backgroundColor: theme === 'dark' ? 'black' : 'black',
  };

  const onTextLayout = useCallback(e => {
    setLengthMore(e.nativeEvent.lines.length >= 2);
  }, []);

  const navigateToCommentsList = () => {
    navigation.navigate('CommentsList', { userData, userId });
  };

  if (contentType === 'image') {
    return (
      <View style={{ backgroundColor: 'black' }}>
        {caption ? (
          <Text
            style={[styles.caption, { lineHeight: 21 }]}
            onTextLayout={onTextLayout}
            onPress={toggleNumberOfLines}
            numberOfLines={textShown ? undefined : 2}
          >
            {caption}
            {lengthMore ? (textShown ? ' Read less' : ' Read more') : null}
          </Text>
        ) : null}
        <TouchableOpacity onPress={navigateToCommentsList}>
          <Image source={{ uri: resourceUri }} style={styles.image} />
        </TouchableOpacity>
      </View>
    );
  } else if (contentType === 'video') {
    return (
      <>
        {caption ? (

          <Text
            style={[containercaption, { lineHeight: 21 }]}
            onTextLayout={onTextLayout}
            onPress={toggleNumberOfLines}
            numberOfLines={textShown ? undefined : 1}
          >
            {caption}
            {lengthMore ? (textShown ? ' Read less' : ' Read more') : null}
          </Text>

        ) : null}
        <TouchableOpacity onPress={navigateToCommentsList} >
          <View style={containervideo}>
           <VideoPlayer
                              source={{uri: resourceUri}}
                              videoStyle={styles.video}
                              paused={false}
                              muted={true}
                              resizeMode="cover"
                              repeat={false}
                              disableFullscreen={true}
                                                  disablePlayPause={true}
                                                  disableSeekbar={true}
                                                  disableVolume={true}
                                                  disableTimer={true}
                                                  disableBack={true}
                                                  toggleResizeModeOnFullScreen={false}

                              tapAnywhereToPause={false} />
            <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
            <Icon
        name={muteIcon}
        size={24}
        color="white"
      />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </>
    );
  } else {
    return caption ? (
      <Text
        style={[styles.caption, { lineHeight: 21 }]}
        onTextLayout={onTextLayout}
        onPress={toggleNumberOfLines}
        numberOfLines={textShown ? undefined : 4}
      >
        {caption}
        {lengthMore ? (textShown ? ' Read less' : ' Read more') : null}
      </Text>
    ) : null;
  }
};

export default Body;
