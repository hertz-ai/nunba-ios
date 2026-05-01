import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator, Alert, Animated,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usersApi } from '../../../services/socialApi';
import ContextBridge from '../components/ContextBridge';
import usePressAnimation from '../../../hooks/usePressAnimation';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { onPressIn, onPressOut, animatedStyle: pressStyle } = usePressAnimation(0.96);
  const { userId, isOwnProfile } = route.params || {};
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const expCtx = null;
  const resonanceCtx = null;
  const achCtx = null;

  const fetchData = useCallback(async () => {
    try {
      const [userRes, postsRes] = await Promise.all([
        usersApi.get(userId),
        usersApi.posts(userId, { limit: 20 }),
      ]);
      setUser(userRes.data || null);
      setPosts(postsRes.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (user) {
      setEditName(user.display_name || '');
      setEditBio(user.bio || '');
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleSaveProfile = async () => {
    try {
      await usersApi.update(userId, { display_name: editName, bio: editBio });
      setUser(prev => ({ ...prev, display_name: editName, bio: editBio }));
      setEditing(false);
    } catch (err) {
      Alert.alert('Error', err.error || 'Failed to update profile');
    }
  };

  const handleFollow = async () => {
    try {
      if (user.is_following) {
        await usersApi.unfollow(userId);
        setUser(prev => ({ ...prev, is_following: false, follower_count: Math.max(0, (prev.follower_count || 1) - 1) }));
      } else {
        await usersApi.follow(userId);
        setUser(prev => ({ ...prev, is_following: true, follower_count: (prev.follower_count || 0) + 1 }));
      }
    } catch {
      // silent
    }
  };

  const renderPost = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <TouchableOpacity
        style={styles.postCard}
        activeOpacity={0.7}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Animated.View style={pressStyle}>
          <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
          <View style={styles.postFooter}>
            <View style={styles.postStat}>
              <Ionicons name="arrow-up" size={14} color="#888" />
              <Text style={styles.postStatText}>{item.upvotes || 0}</Text>
            </View>
            <View style={styles.postStat}>
              <Ionicons name="chatbubble-outline" size={14} color="#888" />
              <Text style={styles.postStatText}>{item.comment_count || 0}</Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderHeader = () => {
    if (!user) return null;
    return (
      <Animatable.View animation="fadeIn">
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{(user.display_name || 'U')[0].toUpperCase()}</Text>
          </View>

          {editing ? (
            <View style={styles.editSection}>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Display name"
                placeholderTextColor="#666"
              />
              <TextInput
                style={[styles.editInput, { height: hp('10%') }]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Bio"
                placeholderTextColor="#666"
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.displayName}>{user.display_name || user.username}</Text>
              <Text style={styles.username}>@{user.username}</Text>
              {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{user.karma || 0}</Text>
                  <Text style={styles.statLabel}>Karma</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{user.follower_count || 0}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{user.following_count || 0}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>

              {/* Context bridges for own profile */}
              {isOwnProfile && (
                <View style={styles.bridgeRow}>
                  {expCtx?.userTopIntent && (
                    <ContextBridge
                      variant="chip"
                      targetScreen="ExperimentDiscovery"
                      params={{ intentFilter: expCtx.userTopIntent }}
                      icon="flask"
                      iconType="community"
                      color="#7C4DFF"
                      title={expCtx.userTopIntent}
                    />
                  )}
                  {resonanceCtx?.streakDays > 0 && (
                    <ContextBridge
                      variant="chip"
                      targetScreen="ResonanceDashboard"
                      icon="local-fire-department"
                      iconType="material"
                      color="#FFD700"
                      title={`${resonanceCtx.streakDays}d streak`}
                    />
                  )}
                  {achCtx?.nearCompleteCount > 0 && (
                    <ContextBridge
                      variant="chip"
                      targetScreen="Achievements"
                      icon="trophy"
                      iconType="ion"
                      color="#F59E0B"
                      title={`${achCtx.nearCompleteCount} close`}
                    />
                  )}
                </View>
              )}

              {isOwnProfile ? (
                <TouchableOpacity style={styles.editProfileBtn} onPress={() => setEditing(true)}>
                  <Ionicons name="create-outline" size={16} color="#00e89d" />
                  <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.followBtn, user.is_following && styles.followingBtn]}
                  onPress={handleFollow}
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}
                >
                  <Text style={[styles.followText, user.is_following && styles.followingText]}>
                    {user.is_following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Posts</Text>
      </Animatable.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00e89d" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{user?.display_name || 'Profile'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <MaterialCommunityIcons name="post-outline" size={48} color="#555" />
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%') },
  backButton: { padding: 10 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  centerContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: hp('10%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  profileCard: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: wp('5%'),
    marginBottom: hp('2%'), borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center',
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#00e89d22',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarLargeText: { color: '#00e89d', fontSize: wp('8%'), fontWeight: '700' },
  displayName: { color: '#FFF', fontSize: wp('5%'), fontWeight: '700', marginBottom: 2 },
  username: { color: '#888', fontSize: wp('3.5%'), marginBottom: 8 },
  bio: { color: '#AAA', fontSize: wp('3.5%'), textAlign: 'center', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: wp('8%'), marginVertical: 12 },
  bridgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statItem: { alignItems: 'center' },
  statValue: { color: '#FFF', fontSize: wp('4.5%'), fontWeight: '700' },
  statLabel: { color: '#888', fontSize: wp('3%') },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: wp('5%'), paddingVertical: hp('1%'), borderRadius: 20,
    borderWidth: 1, borderColor: '#00e89d',
  },
  editProfileText: { color: '#00e89d', fontWeight: '600', fontSize: wp('3.2%') },
  followBtn: {
    paddingHorizontal: wp('8%'), paddingVertical: hp('1%'), borderRadius: 20, backgroundColor: '#00e89d',
  },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#00e89d' },
  followText: { color: '#121212', fontWeight: '700', fontSize: wp('3.5%') },
  followingText: { color: '#00e89d' },
  editSection: { width: '100%', marginTop: 8 },
  editInput: {
    backgroundColor: '#121212', borderRadius: 12, padding: wp('3%'), color: '#FFF',
    fontSize: wp('3.5%'), marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A',
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingHorizontal: wp('4%'), paddingVertical: hp('0.8%') },
  cancelText: { color: '#888', fontWeight: '600' },
  saveBtn: { paddingHorizontal: wp('5%'), paddingVertical: hp('0.8%'), borderRadius: 20, backgroundColor: '#00e89d' },
  saveText: { color: '#121212', fontWeight: '700' },
  sectionTitle: { color: '#FFF', fontSize: wp('4%'), fontWeight: '700', marginBottom: hp('1%') },
  postCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  postContent: { color: '#FFF', fontSize: wp('3.5%'), marginBottom: 8 },
  postFooter: { flexDirection: 'row', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { color: '#888', fontSize: wp('3%') },
});

export default ProfileScreen;
