import React, {useState, useEffect, useRef, useMemo} from 'react';
import {
  Text,
  ActivityIndicator,
  ImageBackground,
  Image,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Dimensions,
  View,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// 2026-06-03: dropped react-native-video-controls (v5-era wrapper).
// See StoryCard for the longer note — same v6 compat reason here.
import Video from 'react-native-video';
import styles from './styles';

// Instagram-style segmented progress bar.  One thin bar per story
// segment, all rendered at the top.  Each renders gray; the active
// one animates from 0→100% over the segment's duration, completed
// ones stay 100%.
const STORY_DURATION_MS = 6000;
const ProgressBars = ({count, activeIndex, progress}) => {
  return (
    <View style={overlayStyles.progressRow} pointerEvents="none">
      {Array.from({length: count}).map((_, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        const widthInterp = isActive
          ? progress.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']})
          : isDone ? '100%' : '0%';
        return (
          <View key={i} style={overlayStyles.progressTrack}>
            <Animated.View
              style={[overlayStyles.progressFill, {width: widthInterp}]}
            />
          </View>
        );
      })}
    </View>
  );
};

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
  // #410 v3 (2026-06-16): user-reported the prior pass STILL clipped the
  // video bottom + didn't fully fill height.  Root cause: `Dimensions
  // .get('window')` returns the window area which EXCLUDES the status
  // bar height AND the gesture-bar inset — even after `setHidden(true)`
  // the JS-side cached values aren't recomputed until next orientation
  // change.  Switch to `screen` (true pixel dims) so absolute-position
  // covers the device edge-to-edge regardless of system bar state.
  const {width: WIN_W, height: WIN_H} = Dimensions.get('screen');

  const userStories = (route.params && route.params.stories) || [];
  const activeStory = userStories[activeStoryIndex];
  const progress = useRef(new Animated.Value(0)).current;

  // #410-followup fix: hide status bar so story is true full-bleed.
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => StatusBar.setHidden(false, 'fade');
  }, []);

  // Drive the active segment's progress bar from 0→1 over
  // STORY_DURATION_MS.  When it reaches 1, advance to next story.
  useEffect(() => {
    progress.setValue(0);
    if (!activeStory) return undefined;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS,
      useNativeDriver: false,
    });
    animation.start(({finished}) => {
      if (finished) {
        // advance
        if (activeStoryIndex >= userStories.length - 1) {
          try { navigation.goBack(); } catch (_e) {}
        } else {
          setActiveStoryIndex(activeStoryIndex + 1);
        }
      }
    });
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoryIndex, activeStory?.id]);

  useEffect(() => {
    if (!userStories.length) {
      try { navigation.goBack(); } catch (_e) {}
    }
  }, [userStories.length, navigation]);

  if (!activeStory) {
    return (
      <View style={[styles.container, {alignItems: 'center', justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
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

  // Explicit window-sized media so video fills edge-to-edge regardless
  // of how the surrounding container is laid out (some navigators wrap
  // the screen in a SafeAreaView at the navigator level which would
  // otherwise shorten the visible area).
  const mediaStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WIN_W,
    height: WIN_H,
  };

  // User info for the top-left header pill — falls back gracefully
  // when the story payload lacks user.imageUri or user.username.
  const author = activeStory.user || {};
  const authorName = author.username || author.name || 'user';
  const timeLabel = activeStory.timeAgo || activeStory.created_at_human || '';
  const authorAvatar = author.imageUri || author.avatar_url;

  return (
    <View style={{flex: 1, backgroundColor: '#000'}}>
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={{flex: 1, backgroundColor: '#000'}}>
          {isVideo ? (
            <Video
              source={{uri: mediaUri}}
              style={mediaStyle}
              paused={false}
              muted={false}
              resizeMode="cover"
              repeat={false}
              controls={false}
              ignoreSilentSwitch="ignore"
              onEnd={goNext}
            />
          ) : (
            <ImageBackground source={{uri: mediaUri}} style={mediaStyle} resizeMode="cover">
              {caption ? (
                <Text style={{color: '#fff', fontSize: 18, padding: 16, marginTop: 60}}>
                  {caption}
                </Text>
              ) : null}
            </ImageBackground>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Instagram-style overlays (2026-06-16): segmented progress bars
          at top, author info pill on the upper-left, close (X) button
          on the upper-right.  The overlays sit ABOVE the
          TouchableWithoutFeedback that handles next/prev taps; the X
          button has its own TouchableOpacity so it intercepts the tap
          without bubbling to the prev/next handler. */}
      <View style={overlayStyles.topRow} pointerEvents="box-none">
        <ProgressBars
          count={userStories.length}
          activeIndex={activeStoryIndex}
          progress={progress}
        />
        <View style={overlayStyles.authorRow} pointerEvents="box-none">
          <View style={overlayStyles.authorLeft} pointerEvents="none">
            {authorAvatar ? (
              <Image source={{uri: authorAvatar}} style={overlayStyles.avatar} />
            ) : (
              <View style={overlayStyles.avatarFallback}>
                <Text style={overlayStyles.avatarInitial}>
                  {(authorName.charAt(0) || '?').toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={overlayStyles.username} numberOfLines={1}>
              {authorName}
            </Text>
            {timeLabel ? (
              <Text style={overlayStyles.timeAgo} numberOfLines={1}>
                {timeLabel}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => { try { navigation.goBack(); } catch (_e) {} }}
            style={overlayStyles.closeBtn}
            hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
            accessibilityRole="button"
            accessibilityLabel="Close story">
            <Icon name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Instagram-style overlay styles.  Plain object — small enough that
// a separate styles.js file isn't worth the indirection.
const overlayStyles = {
  topRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 44 : 18,
    paddingHorizontal: 8,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  authorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#222',
    marginRight: 10,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6C63FF',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    flexShrink: 1,
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    flexShrink: 0,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
};

export default StoryScreen;
