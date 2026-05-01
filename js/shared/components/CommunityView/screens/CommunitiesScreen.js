import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { communitiesApi } from '../../../services/socialApi';

const CommunitiesScreen = () => {
  const navigation = useNavigation();
  const [communities, setCommunities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCommunities = useCallback(async () => {
    try {
      const res = await communitiesApi.list({ limit: 50 });
      setCommunities(res.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCommunities(); }, [fetchCommunities]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCommunities();
    setRefreshing(false);
  }, [fetchCommunities]);

  const handleJoin = async (id) => {
    try {
      await communitiesApi.join(id);
      setCommunities(prev => prev.map(s =>
        s.id === id ? { ...s, is_member: true, member_count: (s.member_count || 0) + 1 } : s
      ));
    } catch {
      // silent
    }
  };

  const handleLeave = async (id) => {
    try {
      await communitiesApi.leave(id);
      setCommunities(prev => prev.map(s =>
        s.id === id ? { ...s, is_member: false, member_count: Math.max(0, (s.member_count || 1) - 1) } : s
      ));
    } catch {
      // silent
    }
  };

  const filtered = communities.filter(s =>
    !searchQuery || (s.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconBg}>
            <MaterialCommunityIcons name="account-group" size={24} color="#00e89d" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>h/{item.name}</Text>
            <Text style={styles.cardMeta}>{item.member_count || 0} members</Text>
          </View>
          <TouchableOpacity
            style={[styles.joinBtn, item.is_member && styles.joinedBtn]}
            onPress={() => item.is_member ? handleLeave(item.id) : handleJoin(item.id)}
          >
            <Text style={[styles.joinText, item.is_member && styles.joinedText]}>
              {item.is_member ? 'Joined' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Communities</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search communities..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00e89d" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color="#555" />
              <Text style={styles.emptyText}>No communities found</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%') },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 12, paddingHorizontal: wp('4%'), paddingVertical: hp('1.2%'),
    marginHorizontal: wp('4%'), marginBottom: hp('1.5%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: wp('3.5%'), marginLeft: 10 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: hp('15%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00e89d22', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700' },
  cardMeta: { color: '#888', fontSize: wp('3%') },
  cardDesc: { color: '#AAA', fontSize: wp('3.2%'), marginTop: 8 },
  joinBtn: {
    paddingHorizontal: wp('4%'), paddingVertical: hp('0.8%'),
    borderRadius: 20, backgroundColor: '#00e89d',
  },
  joinedBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#00e89d' },
  joinText: { color: '#121212', fontWeight: '700', fontSize: wp('3%') },
  joinedText: { color: '#00e89d' },
});

export default CommunitiesScreen;
