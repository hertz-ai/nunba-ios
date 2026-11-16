import {useNavigation} from '@react-navigation/native';
import React, {useState} from 'react';
import {Image, View, Text, Pressable} from 'react-native';
import ProfilePicture from '../../ProfilePicture';
import styles from './styles';
// 2026-06-03: dropped react-native-video-controls (v5-era wrapper)
// in favor of plain Video from react-native-video v6.  The wrapper is
// unmaintained and its v5 API (disableFullscreen / disablePlayPause /
// disableSeekbar / disableVolume / disableTimer / disableBack /
// toggleResizeModeOnFullScreen / tapAnywhereToPause) doesn't survive
// v6's Media3 ExoPlayer internals.  The Stories rail tile only needs
// muted-looping playback with no UI chrome — plain Video is the right
// fit.
import Video from 'react-native-video';

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

// #416 fix: contentType comes in as 'image' or 'video' from
// server-authored stories, but seeded/legacy stories sometimes send
// 'photo' / 'movie' / undefined.  The pre-fix code only matched the
// two canonical strings and returned `undefined` for everything else,
// so React rendered nothing and the tile read as a blank black box.
// Live drive 2026-06-15 (Samsung S23) confirmed Naim's two seeded
// story tiles were rendering as empty rectangles.  Normalize the
// contentType then fall back to image render with a colored
// placeholder background so the rail never looks broken.
const isVideoType = (t) =>
  typeof t === 'string' && /(video|movie|mp4|webm|mov)/i.test(t);

const StoryCard = props => {
  const {story} = props;
  const {
    contentType,
    caption,
    resourceUri,
    user: {imageUri, username} = {},
  } = story || {};
  const navigation = useNavigation();
  const [imgFailed, setImgFailed] = useState(false);

  const onPress = () => {
    // StoryScreen iterates over route.params.stories as an array
    // (userStories[activeStoryIndex]), but we used to pass the single
    // story object directly — userStories[0] of an object is undefined
    // so the screen rendered an ActivityIndicator forever.  Wrap the
    // single story in an array so the viewer can advance through it.
    navigation.navigate('Story', {id: story?.id, stories: [story]});
  };

  if (!story) return null;

  const showVideo = isVideoType(contentType) && resourceUri;
  const showImage = !showVideo && !!resourceUri && !imgFailed;

  // Pressable instead of TouchableOpacity — TouchableOpacity inside a
  // horizontal FlatList eats single-tap events under some versions of
  // react-native-gesture-handler because the FlatList's pan recognizer
  // claims the touch before TouchableOpacity's onResponderRelease can
  // fire.  Pressable uses the newer responder system and survives the
  // gesture conflict.  Verified 2026-06-01 on Galaxy S23 Ultra — Yahia
  // story tile registered the tap but never navigated until this change.
  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
      android_ripple={{color: 'rgba(255,255,255,0.12)'}}
      accessibilityRole="button"
      accessibilityLabel={`Open story by ${username || 'user'}`}>
      {/* pointerEvents="none" on the inner View lets touches bubble up
          to the Pressable instead of the View capturing them.  Verified
          live on Galaxy S23 Ultra 2026-06-01 — with box-only the tap
          was absorbed and Pressable.onPress never fired. */}
      <View style={[styles.card, styles.cardFallbackBg]} pointerEvents="none">
        <Text style={styles.titleText}>
          {caption}{' '}
        </Text>
        {showVideo ? (
          // 2026-06-16: the Image variant has pointerEvents="none" but
          // the Video did NOT — after the styles.video fill change
          // (100% width/height + borderRadius), the Video element
          // started capturing the tap and the parent Pressable.onPress
          // never fired.  Explicit pointerEvents="none" lets the tap
          // bubble up to the Pressable wrapper.
          <Video
            source={{uri: resourceUri}}
            style={styles.video}
            paused={false}
            muted={true}
            resizeMode="cover"
            repeat={true}
            controls={false}
            ignoreSilentSwitch="ignore"
            pointerEvents="none"
          />
        ) : showImage ? (
          <Image
            source={{uri: resourceUri}}
            style={styles.image}
            pointerEvents="none"
            onError={() => setImgFailed(true)}
          />
        ) : (
          // Last-resort placeholder so the tile is never empty.  Big
          // glyph + first letter of username — same pattern used by
          // the AvatarBadged primitive elsewhere in the app.
          <View style={styles.placeholderWrap} pointerEvents="none">
            <Text style={styles.placeholderInitial}>
              {(username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <ProfilePicture uri={imageUri} />
      <Text style={styles.description}>{username}</Text>
    </Pressable>
  );
};

export default StoryCard;
