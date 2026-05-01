import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NativeModules, FlatList, DeviceEventEmitter, Animated, StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import Post from '../Post';
import FeedHeader from '../FeedHeader';
import useThemeStore from '../../../../colorThemeZustand';
import { useNavigation } from '@react-navigation/native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { colors, borderRadius, shadows, fontSize, fontWeight, spacing } from '../../../../theme/colors';
import _ from 'lodash';
const Feed = () => {
  const initialState = [];
  const initialMap = new Map(initialState.map(item => [item.id, item]));
  const [postsMap, setPostsMap] = useState(initialMap);
  const [pageNumber, setPageNumber] = useState(1);
  const { OnboardingModule } = NativeModules;
  const { theme, setTheme } = useThemeStore();
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const navigation = useNavigation();
  const translateY = useRef(new Animated.Value(500)).current;
  const [postUserID, setPostUserId] = useState();
  

  const fetchPosts = useCallback((page) => {
    OnboardingModule.getAllPosts(10, page);
  }, [OnboardingModule]);

  useEffect(() => {
    const broadcastReceiver = (intent) => {
      try {
        const parsedIntentData = JSON.parse(intent.AddPostKey);
        if (!postsMap.has(parsedIntentData.id)) {
          setPostsMap((prevPostsMap) => {
            const updatedPostsMap = new Map(prevPostsMap);
            updatedPostsMap.set(parsedIntentData.id, parsedIntentData);
            return updatedPostsMap;
          });
        }
      } catch (error) {
        OnboardingModule.getTheme((fetchedTheme) => {
          setTheme(fetchedTheme);
          console.log('Theme received and set via receiver:', fetchedTheme);
        });
        console.error('Error parsing AddPostKey intent:', error);
      }
    };

    const addPostSub = DeviceEventEmitter.addListener('AddPostKey', broadcastReceiver);
    const postAddedSub = DeviceEventEmitter.addListener('PostAdded', () => {
      setPageNumber(1);
      fetchPosts(1);
    });

    return () => {
      addPostSub?.remove?.();
      postAddedSub?.remove?.();
    };
  }, [postsMap, fetchPosts]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        OnboardingModule.getUser_id((userId) => {
          setUserId(userId);
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  const getTheme = useCallback(() => {
    OnboardingModule.getTheme((fetchedTheme) => {
      if (theme !== fetchedTheme) {
        setTheme(fetchedTheme);
        console.log('Theme received and set:', fetchedTheme);
      } else {
        console.log('Fetched theme is the same as current theme, no update needed.');
      }
    });
  }, [theme, setTheme, OnboardingModule]);

  const toggleBottomSheet = (post) => {
    setSelectedPost(post);
    setPostUserId(post.userID);
    setIsBottomSheetOpen(!isBottomSheetOpen)
  };
 
  const closeBottomSheet = () => {
    Animated.timing(translateY, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsBottomSheetOpen(false);
    });
  };

  useEffect(() => {
    getTheme();
    fetchPosts(pageNumber);
  }, [fetchPosts, getTheme]);

  useEffect(() => {
    if (pageNumber > 1) {
      fetchPosts(pageNumber);
    }
  }, [pageNumber]);

  const loadMorePosts = useCallback(() => {
    setPageNumber(prevPageNumber => prevPageNumber + 1);
  }, []);

  const deletePost = (postId, reason) => {
    OnboardingModule.deletePost(postId, reason);
    closeBottomSheet();
    setPostsMap(prevPostsMap => {
      const updatedPostsMap = new Map(prevPostsMap);
      updatedPostsMap.delete(postId);
      return updatedPostsMap;
    });
  };

  const deletePostHandler = () => {
    if (selectedPost) {
      closeBottomSheet();
      deletePost(selectedPost.id, null);
    }

  };

  const navigateToReportScreen = () => {
    if (selectedPost) {
      navigation.navigate('Report', { post_id: String(selectedPost.id), deletePost });
      closeBottomSheet();
    }
  };
  const blockUser = async () => {
    setIsBottomSheetOpen(false)

    const url = 'https://mailer.hertzai.com/block_user';
    const payload = {
      user_id: userId,
      block_user_id: selectedPost.userID,
      type_of_activity: 'Block',
      scope: 'Post'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseJson = await response.json();
     // console.log(responseJson, 'this id block');
      setPageNumber(1);  
      fetchPosts(1); 
     
    


    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to block user');
    }
  };



  const data = Array.from(postsMap.values()).sort((a, b) => b.id - a.id)
  return (
    <>
      <FlatList
        data={data}
        renderItem={({ item }) => <Post openBottomSheet={() => toggleBottomSheet(item)} post={item} deletePost={deletePost}  />}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={<FeedHeader />}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.7}
      />
      {isBottomSheetOpen && <Animated.View style={[styles.bottomSheet]}>
        {selectedPost && (userId === 1 || userId === 10202 || userId === Number(String(postUserID).split("'").join(''))) && (
          <TouchableOpacity onPress={deletePostHandler} style={styles.dropdownOption}>
            <Text style={styles.dropdownOptionText}>Delete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={navigateToReportScreen} style={styles.dropdownOption}>
          <Text style={styles.dropdownOptionText}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={blockUser} style={styles.dropdownOption}>
          <Text style={styles.dropdownOptionText}>Block User</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={navigateToReportScreen} style={styles.dropdownOption}>
          <Text style={styles.dropdownOptionText}>Block post</Text>
        </TouchableOpacity>
      </Animated.View>}
    </>
  );
};

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.md,
    minHeight: 200,
    maxHeight: 800,
    zIndex: 10,
    ...shadows.lg,
  },
  dropdownOption: {
    display: 'flex',
    margin: hp('1%'),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('1%'),
    paddingVertical: hp('1%'),
  },
  dropdownOptionText: {
    fontSize: fontSize.md,
    textAlign: 'center',
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
});

export default Feed;
