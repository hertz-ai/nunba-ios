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

// UX-AUDIT 2026-05-20 REDESIGN-R3: NunbaHero discoverability.
// Previously the NunbaHero card was only reachable by drilling into
// the Inbox tab — 2-3 hops from app launch. Material-first design
// surfaces the primary action via a FAB anchored to the home Feed
// itself. Tapping the FAB navigates to the same ConversationHistory
// route the InboxScreen header uses, so there is exactly ONE path
// to the morphable Nunba agent (no parallel route).
// 200ms tap debounce — prevents double-fire when the tap lands on the
// edge of the FAB during a list-scroll deceleration. Without it, fast
// taps were navigating twice and stacking duplicate ConversationHistory
// screens on the navigation stack.
const NunbaFab = ({ onPress }) => {
  const lastTapRef = useRef(0);
  const handle = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 250) return;
    lastTapRef.current = now;
    onPress && onPress();
  }, [onPress]);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Open chat with Nunba"
      accessibilityHint="Opens your default chat — the agent morphs to match what you need"
      onPress={handle}
      activeOpacity={0.85}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={fabStyles.fab}
      testID="NunbaFab"
    >
      <View style={fabStyles.fabInner}>
        <Text style={fabStyles.fabMark}>N</Text>
      </View>
    </TouchableOpacity>
  );
};

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

  // R3 — opens the same ConversationHistory route the InboxScreen
  // NunbaHeroCard uses. Same destination, surfaced higher in the
  // navigation tree.
  const openNunba = () => {
    try {
      navigation.navigate('ConversationHistory', {
        conversation_id: 'nunba',
        agent: 'nunba',
        kind: 'agent',
        peer: { name: 'Nunba', handle: 'nunba', is_agent: true },
      });
    } catch (_) { /* silent — route may not be registered in older builds */ }
  };

  return (
    <>
      <FlatList
        data={data}
        renderItem={({ item }) => <Post openBottomSheet={() => toggleBottomSheet(item)} post={item} deletePost={deletePost}  />}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={<FeedHeader />}
        // 170 = NunbaFab (60) + bottom: 90 + 20 breathing room.
        // Without this, the last post hides behind the FAB / Java
        // bottom-nav on tablet landscape and portrait alike.
        contentContainerStyle={{ paddingBottom: 170 }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.7}
      />
      <NunbaFab onPress={openNunba} />
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

// R3 — FAB sits above the bottom-nav (which lives in the parent
// BottomNavigationActivity) so the touch target never overlaps a
// system gesture inset.
const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    // bottom was 24 — clipped half-behind the Java bottom-nav strip
    // because the React Feed sits ABOVE that strip. 90 clears the
    // 56dp Material bottom-nav + the gesture-handle safe area on
    // tablets, while keeping the FAB comfortably in the visible feed
    // area. User-reported 2026-06-03: "chat history half assed
    // half visible button".
    bottom: 90,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent || '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    // zIndex bumped to 100 so the FAB renders above the feed FlatList
    // and any post-card overlays without exception.
    zIndex: 100,
  },
  fabInner: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  fabMark: {
    color: '#0E1114',
    fontSize: 26,
    fontWeight: '800',
  },
});

export default Feed;
