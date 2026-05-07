/**
 * ActivityHubScreen — RN parity for the web SPA's
 * landing-page/src/components/Social/ActivityHub/ActivityHub.js.
 *
 * 4-section dashboard: Right Now, Play, Contribute, Grow.
 *
 *   - Right Now  — chips for active state (open games, streak,
 *                  compute, active challenges).
 *   - Play       — quickMatch buttons (trivia / word_chain /
 *                  collab_puzzle) + first 3 open games + bond entry.
 *   - Contribute — compute opt-in toggle + active stats + hive line.
 *   - Grow       — challenge progress bars + nav to all-challenges,
 *                  achievements, and resonance dashboard.
 *
 * Backend (existing endpoints, no new surface needed):
 *   gamesApi.list / gamesApi.quickMatch     — multiplayer games
 *   computeApi.status / communityImpact     — compute opt-in state
 *   computeApi.optIn / optOut               — toggle handlers
 *   challengesApi.list({status:'active'})   — running challenges
 *   resonanceApi.getStreak                  — streak state
 *
 * Web → RN translation notes:
 *   - 2-col MUI Grid → vertical stack of 4 cards (RN small-screen).
 *   - useNavigate(`/social/games/${id}`) → useNavigation().navigate('GameScreen', {gameId})
 *   - LinearProgress → simple View with width %.
 *   - Skeletons → ActivityIndicator on loading.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import {
  challengesApi,
  computeApi,
  gamesApi,
  resonanceApi,
} from '../../../services/socialApi';

const ACCENT = '#6C63FF';
const ACCENT_GREEN = '#00e89d';
const ACCENT_AMBER = '#FFB740';
const ACCENT_RED = '#FF6B6B';
const ACCENT_PURPLE = '#7C4DFF';
const MUTED = '#888';

const unwrap = (res) => {
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

const Chip = ({ icon, label, color, onPress, testID }) => {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      onPress={onPress}
      style={[
        styles.chip,
        color ? { borderColor: color } : null,
        onPress ? styles.chipClickable : null,
      ]}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {!!icon && (
        <MaterialIcons
          name={icon}
          size={14}
          color={color || MUTED}
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[styles.chipText, color ? { color } : null]}>
        {label}
      </Text>
    </Wrap>
  );
};

const SectionCard = ({ accent, icon, title, children }) => (
  <View style={[styles.card, { borderTopColor: accent, borderTopWidth: 3 }]}>
    <View style={styles.cardHeader}>
      <MaterialIcons name={icon} size={18} color={accent} />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const Progress = ({ value }) => (
  <View style={styles.progressTrack}>
    <View
      style={[
        styles.progressFill,
        { width: `${Math.min(Math.max(value || 0, 0), 100)}%` },
      ]}
    />
  </View>
);

const ActivityHubScreen = () => {
  const navigation = useNavigation();
  const [openGames, setOpenGames] = useState([]);
  const [computeStatus, setComputeStatus] = useState(null);
  const [communityImpact, setCommunityImpact] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [gamesRes, computeRes, impactRes, challengesRes, streakRes] =
        await Promise.allSettled([
          gamesApi.list(),
          computeApi.status(),
          computeApi.communityImpact(),
          challengesApi.list({ status: 'active', limit: 3 }),
          resonanceApi.getStreak ? resonanceApi.getStreak() : Promise.reject(),
        ]);
      if (gamesRes.status === 'fulfilled') {
        const list = unwrap(gamesRes.value);
        setOpenGames(Array.isArray(list) ? list : []);
      }
      if (computeRes.status === 'fulfilled') {
        setComputeStatus(unwrap(computeRes.value) || {});
      }
      if (impactRes.status === 'fulfilled') {
        setCommunityImpact(unwrap(impactRes.value) || {});
      }
      if (challengesRes.status === 'fulfilled') {
        const list = unwrap(challengesRes.value);
        setChallenges(Array.isArray(list) ? list : []);
      }
      if (streakRes.status === 'fulfilled') {
        setStreak(unwrap(streakRes.value) || {});
      }
    } catch (_) {
      // Graceful degradation.
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const handleQuickMatch = useCallback(
    async (gameType) => {
      try {
        const res = await gamesApi.quickMatch({ game_type: gameType });
        const session = unwrap(res);
        if (session && session.id) {
          navigation.navigate('GameScreen', { gameId: session.id });
        }
      } catch (_) {
        // fall through silently
      }
    },
    [navigation],
  );

  const handleComputeToggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (computeStatus && computeStatus.opted_in) {
        await computeApi.optOut();
        setComputeStatus((prev) => ({ ...(prev || {}), opted_in: false }));
      } else {
        await computeApi.optIn();
        setComputeStatus((prev) => ({ ...(prev || {}), opted_in: true }));
      }
    } catch (_) {
      // keep prior state
    } finally {
      setToggling(false);
    }
  }, [computeStatus, toggling]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={ACCENT_GREEN} />
      </View>
    );
  }

  const optedIn = !!(computeStatus && computeStatus.opted_in);
  const tier = (computeStatus && computeStatus.visibility_tier) || 'standard';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={ACCENT_GREEN}
        />
      }
      testID="activity-hub-screen"
    >
      <Text style={styles.heading}>Activity Hub</Text>
      <Text style={styles.subtle}>Discover, play, contribute, grow.</Text>

      {/* Right Now */}
      <SectionCard accent={ACCENT} icon="bolt" title="Right Now">
        <View style={styles.chipsCol}>
          {openGames.length > 0 && (
            <Chip
              icon="sports-esports"
              label={`${openGames.length} open game${openGames.length > 1 ? 's' : ''} waiting`}
              color={ACCENT}
              onPress={() => navigation.navigate('GameHub')}
              testID="ah-chip-games"
            />
          )}
          {streak && streak.streak_days > 0 && (
            <Chip
              icon="local-fire-department"
              label={`${streak.streak_days}-day streak!`}
              color={ACCENT_AMBER}
              testID="ah-chip-streak"
            />
          )}
          {optedIn && (
            <Chip
              icon="memory"
              label={`Compute active — ${
                computeStatus.total_inferences || 0
              } inferences served`}
              color={ACCENT_GREEN}
              testID="ah-chip-compute"
            />
          )}
          {challenges.length > 0 && (
            <Chip
              icon="emoji-events"
              label={`${challenges.length} active challenge${challenges.length > 1 ? 's' : ''}`}
              color={ACCENT_PURPLE}
              onPress={() => navigation.navigate('Challenges')}
              testID="ah-chip-challenges"
            />
          )}
          {openGames.length === 0 &&
            (!streak || !streak.streak_days) &&
            !optedIn &&
            challenges.length === 0 && (
              <Text style={styles.body}>
                Nothing live right now — pull to refresh later.
              </Text>
            )}
        </View>
      </SectionCard>

      {/* Play */}
      <SectionCard accent={ACCENT_RED} icon="sports-esports" title="Play">
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            onPress={() => handleQuickMatch('trivia')}
            style={[styles.button, styles.primaryButton]}
            accessibilityRole="button"
            testID="ah-quick-trivia"
          >
            <MaterialIcons name="play-arrow" size={14} color="#FFF" />
            <Text style={styles.primaryButtonText}>Quick Match</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleQuickMatch('word_chain')}
            style={[styles.button, styles.outlineButton]}
            accessibilityRole="button"
            testID="ah-quick-word-chain"
          >
            <Text style={styles.outlineButtonText}>Word Chain</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleQuickMatch('collab_puzzle')}
            style={[styles.button, styles.outlineButton]}
            accessibilityRole="button"
            testID="ah-quick-collab-puzzle"
          >
            <Text style={styles.outlineButtonText}>Collab Puzzle</Text>
          </TouchableOpacity>
        </View>

        {openGames.length > 0 ? (
          openGames.slice(0, 3).map((g) => (
            <TouchableOpacity
              key={g.id}
              onPress={() =>
                navigation.navigate('GameScreen', { gameId: g.id })
              }
              style={styles.gameRow}
              accessibilityRole="button"
              testID={`ah-game-${g.id}`}
            >
              <View style={styles.gameRowLeft}>
                <MaterialIcons
                  name="sports-esports"
                  size={16}
                  color={MUTED}
                />
                <Text style={styles.gameRowText}>{g.game_type}</Text>
              </View>
              <View style={styles.miniChip}>
                <MaterialIcons name="group" size={11} color={MUTED} />
                <Text style={styles.miniChipText}>
                  {g.player_count || 0}/{g.max_players || 0}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.body}>No open games. Start one!</Text>
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate('Encounters')}
          style={[styles.linkButton]}
          accessibilityRole="button"
          testID="ah-bond"
        >
          <Text style={styles.linkText}>Challenge a bond</Text>
        </TouchableOpacity>
      </SectionCard>

      {/* Contribute */}
      <SectionCard accent={ACCENT_GREEN} icon="memory" title="Contribute">
        <View style={styles.toggleHeader}>
          <Text style={styles.body}>
            {optedIn ? 'Compute sharing is active' : 'Compute sharing is off'}
          </Text>
          <Switch
            value={optedIn}
            onValueChange={handleComputeToggle}
            disabled={toggling}
            trackColor={{ false: '#3a3a4e', true: 'rgba(0,232,157,0.4)' }}
            thumbColor={optedIn ? ACCENT_GREEN : '#bbb'}
            testID="ah-compute-toggle"
          />
        </View>

        {!optedIn ? (
          <View>
            <Text style={styles.body}>
              Your device runs small AI tasks when idle. You earn Spark.
              The community gets smarter.
            </Text>
            <TouchableOpacity
              onPress={handleComputeToggle}
              disabled={toggling}
              style={[styles.button, styles.outlineGreenButton]}
              accessibilityRole="button"
              testID="ah-compute-enable"
            >
              <Text style={styles.outlineGreenText}>
                Start sharing compute
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={styles.activeBanner}>
              <View style={styles.dot} />
              <Text style={styles.activeText}>Active — {tier} tier</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>GPU Hours</Text>
                <Text style={styles.statValue}>
                  {(computeStatus.gpu_hours_served || 0).toFixed(1)}
                </Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Inferences</Text>
                <Text style={styles.statValue}>
                  {computeStatus.total_inferences || 0}
                </Text>
              </View>
            </View>
          </View>
        )}

        {communityImpact && (
          <View style={styles.hiveLine}>
            <Text style={styles.hiveLineText}>
              Hive: {communityImpact.active_nodes || 0} nodes,{' '}
              {(communityImpact.total_gpu_hours || 0).toFixed(0)} GPU-hours,{' '}
              {communityImpact.total_inferences || 0} inferences
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate('ComputeDashboard')}
          style={styles.linkButton}
          accessibilityRole="button"
          testID="ah-compute-dashboard"
        >
          <Text style={styles.linkText}>View full dashboard</Text>
        </TouchableOpacity>
      </SectionCard>

      {/* Grow */}
      <SectionCard accent={ACCENT_PURPLE} icon="trending-up" title="Grow">
        {challenges.length > 0 ? (
          challenges.map((ch) => {
            const pct =
              ((ch.progress || 0) / (ch.target || 1)) * 100;
            return (
              <TouchableOpacity
                key={ch.id}
                onPress={() =>
                  navigation.navigate('ChallengeDetail', { id: ch.id })
                }
                style={styles.challengeBlock}
                accessibilityRole="button"
                testID={`ah-challenge-${ch.id}`}
              >
                <View style={styles.challengeHeader}>
                  <Text style={styles.challengeTitle}>{ch.name}</Text>
                  <View style={styles.miniChipOutline}>
                    <Text style={styles.miniChipText}>
                      {ch.challenge_type}
                    </Text>
                  </View>
                </View>
                <Progress value={pct} />
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.body}>
            No active challenges. Check back soon!
          </Text>
        )}
        <View style={styles.growLinks}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Challenges')}
            accessibilityRole="button"
            testID="ah-grow-challenges"
          >
            <Text style={styles.linkText}>All Challenges</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Achievements')}
            accessibilityRole="button"
            testID="ah-grow-achievements"
          >
            <Text style={styles.linkText}>Achievements</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ResonanceDashboard')}
            accessibilityRole="button"
            testID="ah-grow-resonance"
          >
            <Text style={styles.linkText}>Resonance</Text>
          </TouchableOpacity>
        </View>
      </SectionCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: wp('4%') },
  heading: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    marginBottom: hp('0.4%'),
  },
  subtle: { color: MUTED, fontSize: wp('3.2%'), marginBottom: hp('1.5%') },
  card: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('4%'),
    marginBottom: hp('1.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: hp('1%'),
  },
  cardTitle: { color: '#FFF', fontSize: wp('4%'), fontWeight: '600' },
  body: {
    color: MUTED,
    fontSize: wp('3.2%'),
    lineHeight: wp('4.6%'),
    marginBottom: hp('0.5%'),
  },
  chipsCol: { gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignSelf: 'flex-start',
  },
  chipClickable: { backgroundColor: 'rgba(108,99,255,0.08)' },
  chipText: { color: '#FFF', fontSize: wp('3%'), fontWeight: '600' },
  buttonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: hp('1%'),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.9%'),
    borderRadius: 8,
    gap: 4,
  },
  primaryButton: { backgroundColor: ACCENT },
  primaryButtonText: { color: '#FFF', fontSize: wp('3.2%'), fontWeight: '600' },
  outlineButton: {
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.4)',
  },
  outlineButtonText: { color: ACCENT, fontSize: wp('3.2%'), fontWeight: '600' },
  outlineGreenButton: {
    borderWidth: 1,
    borderColor: ACCENT_GREEN,
    alignSelf: 'flex-start',
    marginTop: hp('0.5%'),
  },
  outlineGreenText: {
    color: ACCENT_GREEN,
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp('0.7%'),
    paddingHorizontal: wp('2%'),
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 4,
  },
  gameRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gameRowText: { color: '#FFF', fontSize: wp('3.2%') },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 3,
  },
  miniChipOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  miniChipText: { color: MUTED, fontSize: wp('2.7%'), fontWeight: '600' },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('0.5%'),
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,232,157,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: hp('0.8%'),
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT_GREEN,
    shadowColor: ACCENT_GREEN,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  activeText: { color: ACCENT_GREEN, fontSize: wp('3.2%'), fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 24, marginBottom: hp('0.5%') },
  statBlock: { },
  statLabel: { color: MUTED, fontSize: wp('2.8%') },
  statValue: { color: '#FFF', fontSize: wp('3.6%'), fontWeight: '700', marginTop: 2 },
  hiveLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: hp('0.8%'),
    marginTop: hp('0.5%'),
  },
  hiveLineText: { color: MUTED, fontSize: wp('2.9%') },
  challengeBlock: { marginBottom: hp('1%') },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  challengeTitle: { color: '#FFF', fontSize: wp('3.4%'), fontWeight: '600' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  growLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: hp('1%'),
  },
  linkButton: { paddingVertical: hp('0.5%'), alignSelf: 'flex-start' },
  linkText: {
    color: ACCENT,
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
});

export default ActivityHubScreen;
