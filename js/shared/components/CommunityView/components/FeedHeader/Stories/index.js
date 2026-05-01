import React, { useState, useEffect, useRef } from 'react';
import { FlatList, View, Text, DeviceEventEmitter } from 'react-native';
import StoryCard from '../StoryCard';
import styles from './styles';
import StoriesData from '../../../data/stories';
import useThemeStore from '../../../../../colorThemeZustand';

const Stories = () => {
  const { theme } = useThemeStore();

  // Initialize the map from the static StoriesData
  const initialMap = new Map(StoriesData.map(item => [item.id, item]));
  const [postsMap, setPostsMap] = useState(initialMap);

  useEffect(() => {
    const broadcastReceiver = intent => {
      console.log('Event received:', intent);

      // Safely parse event data
      let parsedIntentData;
      try {
        parsedIntentData = JSON.parse(intent.AddPostKey);
      } catch (err) {
        console.warn('Invalid AddPostKey data:', err);
        return;
      }

      // Validation checks before adding to map
      if (
        parsedIntentData &&
        !postsMap.has(parsedIntentData.id) &&
        parsedIntentData.contentType &&
        (parsedIntentData.contentType.includes('image') ||
          parsedIntentData.contentType.includes('video')) &&
        parsedIntentData.isStory &&
        parsedIntentData.resourceUri &&
        parsedIntentData.resourceUri.startsWith('http')
      ) {
        setPostsMap(prevPostsMap => {
          const updatedPostsMap = new Map([
            [parsedIntentData.id, parsedIntentData],
            ...prevPostsMap,
          ]);
          return updatedPostsMap;
        });
      }
    };

    console.log('Adding event listener');
    const subscription = DeviceEventEmitter.addListener(
      'AddPostKey',
      broadcastReceiver,
    );

    // ✅ Correct cleanup for modern React Native
    return () => {
      console.log('Removing event listener');
      subscription.remove();
    };
  }, [postsMap]);

  // Theme-based styles
  const containerStyle = {
    ...styles.container,
    borderBottomColor: theme === 'dark' ? '#0E1114' : '#FFFFFF',
    backgroundColor: theme === 'dark' ? '#0E1114' : '#FFFFFF',
  };

  const Recommended = {
    ...styles.textR,
    color: theme === 'dark' ? '#fff' : 'black',
  };

  const horizontal = {
    ...styles.hr,
    borderBottomColor: theme === 'dark' ? '#0E1114' : '',
  };

  // Sort posts descending by ID
  const data = Array.from(postsMap.values()).sort((a, b) => b.id - a.id);

  return (
    <View style={containerStyle}>
      <Text style={Recommended}>Recommended for you</Text>
      <FlatList
        data={data}
        renderItem={({ item }) => <StoryCard story={item} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id.toString()}
        style={styles.list}
      />
      <View style={horizontal} />
    </View>
  );
};

export default Stories;
