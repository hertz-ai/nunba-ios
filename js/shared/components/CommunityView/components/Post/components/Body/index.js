import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Image, Text, View, TouchableOpacity, NativeModules, Dimensions, DeviceEventEmitter } from 'react-native';
import styles from './styles';
import useThemeStore from '../../../../../../colorThemeZustand';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DoubleTapToLike from './DoubleTapToLike';

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

  // UX-AUDIT 2026-05-18 Pass X.P2: wrap the image post in
  // DoubleTapToLike so a double-tap registers an upvote (mirrors the
  // Footer's like button + Instagram's iconic interaction).  We don't
  // own the like state here — Footer does — so we emit a
  // DeviceEvent that Footer subscribes to.  Idempotency check in
  // DoubleTapToLike + voteState check in Footer prevents
  // double-vote storms.
  const handleDoubleTapLike = useCallback(() => {
    const postId = userData?.id;
    if (!postId) return;
    DeviceEventEmitter.emit('PostDoubleTapLike', { postId });
  }, [userData?.id]);

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
        <DoubleTapToLike liked={false} onLike={handleDoubleTapLike}>
          <TouchableOpacity onPress={navigateToCommentsList}>
            <Image source={{ uri: resourceUri }} style={styles.image} />
          </TouchableOpacity>
        </DoubleTapToLike>
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
