import React, { useState, useEffect, useRef } from 'react';
import { FlatList, View, Text, DeviceEventEmitter, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import StoryCard from '../StoryCard';
import styles from './styles';
import StoriesData from '../../../data/stories';
import useThemeStore from '../../../../../colorThemeZustand';
import { prefetchMany } from '../../../../../services/imageCache';

// "Your story +" invite tile pinned to the start of the Stories rail.
// Instagram-style entry point: when the user has nothing to share yet,
// or has plenty to share, the first slot is always a CTA to post.
// Polish round 2 2026-06-03: Gen-Z appeal — rail without an add CTA
// reads like a read-only news widget; adding it makes the rail feel
// social-first.
const AddStoryTile = () => {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => {
        try { navigation.navigate('AddPost', { isStory: true }); } catch (_) {}
      }}
      style={styles.addContainer}
      accessibilityRole="button"
      accessibilityLabel="Add your story"
      android_ripple={{ color: 'rgba(108, 99, 255, 0.18)' }}
    >
      <View style={styles.addCard}>
        <View style={styles.addIconWrap}>
          <Icon name="plus" size={28} color="#FFFFFF" />
        </View>
        <Text style={styles.addLabel}>Your story</Text>
      </View>
    </Pressable>
  );
};

const Stories = () => {
  const { theme } = useThemeStore();

  // Initialize the map from the static StoriesData
  const initialMap = new Map(StoriesData.map(item => [item.id, item]));
  const [postsMap, setPostsMap] = useState(initialMap);

  // Register the AddPostKey listener ONCE on mount. Previously this
  // useEffect had `[postsMap]` as dep — every story arrival re-registered
  // the listener, causing duplicate event handling and visible flicker.
  // The `has(id)` dedup check is moved into the setPostsMap functional
  // updater so it reads the live map without needing the dep.
  useEffect(() => {
    const broadcastReceiver = intent => {
      let parsedIntentData;
      try {
        parsedIntentData = JSON.parse(intent.AddPostKey);
      } catch (err) {
        return;
      }
      if (
        !parsedIntentData ||
        !parsedIntentData.contentType ||
        !parsedIntentData.isStory ||
        !parsedIntentData.resourceUri ||
        !parsedIntentData.resourceUri.startsWith('http') ||
        !(parsedIntentData.contentType.includes('image') ||
          parsedIntentData.contentType.includes('video'))
      ) {
        return;
      }
      setPostsMap(prev => {
        if (prev.has(parsedIntentData.id)) return prev;
        return new Map([
          [parsedIntentData.id, parsedIntentData],
          ...prev,
        ]);
      });
    };
    const subscription = DeviceEventEmitter.addListener(
      'AddPostKey',
      broadcastReceiver,
    );
    return () => subscription.remove();
  }, []);

  // Theme-based styles
  const containerStyle = {
    ...styles.container,
    borderBottomColor: theme === 'dark' ? '#0E1114' : '#FFFFFF',
    backgroundColor: theme === 'dark' ? '#0E1114' : '#FFFFFF',
  };

  const Recommended = {
    ...styles.textR,
    color: theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
  };

  const horizontal = {
    ...styles.hr,
    borderBottomColor: theme === 'dark' ? '#0E1114' : '',
  };

  // Sort posts descending by ID
  const data = Array.from(postsMap.values()).sort((a, b) => b.id - a.id);

  // Polish round 3 perf 2026-06-03: prefetch every story poster +
  // author avatar so tap-to-open feels instant.  Fire-and-forget;
  // imageCache dedupes via a Set so this is cheap on re-renders.
  useEffect(() => {
    const uris = [];
    for (const item of data) {
      if (item.resourceUri) uris.push(item.resourceUri);
      if (item.profilePic) uris.push(item.profilePic);
      if (item.imageUri) uris.push(item.imageUri);
    }
    prefetchMany(uris);
  }, [data.length]);

  // UX-AUDIT 2026-05-18 Pass X.P1: "Recommended for you" misnames the
  // moment — this rail shows stories (ephemeral, time-sensitive), not
  // recommendations.  Renamed to "Stories".
  // Polish round 2 2026-06-03: rail now ALWAYS renders so the
  // "Your story +" CTA at the start is always visible — even when
  // no other stories exist.  An empty rail with just the invite tile
  // is the gen-Z pattern (Instagram / BeReal / Snap).
  return (
    <View style={containerStyle} testID="StoriesRail">
      <Text style={Recommended}>STORIES</Text>
      <FlatList
        data={data}
        renderItem={({ item }) => <StoryCard story={item} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id.toString()}
        style={styles.list}
        ListHeaderComponent={<AddStoryTile />}
      />
      <View style={horizontal} />
    </View>
  );
};

export default Stories;
