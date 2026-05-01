import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

import { achievementsApi } from '../../../services/socialApi';
import { AchievementCard, SkeletonLoader } from '../components/Gamification';
import ContextBridge from '../components/ContextBridge';
import usePressAnimation from '../../../hooks/usePressAnimation';

const FILTER_TABS = ['All', 'Earned', 'Locked'];
const CATEGORIES = ['Social', 'Content', 'Tasks', 'Engagement', 'Special', 'Seasonal'];

const AchievementsScreen = () => {
  const navigation = useNavigation();
  const { onPressIn, onPressOut, animatedStyle: pressStyle } = usePressAnimation(0.96);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const modalRef = useRef(null);

  const closeModal = useCallback(async () => {
    if (modalRef.current) {
      await modalRef.current.zoomOut(200);
    }
    setModalVisible(false);
  }, []);
  const [achievements, setAchievements] = useState([]);

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;
  const totalCount = achievements.length;

  const nearCompleteBridge = useMemo(() => {
    const nearComplete = achievements.filter(a =>
      !a.isUnlocked && a.progress && a.maxProgress && (a.progress / a.maxProgress) > 0.75
    );
    if (nearComplete.length === 0) return null;
    const a = nearComplete[0];
    return { name: a.name, remaining: a.maxProgress - a.progress };
  }, [achievements]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await achievementsApi.list();
      setAchievements(res.data || []);
    } catch (e) { /* keep empty */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const filteredAchievements = achievements.filter(achievement => {
    // Tab filter
    if (activeTab === 1 && !achievement.isUnlocked) return false;
    if (activeTab === 2 && achievement.isUnlocked) return false;

    // Category filter
    if (selectedCategory && achievement.category !== selectedCategory.toLowerCase()) return false;

    // Search filter
    if (searchQuery && !achievement.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    return true;
  });

  const handleAchievementPress = (achievement) => {
    setSelectedAchievement(achievement);
    setModalVisible(true);
  };

  const renderAchievementModal = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={closeModal}
      >
        <Animatable.View
          ref={modalRef}
          animation="zoomIn"
          duration={300}
          style={styles.modalContent}
        >
          {selectedAchievement && (
            <>
              <View style={[styles.modalIconContainer, { backgroundColor: `${getRarityColor(selectedAchievement.rarity)}22` }]}>
                <MaterialCommunityIcons
                  name={selectedAchievement.icon}
                  size={48}
                  color={getRarityColor(selectedAchievement.rarity)}
                />
              </View>
              <Text style={styles.modalTitle}>{selectedAchievement.name}</Text>
              <View style={[styles.modalRarityBadge, { backgroundColor: `${getRarityColor(selectedAchievement.rarity)}33` }]}>
                <Text style={[styles.modalRarityText, { color: getRarityColor(selectedAchievement.rarity) }]}>
                  {selectedAchievement.rarity.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.modalDescription}>{selectedAchievement.description}</Text>

              {selectedAchievement.isUnlocked ? (
                <View style={styles.modalUnlockedInfo}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.modalUnlockedText}>
                    Unlocked on {new Date(selectedAchievement.unlockedAt).toLocaleDateString()}
                  </Text>
                </View>
              ) : (
                <View style={styles.modalProgressSection}>
                  <View style={styles.modalProgressBar}>
                    <View
                      style={[
                        styles.modalProgressFill,
                        {
                          width: `${(selectedAchievement.progress / selectedAchievement.maxProgress) * 100}%`,
                          backgroundColor: getRarityColor(selectedAchievement.rarity),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.modalProgressText}>
                    {selectedAchievement.progress} / {selectedAchievement.maxProgress}
                  </Text>
                </View>
              )}

              {selectedAchievement.isUnlocked && (
                <TouchableOpacity
                  style={styles.showcaseButton}
                  onPress={async () => {
                    try {
                      await achievementsApi.showcase(selectedAchievement.id, {});
                    } catch (e) { /* ignore */ }
                  }}
                >
                  <MaterialCommunityIcons name="ribbon" size={20} color="#FFD700" />
                  <Text style={styles.showcaseButtonText}>Showcase on Profile</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeModal}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </Animatable.View>
      </TouchableOpacity>
    </Modal>
  );

  const getRarityColor = (rarity) => {
    const colors = {
      common: '#6B7280',
      uncommon: '#10B981',
      rare: '#3B82F6',
      legendary: '#F59E0B',
    };
    return colors[rarity] || colors.common;
  };

  const renderHeader = () => (
    <>
      {/* Achievement Count */}
      <Animatable.View animation="fadeInDown" style={styles.countCard}>
        <View style={styles.countIcon}>
          <MaterialCommunityIcons name="trophy" size={32} color="#FFD700" />
        </View>
        <View style={styles.countInfo}>
          <Text style={styles.countText}>
            <Text style={styles.countHighlight}>{unlockedCount}</Text> / {totalCount}
          </Text>
          <Text style={styles.countLabel}>Achievements Unlocked</Text>
        </View>
        <View style={styles.countProgress}>
          <Text style={styles.countPercent}>{totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}%</Text>
        </View>
      </Animatable.View>

      {/* Context bridge: near-complete achievement action */}
      {nearCompleteBridge && (
        <ContextBridge
          variant="inline"
          targetScreen="ExperimentDiscovery"
          icon="flask"
          iconType="community"
          color="#7C4DFF"
          title={`${nearCompleteBridge.remaining} more to unlock "${nearCompleteBridge.name}"`}
          subtitle="Explore thought experiments to progress"
        />
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search achievements..."
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

      {/* Filter Tabs */}
      <View style={styles.filterTabsContainer}>
        {FILTER_TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeTab === index && styles.filterTabActive]}
            onPress={() => setActiveTab(index)}
          >
            <Text style={[styles.filterTabText, activeTab === index && styles.filterTabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
          >
            <Text style={[styles.categoryChipText, selectedCategory === category && styles.categoryChipTextActive]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );

  const renderAchievementItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.gridItem}
      activeOpacity={0.7}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => handleAchievementPress(item)}
    >
      <Animated.View style={pressStyle}>
        <AchievementCard
          icon={item.icon}
          name={item.name}
          description={item.description}
          rarity={item.rarity}
          isUnlocked={item.isUnlocked}
          progress={item.progress}
          maxProgress={item.maxProgress}
          unlockedAt={item.unlockedAt}
          onPress={() => handleAchievementPress(item)}
          loading={loading}
        />
      </Animated.View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={filteredAchievements}
        keyExtractor={(item) => item.id}
        renderItem={renderAchievementItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No achievements found</Text>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00e89d"
            colors={['#00e89d']}
          />
        }
      />

      {renderAchievementModal()}
    </SafeAreaView>
  );
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
    padding: 10,
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
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('10%'),
  },
  countCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
    borderColor: '#FFD70044',
  },
  countIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFD70022',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countInfo: {
    flex: 1,
    marginLeft: wp('4%'),
  },
  countText: {
    color: '#888',
    fontSize: wp('5%'),
    fontWeight: '600',
  },
  countHighlight: {
    color: '#FFD700',
    fontWeight: '800',
  },
  countLabel: {
    color: '#666',
    fontSize: wp('3%'),
    marginTop: 2,
  },
  countProgress: {
    backgroundColor: '#FFD70022',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: 12,
  },
  countPercent: {
    color: '#FFD700',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
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
  filterTabsContainer: {
    flexDirection: 'row',
    marginBottom: hp('1.5%'),
    gap: 10,
  },
  filterTab: {
    flex: 1,
    paddingVertical: hp('1%'),
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  filterTabActive: {
    backgroundColor: '#00e89d22',
    borderColor: '#00e89d',
  },
  filterTabText: {
    color: '#888',
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#00e89d',
  },
  categoriesContainer: {
    marginBottom: hp('2%'),
  },
  categoriesContent: {
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#00e89d22',
    borderColor: '#00e89d',
  },
  categoryChipText: {
    color: '#888',
    fontSize: wp('3%'),
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#00e89d',
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: hp('1%'),
  },
  gridItem: {
    width: '48%',
  },
  emptyText: {
    color: '#888',
    fontSize: wp('3.5%'),
    textAlign: 'center',
    marginTop: hp('5%'),
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: wp('6%'),
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  modalTitle: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  modalRarityBadge: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.5%'),
    borderRadius: 12,
    marginBottom: hp('1.5%'),
  },
  modalRarityText: {
    fontSize: wp('3%'),
    fontWeight: '700',
  },
  modalDescription: {
    color: '#888',
    fontSize: wp('3.5%'),
    textAlign: 'center',
    marginBottom: hp('2%'),
    lineHeight: 22,
  },
  modalUnlockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98122',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    borderRadius: 10,
    marginBottom: hp('2%'),
  },
  modalUnlockedText: {
    color: '#10B981',
    fontSize: wp('3%'),
    fontWeight: '600',
    marginLeft: 8,
  },
  modalProgressSection: {
    width: '100%',
    marginBottom: hp('2%'),
  },
  modalProgressBar: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalProgressText: {
    color: '#888',
    fontSize: wp('3%'),
    textAlign: 'right',
    marginTop: 6,
  },
  showcaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70022',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
    borderRadius: 10,
    marginBottom: hp('1.5%'),
  },
  showcaseButtonText: {
    color: '#FFD700',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginLeft: 8,
  },
  modalCloseButton: {
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#888',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
});

export default AchievementsScreen;
