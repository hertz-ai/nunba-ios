import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { communitiesApi } from '../../../services/socialApi';

const CommunityDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId } = route.params;
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, postsRes] = await Promise.all([
        communitiesApi.get(communityId),
        communitiesApi.posts(communityId, { limit: 30 }),
      ]);
      setCommunity(subRes.data || null);
      setPosts(postsRes.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleToggleMembership = async () => {
    if (!community) return;
    try {
      if (community.is_member) {
        await communitiesApi.leave(communityId);
        setCommunity(prev => ({ ...prev, is_member: false, member_count: Math.max(0, (prev.member_count || 1) - 1) }));
      } else {
        await communitiesApi.join(communityId);
        setCommunity(prev => ({ ...prev, is_member: true, member_count: (prev.member_count || 0) + 1 }));
      }
    } catch {
      // silent
    }
  };

  const renderPost = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <View style={styles.postCard}>
        <Text style={styles.postAuthor}>{item.author_name || 'Unknown'}</Text>
        <Text style={styles.postContent} numberOfLines={4}>{item.content}</Text>
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
      </View>
    </Animatable.View>
  );

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>h/{community?.name || '...'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {community && (
        <View style={styles.infoCard}>
          <Text style={styles.infoDesc}>{community.description || 'No description'}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoStat}>{community.member_count || 0} members</Text>
            <TouchableOpacity
              style={[styles.joinBtn, community.is_member && styles.joinedBtn]}
              onPress={handleToggleMembership}
            >
              <Text style={[styles.joinText, community.is_member && styles.joinedText]}>
                {community.is_member ? 'Leave' : 'Join'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPost}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <MaterialCommunityIcons name="post-outline" size={48} color="#555" />
            <Text style={styles.emptyText}>No posts in this community yet</Text>
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
  backButton: { padding: 4 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: hp('10%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  infoCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: wp('4%'),
    marginHorizontal: wp('4%'), marginBottom: hp('1.5%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  infoDesc: { color: '#CCC', fontSize: wp('3.5%'), marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoStat: { color: '#888', fontSize: wp('3%') },
  joinBtn: { paddingHorizontal: wp('5%'), paddingVertical: hp('0.8%'), borderRadius: 20, backgroundColor: '#00e89d' },
  joinedBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF6B35' },
  joinText: { color: '#121212', fontWeight: '700', fontSize: wp('3%') },
  joinedText: { color: '#FF6B35' },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  postCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  postAuthor: { color: '#00e89d', fontSize: wp('3.2%'), fontWeight: '600', marginBottom: 4 },
  postContent: { color: '#FFF', fontSize: wp('3.5%'), marginBottom: 8 },
  postFooter: { flexDirection: 'row', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { color: '#888', fontSize: wp('3%') },
});

export default CommunityDetailScreen;
