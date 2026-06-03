import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Image, Text, View, TouchableOpacity, NativeModules, Dimensions, DeviceEventEmitter } from 'react-native';
import styles from './styles';
import useThemeStore from '../../../../../../colorThemeZustand';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DoubleTapToLike from './DoubleTapToLike';
import { prefetch as prefetchImage } from '../../../../../../services/imageCache';
import MediaCacheManager from '../../../KidsLearning/shared/MediaCacheManager';
import RNFetchBlob from 'rn-fetch-blob';

import { useNavigation } from '@react-navigation/native';
const { OnboardingModule } = NativeModules;
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
// Use plain react-native-video instead of react-native-video-controls.
// The controls wrapper renders a hardcoded "Video unavailable" text +
// error icon when the source fails to load — user reported seeing that
// overlay on broken video URLs (2026-06-02).  Plain Video has no built-in
// error UI; we silently hide the post via videoErrored state.
import Video from 'react-native-video';
const Body = ({ resourceUri, contentType, caption, userData }) => {
  const navigation = useNavigation();
  const [textShown, setTextShown] = useState(false);
  const [lengthMore, setLengthMore] = useState(false);
  const { theme } = useThemeStore();
  const [userId, setUserId] = useState();
  const [muted, setMuted] = useState(true);
  const [videoErrored, setVideoErrored] = useState(false);
  // Polish round 4 perf 2026-06-03: video source flips to a
  // file:// URI as soon as MediaCacheManager.get returns a cached
  // copy.  Network URI is used on the first paint; the cache
  // download runs in the background so the NEXT row mount of this
  // URL is instant.  User feedback rejected the tap-to-play
  // approach: "if it was cached it shd have been immediately
  // visible the thumbnails isn't".  Auto-play stays on, the
  // re-download problem is solved by the local file swap on
  // re-mount.
  // 2026-06-03 polish round 4 perf: always start with the network URI
  // and let the async effect below swap to file:// after verifying the
  // cached file exists.  Initial attempt did a sync get() in useState
  // but that returned stale/partial paths from earlier install cycles
  // (live: "MediaPlayer: Error setting data source via ContentResolver"
  // on first paint).  Cache hit is verified by RNFetchBlob.fs.exists()
  // before swap so we never hand a half-written file to MediaPlayer.
  const [videoSource, setVideoSource] = useState(
    contentType === 'video' && resourceUri ? { uri: resourceUri } : null,
  );

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

  // Polish round 3 perf 2026-06-03: warm the Glide cache so when this
  // row recycles off-screen + comes back, the <Image> re-mount hits a
  // cached bitmap instead of re-downloading.  Same root cause we just
  // fixed for video; <Image> on Android also has no disk cache by
  // default and FlatList row recycle re-downloads on every paint.
  useEffect(() => {
    if (resourceUri && (contentType === 'image')) prefetchImage(resourceUri);
  }, [resourceUri, contentType]);

  // Polish round 4 perf 2026-06-03: video disk cache via
  // MediaCacheManager (rn-fetch-blob, 200MB LRU, 7-day TTL).  On
  // mount, check cache: if cached, swap to file:// URI (instant
  // playback on re-mount).  If not cached, kick off background
  // download — next mount of the same URL hits the cache.  Pairs
  // with react-native-video v6 (ExoPlayer) for production-grade
  // playback.  Replaces the v3-era tap-to-play band-aid.
  useEffect(() => {
    if (contentType !== 'video' || !resourceUri) return;
    let cancelled = false;
    (async () => {
      try {
        await MediaCacheManager.init();
        const cached = MediaCacheManager.get('video', { url: resourceUri });
        if (cached) {
          // Verify the file actually exists + has data before swapping.
          // The cache index can be stale (entry survived an interrupted
          // download; previous app version was uninstalled but cache
          // dir survived; etc.).  RNFetchBlob.fs.stat returns the size
          // synchronously enough for our purposes — empty / missing
          // files stay on the network URI so MediaPlayer never sees a
          // half-written file.
          try {
            const stat = await RNFetchBlob.fs.stat(cached);
            if (!cancelled && stat && Number(stat.size) > 0) {
              setVideoSource((prev) =>
                prev?.uri?.startsWith('file://') ? prev : { uri: `file://${cached}` },
              );
              return;
            }
          } catch (_) {
            // File missing → treat as cache miss
          }
        }
        // Cache miss or stale entry — kick off background download for
        // the NEXT visit, current playback uses the network URI.
        MediaCacheManager.download('video', { url: resourceUri }, resourceUri)
          .catch(() => {});
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [resourceUri, contentType]);

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
        {videoErrored || !videoSource ? null : (
          <TouchableOpacity onPress={navigateToCommentsList} activeOpacity={0.95}>
            <View style={containervideo}>
              <Video
                source={videoSource}
                style={styles.video}
                paused={false}
                muted={muted}
                resizeMode="cover"
                repeat={false}
                onError={() => setVideoErrored(true)}
                ignoreSilentSwitch="ignore"
              />
              <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
                <Icon name={muteIcon} size={24} color="white" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
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

// Polish round 3 perf 2026-06-03: React.memo on Body so a parent
// re-render (Footer like state change, new comment count) doesn't
// re-render every visible post in the feed.  Default shallow-equal
// fits because resourceUri / contentType / caption are primitives
// and userData object identity is stable per-post.
export default React.memo(Body);
