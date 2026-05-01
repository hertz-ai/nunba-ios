import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, ActivityIndicator, Animated,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { searchApi } from '../../../services/socialApi';
import { colors, borderRadius, fontSize, fontWeight, shadows, GRADIENTS } from '../../../theme/colors';
import useLiquidOverlayStore from '../../../liquidOverlayStore';
import useNunbaKeyboardStore from '../../../nunbaKeyboardStore';

const TABS = [
  { key: 'posts', label: 'Posts', icon: 'document-text-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'communities', label: 'Communities', icon: 'globe-outline' },
];

const SearchScreen = () => {
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('posts');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const showOverlay = useLiquidOverlayStore((s) => s.show);
  const showKeyboard = useNunbaKeyboardStore((s) => s.show);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await searchApi.search({ q, type: activeTab });
      setResults(res.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const handleSubmit = () => doSearch(query);

  const handleAskNunba = () => {
    // Open LiquidOverlay in chat mode
    showOverlay(null, {}, 'Nunba');
  };

  const handleNunbaKeyboard = () => {
    // Switch to Nunba's floating keyboard for search input
    showKeyboard({
      onChangeText: (text) => { setQuery(text); },
      onSubmit: (text) => { setQuery(text); doSearch(text); },
      initialText: query,
      placeholder: 'Search with Nunba...',
    });
  };

  const renderPostItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <TouchableOpacity style={styles.resultCard} activeOpacity={0.7}>
        <Text style={styles.resultTitle} numberOfLines={2}>{item.title || item.content}</Text>
        <Text style={styles.resultMeta}>by {item.author_name || 'Unknown'} — {item.upvotes || 0} upvotes</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderUserItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <TouchableOpacity
        style={styles.resultCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('Profile', { userId: item.id })}
      >
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.display_name || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultTitle}>{item.display_name || item.username}</Text>
            <Text style={styles.resultMeta}>@{item.username} — {item.karma || 0} karma</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderCommunityItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <TouchableOpacity
        style={styles.resultCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}
      >
        <Text style={styles.resultTitle}>h/{item.name}</Text>
        <Text style={styles.resultMeta}>{item.member_count || 0} members — {item.description || ''}</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderItem = activeTab === 'users' ? renderUserItem
    : activeTab === 'communities' ? renderCommunityItem : renderPostItem;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search posts, users, communities..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          autoFocus
        />
        <TouchableOpacity onPress={handleNunbaKeyboard} style={{ marginRight: 6 }}>
          <MaterialCommunityIcons name="keyboard-variant" size={20} color={colors.accent} />
        </TouchableOpacity>
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => { setActiveTab(tab.key); if (query) doSearch(query); }}
          >
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? colors.accent : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="magnify" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>{query ? 'No results found' : 'Start typing to search'}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Ask Nunba floating pill ── */}
      <TouchableOpacity
        style={styles.nunbaPill}
        activeOpacity={0.8}
        onPress={handleAskNunba}
      >
        <View style={styles.nunbaAvatar}>
          <Text style={styles.nunbaAvatarText}>N</Text>
        </View>
        <Text style={styles.nunbaPillText}>Ask Nunba</Text>
        <TouchableOpacity onPress={handleNunbaKeyboard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="keyboard-variant" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <MaterialCommunityIcons name="auto-fix" size={16} color={colors.accent} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%') },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: wp('5%'), fontWeight: fontWeight.bold, textAlign: 'center' },
  headerSpacer: { width: 32 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.md, paddingHorizontal: wp('4%'), paddingVertical: hp('1.2%'),
    marginHorizontal: wp('4%'), marginBottom: hp('1.5%'), borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: wp('3.5%'), marginLeft: 10 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: wp('4%'), marginBottom: hp('1.5%'), gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('3.5%'), paddingVertical: hp('0.8%'),
    backgroundColor: colors.card, borderRadius: borderRadius.pill, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: `${colors.accent}18`, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontSize: wp('3%'), fontWeight: fontWeight.semibold, marginLeft: 6 },
  tabTextActive: { color: colors.accent },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: wp('3.5%'), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  resultCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: colors.border,
    ...shadows.card,
  },
  resultTitle: { color: colors.textPrimary, fontSize: wp('3.8%'), fontWeight: fontWeight.semibold, marginBottom: 4 },
  resultMeta: { color: colors.textSecondary, fontSize: wp('3%') },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.accent}18`,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: colors.accent, fontSize: wp('4%'), fontWeight: fontWeight.bold },
  // Nunba floating pill
  nunbaPill: {
    position: 'absolute',
    bottom: hp('3%'), left: wp('4%'), right: wp('4%'),
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.lg,
  },
  nunbaAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  nunbaAvatarText: { color: '#fff', fontWeight: fontWeight.extrabold, fontSize: 13 },
  nunbaPillText: {
    flex: 1, color: colors.textPrimary,
    fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
  },
});

export default SearchScreen;
