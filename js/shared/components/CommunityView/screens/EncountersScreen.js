import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import useEncounterStore from '../../../encounterStore';
import useLocationPing from '../../../hooks/useLocationPing';
import { encountersApi } from '../../../services/socialApi';
import ProximityBanner from '../components/Encounters/ProximityBanner';
import ProximityMatchCard from '../components/Encounters/ProximityMatchCard';
import MissedConnectionCard from '../components/Encounters/MissedConnectionCard';
import EncounterCard from '../components/Encounters/EncounterCard';
import DiscoverableTogglePanel from '../components/Encounters/DiscoverableTogglePanel';
import BleMatchCard from '../components/Encounters/BleMatchCard';
import IcebreakerDraftSheet from '../components/Encounters/IcebreakerDraftSheet';
import LocationSettingsToggle from '../components/Encounters/LocationSettingsToggle';
import ContextBridge from '../components/ContextBridge';
import { bleEncounterApi } from '../../../services/socialApi';

// BLE Matches added at index 4 (end) so existing index logic for
// activeTab === 1, 2, 3 (Missed/Discovery/My Posts) is unchanged.
const TABS = ['Nearby Now', 'Missed Connections', 'Discovery', 'My Posts', 'BLE Matches'];
const RADIUS_OPTIONS = [
  { label: '100m', value: 100 },
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
  { label: '5km', value: 5000 },
];

const EncountersScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [discoverySuggestions, setDiscoverySuggestions] = useState([]);
  const [bleMatches, setBleMatches] = useState([]);
  const [icebreakerMatch, setIcebreakerMatch] = useState(null);

  const {
    isTracking,
    lat,
    lon,
    nearbyCount,
    matches,
    startTracking,
    stopTracking,
  } = useLocationPing();

  const expCtx = null;
  const challengeCtx = null;

  const missedConnections = useEncounterStore((s) => s.missedConnections);
  const myMissedConnections = useEncounterStore((s) => s.myMissedConnections);
  const radius = useEncounterStore((s) => s.radius);
  const setRadius = useEncounterStore((s) => s.setRadius);
  const setMissedConnections = useEncounterStore((s) => s.setMissedConnections);
  const setMyMissedConnections = useEncounterStore((s) => s.setMyMissedConnections);

  const fetchMissedConnections = useCallback(async () => {
    if (lat && lon) {
      try {
        const result = await encountersApi.searchMissed({ lat, lon, radius });
        if (result && Array.isArray(result.results)) {
          setMissedConnections(result.results);
        }
      } catch (e) {
        console.warn('Failed to fetch missed connections:', e.message);
      }
    }
  }, [lat, lon, radius, setMissedConnections]);

  const fetchMyMissedConnections = useCallback(async () => {
    try {
      const result = await encountersApi.myMissed();
      if (result && Array.isArray(result.results)) {
        setMyMissedConnections(result.results);
      }
    } catch (e) {
      console.warn('Failed to fetch my missed connections:', e.message);
    }
  }, [setMyMissedConnections]);

  const fetchDiscoverySuggestions = useCallback(async () => {
    try {
      const result = await encountersApi.suggestions();
      // Backend returns {success, data:[...]} via _ok() in
      // HARTOS api_gamification.py:684 — same shape the web SPA's
      // EncountersPage.js:86 reads (res.data || []).
      const list = Array.isArray(result?.data) ? result.data : [];
      setDiscoverySuggestions(list);
    } catch (e) {
      console.warn('Failed to fetch discovery suggestions:', e.message);
    }
  }, []);

  const fetchBleMatches = useCallback(async () => {
    try {
      const result = await bleEncounterApi.listMatches();
      // PRODUCT_MAP J204 — server returns {success, data: {matches:[...]}}.
      // Defensive: also accept a bare array if a future server emits one.
      const data = result?.data;
      const list = Array.isArray(data?.matches)
        ? data.matches
        : Array.isArray(data)
          ? data
          : [];
      setBleMatches(list);
    } catch (e) {
      console.warn('Failed to fetch BLE matches:', e.message);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 1) {
      fetchMissedConnections();
    } else if (activeTab === 2 && __DEV__) {
      // Discovery live data is dev/staging only until product
      // greenlight (orchestrator a73b4a29 product-owner verdict on
      // commit 7b818ec7).  Production builds show a "Coming Soon"
      // placeholder via renderDiscoveryTab below — skip the
      // suggestions fetch so prod never hits the network.
      // TODO(2026-Q3): remove __DEV__ gate after product-owner
      // greenlight; rollout cleanup tracked in ledger #444.
      fetchDiscoverySuggestions();
    } else if (activeTab === 3) {
      fetchMyMissedConnections();
    } else if (activeTab === 4) {
      fetchBleMatches();
    }
  }, [
    activeTab,
    fetchMissedConnections,
    fetchDiscoverySuggestions,
    fetchBleMatches,
    fetchMyMissedConnections,
  ]);

  const handleReveal = useCallback(async (matchId) => {
    try {
      await encountersApi.revealMatch(matchId);
    } catch (e) {
      console.warn('Reveal failed:', e.message);
    }
  }, []);

  const handleChat = useCallback(
    (userId) => {
      // Navigate to chat - placeholder for existing chat integration
      console.log('Start chat with:', userId);
    },
    [],
  );

  const handleMissedPress = useCallback(
    (item) => {
      navigation.navigate('MissedConnectionDetail', { missedId: item.id });
    },
    [navigation],
  );

  const handleAcceptDiscovery = useCallback(async (encounter) => {
    if (!encounter?.id) return;
    try {
      await encountersApi.acknowledge(encounter.id);
    } catch (e) {
      console.warn('Acknowledge failed:', e.message);
    }
    setDiscoverySuggestions((prev) =>
      prev.filter((item) => item.id !== encounter.id),
    );
  }, []);

  const handleSkipDiscovery = useCallback((encounter) => {
    if (!encounter?.id) return;
    setDiscoverySuggestions((prev) =>
      prev.filter((item) => item.id !== encounter.id),
    );
  }, []);

  // PRODUCT_MAP J207-J210 — open icebreaker draft modal for a BLE
  // match.  IcebreakerDraftSheet (mounted once below) handles the
  // draft → review → send/decline state machine.
  const handleSendIcebreaker = useCallback((match) => {
    if (!match?.id) return;
    setIcebreakerMatch(match);
  }, []);

  // After successful send, refetch matches so the icebreaker_a/b
  // status flips ('sent') reflect on the BleMatchCard chips.
  const handleIcebreakerSent = useCallback(() => {
    fetchBleMatches();
  }, [fetchBleMatches]);

  const handleIcebreakerClose = useCallback(() => {
    setIcebreakerMatch(null);
  }, []);

  // J211 — Hide-from-map placeholder.  Server endpoint not yet
  // exposed; this is a UI-only optimistic hide for now.  Tracked as
  // a separate gap (no ledger task yet — file when needed).
  const handleHideMatch = useCallback((match) => {
    if (!match?.id) return;
    setBleMatches((prev) => prev.filter((m) => m.id !== match.id));
  }, []);

  const renderNearbyTab = () => (
    <View style={styles.tabContent}>
      <LocationSettingsToggle />
      {isTracking ? (
        <>
          <ProximityBanner nearbyCount={nearbyCount} isScanning={nearbyCount === 0} />
          {/* Context bridge: matched interests → Experiments */}
          {expCtx?.userTopIntent && matches.length > 0 && (
            <ContextBridge
              variant="inline"
              targetScreen="ExperimentDiscovery"
              params={{ intentFilter: expCtx.userTopIntent }}
              icon="flask"
              iconType="community"
              color="#7C4DFF"
              title={`${matches.length} matched interested in ${expCtx.userTopIntent}`}
              subtitle="Explore thought experiments together"
            />
          )}
          {/* Context bridge: active challenge */}
          {challengeCtx?.activeCount > 0 && (
            <ContextBridge
              variant="banner"
              targetScreen="Challenges"
              icon="flag-checkered"
              iconType="community"
              color="#EF4444"
              title={`${challengeCtx.activeCount} active challenge${challengeCtx.activeCount !== 1 ? 's' : ''}`}
              subtitle={challengeCtx.endingSoonCount > 0 ? `${challengeCtx.endingSoonCount} ending soon` : 'Keep going'}
            />
          )}
          <FlatList
            data={matches}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            renderItem={({ item }) => (
              <ProximityMatchCard
                match={item}
                currentUserId={null}
                onReveal={handleReveal}
                onChat={handleChat}
              />
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <>
                <Text style={styles.emptyText}>
                  No proximity matches yet. Keep exploring!
                </Text>
                <ContextBridge
                  variant="inline"
                  targetScreen="ExperimentDiscovery"
                  icon="flask"
                  iconType="community"
                  color="#7C4DFF"
                  title="Explore thought experiments"
                  subtitle="While waiting, discover trending ideas"
                />
              </>
            }
          />
        </>
      ) : (
        <View style={styles.disabledContainer}>
          <MaterialIcons name="location-off" size={64} color="#555" />
          <Text style={styles.disabledTitle}>Location Sharing is Off</Text>
          <Text style={styles.disabledText}>
            Enable location sharing to discover people nearby and get proximity
            matches in real-time.
          </Text>
          <TouchableOpacity style={styles.enableButton} onPress={startTracking}>
            <MaterialIcons name="my-location" size={20} color="#1a1a2e" />
            <Text style={styles.enableButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderMissedTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.missedHeader}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleActive]}
            onPress={() => setViewMode('list')}
          >
            <MaterialIcons name="view-list" size={22} color={viewMode === 'list' ? '#00e89d' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleActive]}
            onPress={() => {
              navigation.navigate('MissedConnectionsMap');
            }}
          >
            <MaterialIcons name="map" size={22} color={viewMode === 'map' ? '#00e89d' : '#888'} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.radiusRow}>
        {RADIUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.radiusChip, radius === opt.value && styles.radiusChipActive]}
            onPress={() => setRadius(opt.value)}
          >
            <Text
              style={[
                styles.radiusChipText,
                radius === opt.value && styles.radiusChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={missedConnections}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={({ item }) => (
          <MissedConnectionCard item={item} onPress={() => handleMissedPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No missed connections found nearby. Try expanding the radius.
          </Text>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateMissedConnection')}
      >
        <MaterialIcons name="add" size={28} color="#1a1a2e" />
      </TouchableOpacity>
    </View>
  );

  const renderDiscoveryTab = () => {
    // Production builds show the "Coming Soon" placeholder from the
    // pre-7b818ec7 era until product greenlights live rollout
    // (orchestrator a73b4a29 product-owner verdict).  __DEV__ is
    // React Native's canonical dev-vs-prod flag — Metro sets it to
    // true for `react-native start` / dev / staging builds and
    // false for production releases.
    // TODO(2026-Q3): remove this gate after product greenlight;
    // cleanup tracked in ledger #444.
    if (!__DEV__) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.disabledContainer}>
            <Ionicons name="sparkles-outline" size={64} color="#555" />
            <Text style={styles.disabledTitle}>Coming Soon</Text>
            <Text style={styles.disabledText}>
              Digital encounter suggestions based on your interests and
              activity.
            </Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.tabContent}>
        <FlatList
          data={discoverySuggestions}
          keyExtractor={(item) =>
            item.id?.toString() || Math.random().toString()
          }
          renderItem={({ item }) => (
            <EncounterCard
              encounter={item}
              onAccept={handleAcceptDiscovery}
              onSkip={handleSkipDiscovery}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.disabledContainer}>
              <Ionicons name="sparkles-outline" size={64} color="#555" />
              <Text style={styles.disabledTitle}>No Suggestions Yet</Text>
              <Text style={styles.disabledText}>
                We&apos;ll surface people whose interests align with yours as
                we learn more about your activity.
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  const renderMyPostsTab = () => (
    <View style={styles.tabContent}>
      <FlatList
        data={myMissedConnections}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={({ item }) => (
          <MissedConnectionCard item={item} onPress={() => handleMissedPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            You have not posted any missed connections yet.
          </Text>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateMissedConnection')}
      >
        <MaterialIcons name="add" size={28} color="#1a1a2e" />
      </TouchableOpacity>
    </View>
  );

  // PRODUCT_MAP J204 — BLE mutual matches list.  Each row triggers
  // the icebreaker draft modal via handleSendIcebreaker.
  const renderBleMatchesTab = () => (
    <View style={styles.tabContent}>
      <FlatList
        data={bleMatches}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={({ item }) => (
          <BleMatchCard
            match={item}
            currentUserId={null /* TODO: thread current user id from auth */}
            onIcebreaker={handleSendIcebreaker}
            onHide={handleHideMatch}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.disabledContainer}>
            <Ionicons name="people-outline" size={64} color="#555" />
            <Text style={styles.disabledTitle}>No mutual encounters yet</Text>
            <Text style={styles.disabledText}>
              Turn on Discoverable above and head somewhere with people who
              share your interests. Mutual matches show up here.
            </Text>
          </View>
        }
      />
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return renderNearbyTab();
      case 1:
        return renderMissedTab();
      case 2:
        return renderDiscoveryTab();
      case 3:
        return renderMyPostsTab();
      case 4:
        return renderBleMatchesTab();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Encounters</Text>
        <View style={styles.headerSpacer} />
      </View>
      {/* BLE consent panel — RN parity for the web SPA's
          DiscoverableTogglePanel (commit 5a705452 / F1 GREENLIT).
          Mounted ABOVE the tabs so the consent moment is visible
          across every tab.  Honors mission anchors: 18+ unchecked
          default per mount, server-authoritative TTL, switch
          disabled until age claim, no surveillance copy. */}
      <DiscoverableTogglePanel />
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === index && styles.tabActive]}
            onPress={() => setActiveTab(index)}
          >
            <Text
              style={[styles.tabText, activeTab === index && styles.tabTextActive]}
              numberOfLines={1}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {renderTabContent()}
      {/* PRODUCT_MAP J207-J210 — single icebreaker modal mounted at
          screen level (per F2 web architectural choice in commit
          a3398905).  Per-match dismiss filtered by match.id inside
          the modal; cross-match WAMP leak guarded.  WAMP peer-dismiss
          path itself is gated on RN native bridge (#407). */}
      <IcebreakerDraftSheet
        open={!!icebreakerMatch}
        match={icebreakerMatch}
        viewer={null /* TODO: thread current viewer from auth */}
        onClose={handleIcebreakerClose}
        onSent={handleIcebreakerSent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: wp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: hp('1.2%'),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#00e89d',
  },
  tabText: {
    color: '#888',
    fontSize: wp('3.2%'),
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#00e89d',
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: wp('3%'),
    paddingBottom: hp('10%'),
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('10%'),
  },
  disabledTitle: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    marginTop: hp('2%'),
    textAlign: 'center',
  },
  disabledText: {
    color: '#888',
    fontSize: wp('3.5%'),
    marginTop: hp('1%'),
    textAlign: 'center',
    lineHeight: 22,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00e89d',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    borderRadius: 24,
    marginTop: hp('3%'),
  },
  enableButtonText: {
    color: '#1a1a2e',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 8,
  },
  emptyText: {
    color: '#888',
    fontSize: wp('3.5%'),
    textAlign: 'center',
    marginTop: hp('5%'),
  },
  missedHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1%'),
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
  },
  viewToggleBtn: {
    padding: 8,
    borderRadius: 8,
  },
  viewToggleActive: {
    backgroundColor: '#3a3a4e',
  },
  radiusRow: {
    flexDirection: 'row',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    gap: 8,
  },
  radiusChip: {
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 16,
    backgroundColor: '#2a2a3e',
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  radiusChipActive: {
    backgroundColor: '#00e89d22',
    borderColor: '#00e89d',
  },
  radiusChipText: {
    color: '#888',
    fontSize: wp('3%'),
    fontWeight: '500',
  },
  radiusChipTextActive: {
    color: '#00e89d',
  },
  fab: {
    position: 'absolute',
    right: wp('5%'),
    bottom: hp('3%'),
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

export default EncountersScreen;
