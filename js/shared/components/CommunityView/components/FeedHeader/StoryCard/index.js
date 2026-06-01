import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Image,View, Text, TouchableOpacity} from 'react-native';
import ProfilePicture from '../../ProfilePicture';
import styles from './styles';
import VideoPlayer from 'react-native-video-controls';

// UX-AUDIT 2026-05-19: the Pass X.P1 StoryRing wrap (committed
// 2026-05-18) was geometrically wrong for this layout — the avatar
// sits at top:-40 ABOVE the card and the parent rail clips the top
// hemisphere of the ring, leaving only the bottom half visible as a
// thick red arc on the card.  The StoryRing primitive itself is fine
// (it's tested in __tests__/shared/StoryRing.test.js) but it needs to
// be applied to a layout that gives it room to render as a full ring
// around an avatar (Instagram-style — avatar centered inside a tile
// with the ring outside the avatar but inside the tile bounds).  Until
// that layout exists, restore the original bare ProfilePicture so the
// Stories rail looks correct.
const StoryCard = props => {
  const {story} = props;
  const {
    contentType,
    caption,
    resourceUri,
    user: {imageUri, username}
  } = story;
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
