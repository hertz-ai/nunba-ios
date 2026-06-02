import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Image,View, Text, Pressable} from 'react-native';
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
    // StoryScreen iterates over route.params.stories as an array
    // (userStories[activeStoryIndex]), but we used to pass the single
    // story object directly — userStories[0] of an object is undefined
    // so the screen rendered an ActivityIndicator forever.  Wrap the
    // single story in an array so the viewer can advance through it.
    navigation.navigate('Story', {id: story.id, stories: [story]});
  };

  // Pressable instead of TouchableOpacity — TouchableOpacity inside a
  // horizontal FlatList eats single-tap events under some versions of
  // react-native-gesture-handler because the FlatList's pan recognizer
  // claims the touch before TouchableOpacity's onResponderRelease can
  // fire.  Pressable uses the newer responder system and survives the
  // gesture conflict.  Verified 2026-06-01 on Galaxy S23 Ultra — Yahia
  // story tile registered the tap but never navigated until this change.
   if (contentType === 'image') {
      return (
      <Pressable
            onPress={onPress}
            style={styles.container}
            android_ripple={{color: 'rgba(255,255,255,0.12)'}}>
            <View style={styles.card}>
              <Text style={styles.titleText}>{caption}{' '}</Text>
              <Image source={{uri: resourceUri}} style={styles.image} pointerEvents="none" />
            </View>
            <ProfilePicture uri={imageUri} />
            <Text style={styles.description}>{username}</Text>
          </Pressable>

      );
    } else if (contentType === 'video') {
      return (
      <Pressable
                  onPress={onPress}
                  style={styles.container}
                  android_ripple={{color: 'rgba(255,255,255,0.12)'}}>
                  {/* pointerEvents="none" on the inner View lets touches
                      bubble up to the Pressable instead of the View
                      capturing them.  Verified live on Galaxy S23 Ultra
                      2026-06-01 — with box-only the tap was absorbed
                      by the View and Pressable.onPress never fired,
                      so the Story tile felt dead. */}
                  <View style={styles.card} pointerEvents="none">
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
                </Pressable>

      );
    }
};

export default StoryCard;
