import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { communitiesApi } from '../../../services/socialApi';
import EmptyState from '../../shared/EmptyState';
import { emptyStatePreset } from '../../shared/emptyStatePresets';
import { flatListVirtualizationProps } from '../../shared/listPerf';

// Community card row: 44 icon + padding ~ 100px tall total.
const COMMUNITY_ROW_HEIGHT = 100;

const CommunitiesScreen = () => {
  const navigation = useNavigation();
  const [communities, setCommunities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // #418 fix (live drive 2026-06-16): user reported "No communities and
  // no add/join communities" — the screen had (a) a silent fetch catch
  // hiding server errors, (b) no Create-community FAB at all, and (c)
  // an empty-state preset CTA with no onPress wired so even the
  // "Browse communities" button was dead.  Track loadError so the
  // empty state can show Retry vs Create, expose a FAB always, and
  // wire onCta to retry/create.
  const [loadError, setLoadError] = useState(null);

  // #419 fix: previously this screen rendered an inline <Modal>
  // for "Create a community" but the modal never opened on live
  // devices (Samsung S23 Ultra, 2026-06-16) despite onPress firing.
  // Promoted to a stack route presented modally — see
  // CreateCommunityScreen + home.routes.js Stack.Screen entry.
  const openCreate = () => {
    try {
      navigation.navigate('CreateCommunity', {
        onCreated: (created) => {
          if (created && created.id) {
            setCommunities(prev => [created, ...prev]);
          }
        },
      });
    } catch (e) {
      console.warn('[CommunitiesScreen] navigate(CreateCommunity) threw:', e);
      _toast('Open create failed: ' + (e && e.message || 'unknown'));
    }
  };

  const fetchCommunities = useCallback(async () => {
    try {
      const res = await communitiesApi.list({ limit: 50 });
      setCommunities(res.data || []);
      setLoadError(null);
    } catch (e) {
      const msg = (e && (e.message || String(e))) || 'Network error';
      console.warn('communitiesApi.list failed:', msg);
      setLoadError(msg);
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

  // #411 fix: optimistic-first + roll back + surface error on failure.
  // The old silent-catch version swallowed every server error (network,
  // 401, 5xx, tenant filter mismatch) and left the Join button doing
  // nothing — which blocked the user from joining any community AND
  // blocked Phase 7d call-button entry points (which gate on is_member).
  const _toast = (msg) => {
    try {
      const { ToastAndroid, Platform } = require('react-native');
      if (Platform.OS === 'android' && ToastAndroid) {
        ToastAndroid.show(msg, ToastAndroid.LONG);
      }
    } catch (_) {}
  };

  const handleJoin = async (id) => {
    setCommunities(prev => prev.map(s =>
      s.id === id ? { ...s, is_member: true, member_count: (s.member_count || 0) + 1 } : s
    ));
    try {
      await communitiesApi.join(id);
    } catch (e) {
      const msg = (e && (e.message || String(e))) || 'Network error';
      console.warn('communitiesApi.join failed:', msg);
      setCommunities(prev => prev.map(s =>
        s.id === id ? { ...s, is_member: false, member_count: Math.max(0, (s.member_count || 1) - 1) } : s
      ));
      _toast(`Join failed: ${msg}`);
    }
  };

  const handleLeave = async (id) => {
    setCommunities(prev => prev.map(s =>
      s.id === id ? { ...s, is_member: false, member_count: Math.max(0, (s.member_count || 1) - 1) } : s
    ));
    try {
      await communitiesApi.leave(id);
    } catch (e) {
      const msg = (e && (e.message || String(e))) || 'Network error';
      console.warn('communitiesApi.leave failed:', msg);
      setCommunities(prev => prev.map(s =>
        s.id === id ? { ...s, is_member: true, member_count: (s.member_count || 0) + 1 } : s
      ));
      _toast(`Leave failed: ${msg}`);
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
        accessibilityRole="button"
        accessibilityLabel={`Open community h/${item.name || ''}`}
      >
        {/* #412 fix: previously "h/builders" wrapped per-syllable on
            Samsung S23 portrait because the flex text column got
            squeezed by iconBg (44px) + joinBtn (text-grows) with no
            minWidth:0 — Android RN's flexbox doesn't apply the
            implicit minWidth:0 web does, so the Text node refused to
            shrink below its intrinsic word width.  Adding minWidth:0
            on the flex View + numberOfLines+ellipsizeMode on the
            title + flexShrink:0 on icon/button locks the wrap to a
            clean single line with "…" tail. */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconBg, {flexShrink: 0}]}>
            <MaterialCommunityIcons name="account-group" size={24} color="#6C63FF" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={styles.cardTitle}
              numberOfLines={1}
              ellipsizeMode="tail">
              h/{item.name}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.member_count || 0} members
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.joinBtn, {flexShrink: 0}, item.is_member && styles.joinedBtn]}
            onPress={() => item.is_member ? handleLeave(item.id) : handleJoin(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.is_member ? `Leave community h/${item.name || ''}` : `Join community h/${item.name || ''}`}
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
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* User-feedback 2026-06-16: the prior huge-display title ate
          ~10% of viewport for no information.  Slim header matches the
          rest of CommunityView (ProfileScreen, InvitesScreen, etc.) +
          puts the Create affordance in the header, killing the FAB
          that was overlapping the bottom-nav Account icon. */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Communities</Text>
        <TouchableOpacity
          onPress={() => openCreate()}
          style={styles.headerAction}
          hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}
          accessibilityRole="button"
          accessibilityLabel="Create a new community">
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
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
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : filtered.length === 0 ? (
        // #418 v3 (2026-06-16): when ListEmptyComponent is rendered
        // inside a FlatList, the list's pan responder swallows the
        // TouchableOpacity tap on the EmptyState CTA — user-reported
        // "tap on button not doing ANYTHING".  Render the EmptyState
        // as a sibling instead so the touch reaches it directly.
        <View style={styles.centerContainer}>
          <EmptyState
            {...emptyStatePreset('no-communities')}
            title={loadError ? 'Couldn\'t load communities' : 'No communities'}
            body={loadError
              ? `${loadError}. Pull to refresh or tap Retry.`
              : 'Be the first to create one for your circle.'}
            ctaLabel={loadError ? 'Retry' : 'Create a community'}
            onCta={loadError
              ? () => { setLoading(true); fetchCommunities(); }
              : () => openCreate()}
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          {...flatListVirtualizationProps(COMMUNITY_ROW_HEIGHT)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
          }
        />
      )}

      {/* #419 (2026-06-16): inline Modal previously here did not open on
          live devices.  Promoted to a dedicated Stack.Screen route —
          see CreateCommunityScreen + home.routes.js. */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  // #418 v2: slim header (paddingVertical 0.8% instead of 1.5%) and
  // smaller title (wp 4.2% instead of 5%) to bring chrome budget in
  // line with the other CommunityView screens.
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('4%'), paddingVertical: hp('0.8%') },
  backButton: { padding: 6 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('4.2%'), fontWeight: '600', textAlign: 'center', marginLeft: 4 },
  headerAction: { padding: 6 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#141225',
    borderRadius: 12, paddingHorizontal: wp('4%'), paddingVertical: hp('1.2%'),
    marginHorizontal: wp('4%'), marginBottom: hp('1.5%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: wp('3.5%'), marginLeft: 10 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: hp('15%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  card: {
    backgroundColor: '#141225', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6C63FF22', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700' },
  cardMeta: { color: '#888', fontSize: wp('3%') },
  cardDesc: { color: '#AAA', fontSize: wp('3.2%'), marginTop: 8 },
  joinBtn: {
    paddingHorizontal: wp('4%'), paddingVertical: hp('0.8%'),
    borderRadius: 20, backgroundColor: '#6C63FF',
  },
  joinedBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#6C63FF' },
  joinText: { color: '#000000', fontWeight: '700', fontSize: wp('3%') },
  joinedText: { color: '#6C63FF' },
  // #418 fix styles — 2026-06-20: bottom 28→130 so the FAB clears the
  // bottom nav (~96-120dp tall) instead of being half-occluded by it.
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 130,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});

export default CommunitiesScreen;
