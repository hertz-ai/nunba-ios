import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Image,View, Text, TouchableOpacity} from 'react-native';
import ProfilePicture from '../../ProfilePicture';
import StoryRing from '../../../../shared/StoryRing';
import styles from './styles';
import VideoPlayer from 'react-native-video-controls';

const StoryCard = props => {
  const {story} = props;
  const {
    contentType,
    caption,
    resourceUri,
    viewed,
    user: {imageUri, username}
  } = story;
  const navigation = useNavigation();

  const onPress = () => {
    navigation.navigate('Story', {id: story.id, stories: story});
  };

  // UX-AUDIT 2026-05-18 Pass X.P1: wrap the story's avatar in a
  // StoryRing so unviewed stories carry the rainbow ring (gray once
  // viewed).  ProfilePicture's default position is `absolute, top:-40`
  // which overlaps the card; we keep that overall behaviour by
  // wrapping the ring in an absolutely-positioned container and
  // switching the inner ProfilePicture to position:relative so it
  // sits inside the ring instead of pulling itself out of flow.
  const renderRingedAvatar = () => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -46,
        alignSelf: 'center',
        zIndex: 5,
        alignItems: 'center',
      }}
      testID="StoryCard.ringedAvatar"
    >
      <StoryRing hasStory viewed={!!viewed} size={80}>
        <ProfilePicture
          uri={imageUri}
          size={80}
          position="relative"
          top={0}
          elevation={0}
        />
      </StoryRing>
    </View>
  );


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
            {renderRingedAvatar()}
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
                  {renderRingedAvatar()}
                  <Text style={styles.description}>{username}</Text>
                </TouchableOpacity>

      );
    }
};

export default StoryCard;
