import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Switch,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

import { regionsApi } from '../../../services/socialApi';
import { RegionCard, SkeletonLoader } from '../components/Gamification';

const FILTER_TYPES = [
  { key: 'all', label: 'All', icon: 'earth' },
  { key: 'geographic', label: 'Geographic', icon: 'map-marker' },
  { key: 'thematic', label: 'Thematic', icon: 'palette' },
  { key: 'language', label: 'Language', icon: 'translate' },
];

const RegionsScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canCreateRegion, setCanCreateRegion] = useState(true);
  const [myRegions, setMyRegions] = useState([]);
  const [discoverRegions, setDiscoverRegions] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [myRes, allRes] = await Promise.all([
        regionsApi.list({ joined: true }).catch(() => ({ data: [] })),
        regionsApi.list().catch(() => ({ data: [] })),
      ]);
      setMyRegions(myRes.data || []);
      const myIds = new Set((myRes.data || []).map(r => r.id));
      setDiscoverRegions((allRes.data || []).filter(r => !myIds.has(r.id)));
    } catch (e) {}
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const filteredRegions = discoverRegions.filter(region => {
    if (selectedType !== 'all' && region.type !== selectedType) return false;
    if (searchQuery && !region.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleRegionPress = (region) => {
    navigation.navigate('RegionDetail', { regionId: region.id });
  };

  const handleJoinRegion = async (regionId) => {
    try {
      await regionsApi.join(regionId);
      fetchData();
    } catch (e) {}
  };

  const renderHeader = () => (
    <>
      {/* Search Bar */}
      <Animatable.View animation="fadeInDown" style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search regions..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </Animatable.View>

      {/* Filter Types */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_TYPES.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[styles.filterChip, selectedType === filter.key && styles.filterChipActive]}
            onPress={() => setSelectedType(filter.key)}
          >
            <MaterialCommunityIcons
              name={filter.icon}
              size={16}
              color={selectedType === filter.key ? '#00e89d' : '#888'}
            />
            <Text style={[styles.filterChipText, selectedType === filter.key && styles.filterChipTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Nearby Toggle */}
      <View style={styles.nearbyToggle}>
        <View style={styles.nearbyInfo}>
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#00e89d" />
          <Text style={styles.nearbyText}>Show nearby regions</Text>
        </View>
        <Switch
          value={nearbyEnabled}
          onValueChange={setNearbyEnabled}
          trackColor={{ false: '#3A3A4E', true: '#00e89d44' }}
          thumbColor={nearbyEnabled ? '#00e89d' : '#888'}
        />
      </View>

      {/* My Regions Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Regions</Text>
        <Text style={styles.sectionCount}>{myRegions.length}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.myRegionsScroll}
      >
        {loading ? (
          [...Array(3)].map((_, i) => (
            <SkeletonLoader
              key={i}
              width={wp('40%')}
              height={hp('15%')}
              borderRadius={12}
              style={{ marginRight: wp('3%') }}
            />
          ))
        ) : (
          myRegions.map((region, index) => (
            <Animatable.View key={region.id} animation="fadeInRight" delay={index * 100}>
              <TouchableOpacity
                style={styles.myRegionCard}
                onPress={() => handleRegionPress(region)}
                activeOpacity={0.8}
              >
                <View style={[styles.myRegionIcon, { backgroundColor: getTypeColor(region.type) + '22' }]}>
                  <MaterialCommunityIcons
                    name={region.flagIcon}
                    size={24}
                    color={getTypeColor(region.type)}
                  />
                </View>
                <Text style={styles.myRegionName} numberOfLines={1}>{region.name}</Text>
                <View style={styles.myRegionStats}>
                  <Ionicons name="people" size={12} color="#888" />
                  <Text style={styles.myRegionMembers}>{formatCount(region.memberCount)}</Text>
                </View>
              </TouchableOpacity>
            </Animatable.View>
          ))
        )}
      </ScrollView>

      {/* Discover Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Discover Regions</Text>
      </View>
    </>
  );

  const renderRegionItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <RegionCard
        name={item.name}
        memberCount={item.memberCount}
        governanceTier={item.governanceTier}
        flagIcon={item.flagIcon}
        description={item.description}
        isJoined={item.isJoined || false}
        onPress={() => handleRegionPress(item)}
        onJoin={() => handleJoinRegion(item.id)}
        loading={loading}
      />
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Regions</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={filteredRegions}
        keyExtractor={(item) => item.id}
        renderItem={renderRegionItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="map-search" size={48} color="#555" />
            <Text style={styles.emptyText}>No regions found</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
        }
      />

      {/* Create Region FAB */}
      {canCreateRegion && (
        <Animatable.View animation="bounceIn" delay={500}>
          <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
            <MaterialCommunityIcons name="plus" size={28} color="#121212" />
          </TouchableOpacity>
        </Animatable.View>
      )}
    </SafeAreaView>
  );
};

const getTypeColor = (type) => {
  const colors = {
    geographic: '#00D9FF',
    thematic: '#9D4EDD',
    language: '#FF6B35',
  };
  return colors[type] || '#00e89d';
};

const formatCount = (count) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  listContent: {
    paddingBottom: hp('12%'),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    marginHorizontal: wp('4%'),
    marginBottom: hp('1.5%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('3.5%'),
    marginLeft: 10,
  },
  filterContainer: {
    marginBottom: hp('1.5%'),
  },
  filterContent: {
    paddingHorizontal: wp('4%'),
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.8%'),
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#00e89d22',
    borderColor: '#00e89d',
  },
  filterChipText: {
    color: '#888',
    fontSize: wp('3%'),
    fontWeight: '600',
    marginLeft: 6,
  },
  filterChipTextActive: {
    color: '#00e89d',
  },
  nearbyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    marginHorizontal: wp('4%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  nearbyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nearbyText: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    marginLeft: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    marginBottom: hp('1%'),
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  sectionCount: {
    color: '#888',
    fontSize: wp('3%'),
    backgroundColor: '#2A2A3E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  myRegionsScroll: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('2%'),
  },
  myRegionCard: {
    width: wp('35%'),
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    marginRight: wp('3%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  myRegionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  myRegionName: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginBottom: 4,
  },
  myRegionStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myRegionMembers: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: hp('10%'),
  },
  emptyText: {
    color: '#888',
    fontSize: wp('3.5%'),
    marginTop: hp('2%'),
  },
  fab: {
    position: 'absolute',
    bottom: hp('3%'),
    right: wp('5%'),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00e89d',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#00e89d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default RegionsScreen;
