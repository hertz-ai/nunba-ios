import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Image,View, Text, TouchableOpacity} from 'react-native';
import ProfilePicture from '../../ProfilePicture';
import styles from './styles';
import VideoPlayer from 'react-native-video-controls';

const StoryCard = props => {
  const {
    story: {
      id,
      contentType,
      caption,
      resourceUri,
      user: {imageUri, username}
    },
  } = props;
  const navigation = useNavigation();

  const onPress = () => {
    navigation.navigate('Story', {id: story.id, stories: story});
  };


   if (contentType === 'image') {
      return (
      <TouchableOpacity
            onPress={onPress}
            style={styles.container}
            activeOpacity={0.9}>
            <View style={styles.card}>
              <Text style={styles.titleText}>{caption}{' '}</Text>
              <Image source={{uri: resourceUri}} style={styles.image} />
            </View>
            <ProfilePicture uri={imageUri} />
            <Text style={styles.description}>{username}</Text>
          </TouchableOpacity>

      );
    } else if (contentType === 'video') {
      return (
      <TouchableOpacity
                  onPress={onPress}
                  style={styles.container}
                  activeOpacity={0.9}>
                  <View style={styles.card}>
                    <Text style={styles.titleText}>{caption}{' '}</Text>
                    <VideoPlayer
                    source={{uri: resourceUri}}
                    videoStyle={styles.video}
                    paused={false}
                    muted={true}
                    resizeMode="cover"
                    repeat={true}
                    disableFullscreen={true}
                                        disablePlayPause={true}
                                        disableSeekbar={true}
                                        disableVolume={true}
                                        disableTimer={true}
                                        disableBack={true}
                                        toggleResizeModeOnFullScreen={false}

                    tapAnywhereToPause={false} />
                  </View>
                  <ProfilePicture uri={imageUri} />
                  <Text style={styles.description}>{username}</Text>
                </TouchableOpacity>

      );
    }
};

export default StoryCard;
