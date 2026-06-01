/**
 * InvitesScreen — Phase 7c.2 UI for community + conversation invites.
 *
 * Plan reference: sunny-gliding-eich.md, Part D.10 (compose + receive
 * wireframes) + Part E.9 (InviteService) + Part F.14 (route).
 *
 * Two views in one screen:
 *
 *   1. Incoming list — invites where I'm the invitee.  Each row shows
 *      who invited me, what they invited me to, and Accept / Reject
 *      buttons.  Backed by invitesApi.listIncoming.
 *
 *   2. Compose sheet — modal opened by the FAB.  Pick invitees via
 *      the shared MentionInput (multi-select via accumulator), pick a
 *      role, optionally flip to "anyone with link" mode (shareable
 *      invite_code; no targeted invitee_id).  Send fires
 *      invitesApi.send for each selected user, or once for the link.
 *
 * Style mirrors FriendsScreen / CommunitiesScreen so the social
 * surface stays visually coherent.  Backend is flag-gated server-side
 * by `invites_v2`; off → list returns [] via requires_flag(else_value=[])
 * and send returns 503.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator,
  Alert, Modal, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { invitesApi, mentionsApi } from '../../../services/socialApi';
import EmptyState from '../../shared/EmptyState';
import { emptyStatePreset } from '../../shared/emptyStatePresets';
import { flatListVirtualizationProps } from '../../shared/listPerf';
import useDebouncedCallback from '../../../hooks/useDebouncedCallback';

// Invite card row height: avatar(40) + subline + actions row + padding.
const INVITES_ROW_HEIGHT = 120;

const ROLES = [
  { key: 'member', label: 'Member' },
  { key: 'moderator', label: 'Moderator' },
  { key: 'admin', label: 'Admin' },
];

const InvitesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  // Route params let CommunityDetailScreen open this screen with the
  // compose modal pre-filled.  When unset the compose modal still
  // works but the user needs to type the parent_kind / parent_id.
  const {
    parent_kind: routeParentKind,
    parent_id: routeParentId,
    parent_name: routeParentName,
    open_compose: openComposeOnMount,
  } = route.params || {};

  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [composeOpen, setComposeOpen] = useState(Boolean(openComposeOnMount));
  const [selectedInvitees, setSelectedInvitees] = useState([]); // [{id, username, display_name}]
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [role, setRole] = useState('member');
  const [shareableLink, setShareableLink] = useState(false);
  const [sending, setSending] = useState(false);

  // ── Incoming list ────────────────────────────────────────────────

  const fetchIncoming = useCallback(async () => {
    try {
      const r = await invitesApi.listIncoming();
      setIncoming(r?.data || []);
    } catch (_) {
      // Flag-off or network — list stays empty, the empty-state UI fires.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIncoming(); }, [fetchIncoming]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchIncoming();
    setRefreshing(false);
  }, [fetchIncoming]);

  const handleAccept = (inviteId) => async () => {
    setBusyId(inviteId);
    try {
      await invitesApi.accept(inviteId);
      await fetchIncoming();
    } catch (e) {
      Alert.alert('Could not accept', e?.error || e?.message || 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = (inviteId) => async () => {
    setBusyId(inviteId);
    try {
      await invitesApi.reject(inviteId);
      await fetchIncoming();
    } catch (e) {
      Alert.alert('Could not reject', e?.error || e?.message || 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Compose: invitee search via mentionsApi.autocomplete ────────

  // UX-AUDIT 2026-05-19: replaced inline useEffect+setTimeout debounce
  // with the shared useDebouncedCallback hook (DRY — same hook used by
  // SearchScreen / DebouncedSearch / AutoSuggestInput / KidsHub /
  // MarketplaceScreen). 200 ms cadence preserved.
  const debouncedAutocomplete = useDebouncedCallback(async (q, selected) => {
    setSearching(true);
    try {
      const r = await mentionsApi.autocomplete(q, {
        kind: 'human',  // invites to humans only — agents need AgentJoinGrant
        limit: 8,
      });
      const got = (r?.data || []).filter(
        u => !selected.find(s => s.id === u.id),
      );
      setSearchResults(got);
    } catch (_) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, 200);

  useEffect(() => {
    if (!searchQuery.trim() || shareableLink) {
      setSearchResults([]);
      return;
    }
    debouncedAutocomplete(searchQuery.trim(), selectedInvitees);
  }, [searchQuery, selectedInvitees, shareableLink, debouncedAutocomplete]);

  const addInvitee = (user) => {
    setSelectedInvitees(prev =>
      prev.find(s => s.id === user.id) ? prev : [...prev, user]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeInvitee = (userId) => {
    setSelectedInvitees(prev => prev.filter(s => s.id !== userId));
  };

  const closeCompose = () => {
    setComposeOpen(false);
    setSelectedInvitees([]);
    setSearchQuery('');
    setSearchResults([]);
    setShareableLink(false);
    setRole('member');
  };

  const handleSend = async () => {
    if (!routeParentKind || !routeParentId) {
      Alert.alert(
        'Missing context',
        'Open this screen from a community or conversation first.');
      return;
    }
    if (!shareableLink && selectedInvitees.length === 0) {
      Alert.alert('Pick at least one person', 'Or switch to Anyone with link.');
      return;
    }
    setSending(true);
    try {
      if (shareableLink) {
        // Single shareable invite — server returns invite_code we can
        // share via OS share sheet.
        const r = await invitesApi.send({
          parent_kind: routeParentKind,
          parent_id: routeParentId,
          role_offered: role,
          expires_in_days: 7,
        });
        const code = r?.data?.invite_code;
        if (code) {
          const url = `https://hevolve.ai/i/${code}`;
          try {
            await Share.share({ message: url, url });
          } catch (_) { /* user cancelled share sheet */ }
        }
      } else {
        // Targeted invites — one POST per invitee.  We don't bail on
        // the first failure; record failures and report the count.
        const results = await Promise.allSettled(
          selectedInvitees.map(u => invitesApi.send({
            parent_kind: routeParentKind,
            parent_id: routeParentId,
            invitee_id: u.id,
            role_offered: role,
          })),
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
          Alert.alert(
            'Some invites failed',
            `${selectedInvitees.length - failed} sent, ${failed} failed.`);
        }
      }
      closeCompose();
      await fetchIncoming();
    } catch (e) {
      Alert.alert('Could not send', e?.error || e?.message || 'Try again.');
    } finally {
      setSending(false);
    }
  };

  // ── Renderers ────────────────────────────────────────────────────

  const renderIncoming = ({ item, index }) => {
    const inviter = item.invited_by_user || {};
    const target = item.parent_name
      || (item.parent_kind === 'community' ? 'a community' : 'a conversation');
    return (
      <Animatable.View animation="fadeInUp" delay={index * 30}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {((inviter.display_name || inviter.username || '?')
                  .trim().slice(0, 2).toUpperCase())}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>
                {inviter.display_name || inviter.username || 'Someone'}
              </Text>
              <Text style={styles.subline}>
                invited you to {target}
                {item.role_offered ? ` as ${item.role_offered}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleAccept(item.id)}
              disabled={busyId === item.id}
            >
              <Ionicons name="checkmark" size={16} color="#000000" />
              <Text style={styles.primaryBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={handleReject(item.id)}
              disabled={busyId === item.id}
            >
              <Text style={styles.ghostBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animatable.View>
    );
  };

  const renderInviteeChip = (u) => (
    <TouchableOpacity
      key={u.id}
      style={styles.chip}
      onPress={() => removeInvitee(u.id)}
      accessibilityLabel={`Remove ${u.display_name || u.username}`}
    >
      <Text style={styles.chipText}>
        {u.display_name || u.username || 'User'}
      </Text>
      <Ionicons name="close" size={14} color="#888" />
    </TouchableOpacity>
  );

  // ── Layout ───────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invites</Text>
        <TouchableOpacity
          style={styles.composeBtn}
          onPress={() => setComposeOpen(true)}
          accessibilityLabel="Compose new invite"
        >
          <Ionicons name="add" size={22} color="#000000" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={incoming}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderIncoming}
          // UX-AUDIT 2026-05-19: P7 preset + P10 virtualization wires.
          ListEmptyComponent={
            <EmptyState
              {...emptyStatePreset('no-invites')}
              onCta={() => setComposeOpen(true)}
              ctaLabel="Send an invite"
            />
          }
          {...flatListVirtualizationProps(INVITES_ROW_HEIGHT)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6C63FF"
            />
          }
        />
      )}

      {/* Compose modal */}
      <Modal
        visible={composeOpen}
        animationType="slide"
        transparent
        onRequestClose={closeCompose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeCompose}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                Invite to {routeParentName ? `#${routeParentName}` : 'community'}
              </Text>
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnBusy]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.sendBtnText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Mode toggle: targeted vs shareable */}
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, !shareableLink && styles.modeBtnActive]}
                onPress={() => setShareableLink(false)}
              >
                <Ionicons
                  name="people-outline" size={14}
                  color={!shareableLink ? '#000000' : '#888'} />
                <Text style={[
                  styles.modeBtnText,
                  !shareableLink && styles.modeBtnTextActive,
                ]}>
                  Specific people
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, shareableLink && styles.modeBtnActive]}
                onPress={() => setShareableLink(true)}
              >
                <Ionicons
                  name="link-outline" size={14}
                  color={shareableLink ? '#000000' : '#888'} />
                <Text style={[
                  styles.modeBtnText,
                  shareableLink && styles.modeBtnTextActive,
                ]}>
                  Anyone with link
                </Text>
              </TouchableOpacity>
            </View>

            {/* Invitee picker — only when targeted mode */}
            {!shareableLink && (
              <>
                <View style={styles.chipsRow}>
                  {selectedInvitees.map(renderInviteeChip)}
                </View>
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={18} color="#888" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by username…"
                    placeholderTextColor="#666"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {searching ? (
                    <ActivityIndicator size="small" color="#6C63FF" />
                  ) : null}
                </View>
                {searchResults.length > 0 ? (
                  <View style={styles.suggestList}>
                    {searchResults.map(u => (
                      <TouchableOpacity
                        key={u.id}
                        style={styles.suggestRow}
                        onPress={() => addInvitee(u)}
                      >
                        <View style={styles.avatarSmall}>
                          <Text style={styles.avatarSmallText}>
                            {((u.display_name || u.username || '?')
                              .trim().slice(0, 2).toUpperCase())}
                          </Text>
                        </View>
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.suggestName}>
                            {u.display_name || u.username}
                          </Text>
                          {u.username ? (
                            <Text style={styles.suggestHandle}>
                              @{u.username}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </>
            )}

            {/* Role picker */}
            <Text style={styles.sectionLabel}>Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleBtn, role === r.key && styles.roleBtnActive]}
                  onPress={() => setRole(r.key)}
                >
                  <Text style={[
                    styles.roleBtnText,
                    role === r.key && styles.roleBtnTextActive,
                  ]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {shareableLink ? (
              <Text style={styles.helperText}>
                A 7-day link will be generated.  Anyone who taps it can join
                with the role above (subject to community privacy).
              </Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%'),
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1, color: '#FFF', fontSize: wp('5%'),
    fontWeight: '700', textAlign: 'center',
  },
  composeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
  },

  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  card: {
    backgroundColor: '#141225', borderRadius: 12,
    padding: wp('4%'), marginBottom: hp('1%'),
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#6C63FF22',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#6C63FF', fontSize: wp('3.6%'), fontWeight: '700' },
  name: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700' },
  subline: { color: '#888', fontSize: wp('3%'), marginTop: 2 },

  actionsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#6C63FF', paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'), borderRadius: 20, gap: 4,
  },
  primaryBtnText: { color: '#000000', fontWeight: '700', fontSize: wp('3%') },
  ghostBtn: {
    paddingHorizontal: wp('4%'), paddingVertical: hp('0.8%'),
    borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A',
  },
  ghostBtnText: { color: '#FFF', fontWeight: '600', fontSize: wp('3%') },

  centerContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: hp('15%'), paddingHorizontal: wp('8%'),
  },
  emptyText: {
    color: '#AAA', fontSize: wp('3.8%'),
    marginTop: hp('2%'), fontWeight: '600',
  },
  emptySubtext: {
    color: '#666', fontSize: wp('3.2%'),
    marginTop: 6, textAlign: 'center',
  },

  // Compose modal
  modalRoot: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#141225',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: wp('4%'),
    paddingBottom: hp('4%'),
    minHeight: hp('60%'),
    borderTopWidth: 1, borderColor: '#2A2A2A',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: hp('1%'),
  },
  modalTitle: {
    flex: 1, color: '#FFF', fontSize: wp('4.2%'),
    fontWeight: '700', marginLeft: 12,
  },
  sendBtn: {
    paddingHorizontal: wp('5%'), paddingVertical: hp('0.8%'),
    backgroundColor: '#6C63FF', borderRadius: 20,
  },
  sendBtnBusy: { opacity: 0.6 },
  sendBtnText: { color: '#000000', fontWeight: '700', fontSize: wp('3.2%') },

  modeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    paddingVertical: hp('1%'), borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  modeBtnActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  modeBtnText: { color: '#888', fontSize: wp('3.2%'), fontWeight: '600' },
  modeBtnTextActive: { color: '#000000' },

  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#2A2A2A', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12,
  },
  chipText: { color: '#FFF', fontSize: wp('3%'), fontWeight: '600' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#000000', borderRadius: 12,
    paddingHorizontal: wp('3%'), paddingVertical: hp('1%'),
    marginTop: 12, borderWidth: 1, borderColor: '#2A2A2A', gap: 8,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: wp('3.4%') },

  suggestList: {
    marginTop: 8, backgroundColor: '#000000',
    borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
    paddingVertical: 4,
  },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp('3%'), paddingVertical: hp('1%'),
  },
  avatarSmall: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#6C63FF22',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarSmallText: { color: '#6C63FF', fontSize: wp('3%'), fontWeight: '700' },
  suggestName: { color: '#FFF', fontSize: wp('3.4%'), fontWeight: '600' },
  suggestHandle: { color: '#888', fontSize: wp('2.8%') },

  sectionLabel: {
    color: '#888', fontSize: wp('3%'),
    marginTop: 16, marginBottom: 8, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleBtn: {
    flex: 1, paddingVertical: hp('1%'), borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center',
  },
  roleBtnActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  roleBtnText: { color: '#FFF', fontSize: wp('3.2%'), fontWeight: '600' },
  roleBtnTextActive: { color: '#000000' },

  helperText: {
    color: '#888', fontSize: wp('2.8%'),
    marginTop: 12, lineHeight: 18,
  },
});

export default InvitesScreen;
