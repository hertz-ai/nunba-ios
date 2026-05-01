/**
 * IcebreakerDraftSheet — review-before-send modal for BLE encounter
 * icebreaker drafts.  RN parity for the web SPA's
 * landing-page/src/components/Social/Encounters/shared/IcebreakerDraftSheet.jsx
 * (commit a3398905, F2 GREENLIT).
 *
 * PRODUCT_MAP refs:
 *   J207  · /icebreaker/draft → returns 3 drafts + rationale + length
 *   J208  · central topology refuses without cloud_capability consent
 *   J209  · approve flips status to 'sent' (server-side mutation)
 *   J210  · decline records reason for agent learn-from-decline
 *
 * Architectural choice (mirrors web Option b): mounted ONCE at the
 * EncountersScreen level rather than per-card.  Single state machine,
 * single instance in the React tree.  Per-match dismiss is filtered
 * by the active `match.id` — but the WAMP peer-dismiss path is NOT
 * yet wired on RN (the native AutobahnConnectionManager doesn't
 * subscribe to com.hevolve.encounter.icebreaker.{userId} per #407
 * RN BLE native module backlog).  Until the native bridge lands, the
 * STATE.PEER_DISMISSED branch stays unreachable on RN — graceful
 * degrade, not a parallel path; the modal stays open until the user
 * closes it explicitly.  Documented inline at the WAMP-mount point.
 *
 * Mission-anchor enforcement (CLAUDE.md Gate 0 + project_encounter_icebreaker.md §1):
 *   1. AI never sends.  approveIcebreaker fires only on explicit Send
 *      onPress.  No auto-send code path anywhere.
 *   2. The user-edited TextInput value is what's POSTed to /approve,
 *      NOT the original LLM/template draft.  Editing is encouraged.
 *   3. Decline reasons feed the OPERATOR audit trail server-side
 *      (encounter_api.py:712-751); we send `{reason}` only.  Reason
 *      text never relays to peer.
 *   4. ENCOUNTER_DRAFT_MAX_CHARS (220) mirrors HARTOS
 *      core.constants.ENCOUNTER_DRAFT_MAX_CHARS — the SPA-side cap is
 *      defensive UI; server is authoritative (returns 413 if over).
 *   5. Marketing-as-spec linkage: title "Your icebreaker — review
 *      before sending" + footer "AI drafts. You decide. Always." are
 *      verbatim Scene 6 chyrons from
 *      marketing/video_stories/encounters.md.
 *
 * Backend chain (already shipped, citations are read-only refs):
 *   POST /api/social/encounter/icebreaker/draft   — encounter_api.py:638-664
 *   POST /api/social/encounter/icebreaker/approve — encounter_api.py:667-714
 *   POST /api/social/encounter/icebreaker/decline — encounter_api.py:717-751
 * Service: bleEncounterApi.draftIcebreaker / approveIcebreaker /
 *   declineIcebreaker (services/socialApi.js:285-294, RN parity for
 *   web 65084ae2 added in commit e432c5cc).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { bleEncounterApi } from '../../../../services/socialApi';

const ACCENT = '#00e89d';
const ERR = '#ff6b6b';
const WARN = '#f5a623';

// Inline SSOT — mirrors HARTOS core.constants.ENCOUNTER_DRAFT_MAX_CHARS
// (220).  Server is authoritative; this is the defensive UI cap.
const ENCOUNTER_DRAFT_MAX_CHARS = 220;
const WARN_RATIO = 0.8;

const STATE = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  SENDING: 'sending',
  SENT: 'sent',
  DECLINING: 'declining',
  SENT_DECLINE: 'sent_decline',
  ERROR: 'error',
  PEER_DISMISSED: 'peer_dismissed', // gated on RN WAMP bridge — see #407
});

const DECLINE_REASONS = ['Not feeling it', 'Already met', 'Too late', 'Other'];

const AUTO_CLOSE_SENT_MS = 1200;
const AUTO_CLOSE_DECLINE_MS = 2000;

const IcebreakerDraftSheet = ({ open, match, viewer, onClose, onSent }) => {
  const [state, setState] = useState(STATE.LOADING);
  const [drafts, setDrafts] = useState([]); // [primary, alt1, alt2]
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editedText, setEditedText] = useState('');
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const closeTimer = useRef(null);

  useEffect(
    () => () => {
      mounted.current = false;
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    },
    [],
  );

  // Reset + fetch draft whenever the modal opens for a new match.
  useEffect(() => {
    if (!open || !match?.id) return;
    let cancelled = false;
    setState(STATE.LOADING);
    setError(null);
    setDrafts([]);
    setSelectedIdx(0);
    setEditedText('');
    setRationale('');
    (async () => {
      try {
        const result = await bleEncounterApi.draftIcebreaker(match.id);
        if (cancelled || !mounted.current) return;
        const data = result?.data || {};
        const list = [data.draft, ...(Array.isArray(data.alt_drafts) ? data.alt_drafts : [])]
          .filter((s) => typeof s === 'string' && s.length > 0)
          .slice(0, 3);
        if (list.length === 0) {
          setError('No draft returned.');
          setState(STATE.ERROR);
          return;
        }
        setDrafts(list);
        setSelectedIdx(0);
        setEditedText(list[0]);
        setRationale(typeof data.rationale === 'string' ? data.rationale : '');
        setState(STATE.READY);
      } catch (e) {
        if (cancelled || !mounted.current) return;
        const msg = e?.message || 'Failed to load draft';
        setError(msg.includes('403') || msg.includes('cloud_capability')
          ? 'Cloud drafting is consent-gated. Grant cloud_capability in Privacy settings.'
          : `Couldn't load draft: ${msg}`);
        setState(STATE.ERROR);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, match?.id]);

  // Per F2 web: WAMP subscribe goes here — RN parity gated on #407.
  // Once AutobahnConnectionManager subscribes to
  // com.hevolve.encounter.icebreaker.{userId} and re-emits via
  // DeviceEventEmitter, this useEffect will subscribe + filter by
  // match.id and set STATE.PEER_DISMISSED.  Until then, peer-dismiss
  // is unreachable on RN — modal stays open until user closes.

  const handleSelectDraft = useCallback(
    (idx) => {
      if (state !== STATE.READY) return;
      setSelectedIdx(idx);
      setEditedText(drafts[idx] || '');
    },
    [state, drafts],
  );

  const charLen = editedText?.length || 0;
  const charOver = charLen > ENCOUNTER_DRAFT_MAX_CHARS;
  const charWarn =
    !charOver && charLen > Math.floor(ENCOUNTER_DRAFT_MAX_CHARS * WARN_RATIO);
  const sendDisabled =
    state !== STATE.READY ||
    !editedText ||
    editedText.trim().length === 0 ||
    charOver;

  const scheduleAutoClose = useCallback(
    (ms) => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => {
        if (mounted.current && onClose) onClose();
      }, ms);
    },
    [onClose],
  );

  const handleSend = useCallback(async () => {
    if (sendDisabled || !match?.id) return;
    setState(STATE.SENDING);
    setError(null);
    try {
      await bleEncounterApi.approveIcebreaker(match.id, editedText);
      if (!mounted.current) return;
      setState(STATE.SENT);
      if (typeof onSent === 'function') onSent(match);
      scheduleAutoClose(AUTO_CLOSE_SENT_MS);
    } catch (e) {
      if (!mounted.current) return;
      setError(e?.message || 'Failed to send icebreaker');
      setState(STATE.ERROR);
    }
  }, [sendDisabled, match, editedText, onSent, scheduleAutoClose]);

  const handleOpenDecline = useCallback(() => {
    if (state !== STATE.READY) return;
    setState(STATE.DECLINING);
  }, [state]);

  const handleDecline = useCallback(
    async (reason) => {
      if (!match?.id) return;
      setState(STATE.SENDING);
      setError(null);
      try {
        await bleEncounterApi.declineIcebreaker(match.id, reason);
        if (!mounted.current) return;
        setState(STATE.SENT_DECLINE);
        scheduleAutoClose(AUTO_CLOSE_DECLINE_MS);
      } catch (e) {
        if (!mounted.current) return;
        setError(e?.message || 'Failed to decline');
        setState(STATE.ERROR);
      }
    },
    [match, scheduleAutoClose],
  );

  const handleRetry = useCallback(() => {
    // Re-trigger the load effect by toggling a dependency: simplest
    // way is to ask parent to reopen.  But we can also re-run the
    // fetch inline by setting state to LOADING and replaying logic.
    // Keep it simple: reset to LOADING and let useEffect re-fetch on
    // next render via a parent open=false→true cycle.  For inline
    // retry, just re-fire the draft call here.
    if (!match?.id) return;
    setState(STATE.LOADING);
    setError(null);
    bleEncounterApi
      .draftIcebreaker(match.id)
      .then((result) => {
        if (!mounted.current) return;
        const data = result?.data || {};
        const list = [data.draft, ...(Array.isArray(data.alt_drafts) ? data.alt_drafts : [])]
          .filter((s) => typeof s === 'string' && s.length > 0)
          .slice(0, 3);
        if (list.length === 0) {
          setError('No draft returned.');
          setState(STATE.ERROR);
          return;
        }
        setDrafts(list);
        setSelectedIdx(0);
        setEditedText(list[0]);
        setRationale(typeof data.rationale === 'string' ? data.rationale : '');
        setState(STATE.READY);
      })
      .catch((e) => {
        if (!mounted.current) return;
        setError(e?.message || 'Retry failed');
        setState(STATE.ERROR);
      });
  }, [match]);

  const handleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (onClose) onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      testID="icebreaker-draft-sheet"
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Your icebreaker — review before sending</Text>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close icebreaker draft"
              style={styles.closeBtn}
            >
              <MaterialIcons name="close" size={22} color="#BBB" />
            </TouchableOpacity>
          </View>

          {state === STATE.LOADING && (
            <View style={styles.center} testID="icebreaker-state-loading">
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={styles.subtle}>Drafting…</Text>
            </View>
          )}

          {state === STATE.ERROR && (
            <View style={styles.center} testID="icebreaker-state-error">
              <MaterialIcons name="error-outline" size={32} color={ERR} />
              <Text style={styles.errorText}>{error}</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleClose}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleRetry}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {state === STATE.READY && (
            <ScrollView contentContainerStyle={styles.scroll}>
              {!!rationale && (
                <Text style={styles.rationale}>{rationale}</Text>
              )}
              {drafts.map((d, i) => (
                <Pressable
                  key={`draft-${i}`}
                  onPress={() => handleSelectDraft(i)}
                  style={[
                    styles.draftRow,
                    i === selectedIdx && styles.draftRowSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: i === selectedIdx }}
                  accessibilityLabel={`Draft option ${i + 1}`}
                  testID={`icebreaker-draft-option-${i}`}
                >
                  <MaterialIcons
                    name={
                      i === selectedIdx
                        ? 'radio-button-checked'
                        : 'radio-button-unchecked'
                    }
                    size={18}
                    color={i === selectedIdx ? ACCENT : '#888'}
                  />
                  <Text style={styles.draftText} numberOfLines={3}>
                    {d}
                  </Text>
                </Pressable>
              ))}

              <Text style={styles.editLabel}>Edit before sending:</Text>
              <TextInput
                value={editedText}
                onChangeText={setEditedText}
                multiline
                style={styles.editInput}
                placeholder="Edit your icebreaker"
                placeholderTextColor="#666"
                accessibilityLabel="Edit your icebreaker"
                testID="icebreaker-edit-input"
              />
              <Text
                style={[
                  styles.charCount,
                  charWarn && styles.charCountWarn,
                  charOver && styles.charCountOver,
                ]}
                accessibilityLiveRegion="polite"
              >
                {charLen} / {ENCOUNTER_DRAFT_MAX_CHARS}
              </Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleOpenDecline}
                  accessibilityRole="button"
                  accessibilityLabel="Decline"
                  testID="icebreaker-decline"
                >
                  <Text style={styles.secondaryButtonText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    sendDisabled && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={sendDisabled}
                  accessibilityRole="button"
                  accessibilityLabel="Send icebreaker"
                  accessibilityState={{ disabled: sendDisabled }}
                  testID="icebreaker-send"
                >
                  <Text style={styles.primaryButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.footer}>AI drafts. You decide. Always.</Text>
            </ScrollView>
          )}

          {state === STATE.SENDING && (
            <View style={styles.center} testID="icebreaker-state-sending">
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.subtle}>Sending…</Text>
            </View>
          )}

          {state === STATE.DECLINING && (
            <View style={styles.scroll} testID="icebreaker-state-declining">
              <Text style={styles.declinePrompt}>
                Why are you declining? (Logged for the agent — never sent
                to the other person.)
              </Text>
              {DECLINE_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.button, styles.secondaryButton, styles.reasonBtn]}
                  onPress={() => handleDecline(reason)}
                  accessibilityRole="button"
                  testID={`icebreaker-decline-${reason}`}
                >
                  <Text style={styles.secondaryButtonText}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {state === STATE.SENT && (
            <View style={styles.center} testID="icebreaker-state-sent">
              <MaterialIcons name="check-circle" size={32} color={ACCENT} />
              <Text style={styles.successText}>Sent.</Text>
            </View>
          )}

          {state === STATE.SENT_DECLINE && (
            <View style={styles.center} testID="icebreaker-state-sent-decline">
              <MaterialIcons name="cancel" size={32} color="#888" />
              <Text style={styles.subtle}>Declined.</Text>
            </View>
          )}

          {state === STATE.PEER_DISMISSED && (
            <View style={styles.center} testID="icebreaker-state-peer-dismissed">
              <Text style={styles.subtle}>The other person declined.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    maxHeight: hp('80%'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  title: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('4.2%'),
    fontWeight: '700',
  },
  closeBtn: { padding: 4 },
  scroll: { paddingBottom: hp('2%') },
  center: {
    paddingVertical: hp('4%'),
    alignItems: 'center',
  },
  subtle: { color: '#888', fontSize: wp('3.4%'), marginTop: hp('0.8%') },
  successText: {
    color: ACCENT,
    fontSize: wp('4%'),
    fontWeight: '700',
    marginTop: hp('0.8%'),
  },
  errorText: {
    color: ERR,
    fontSize: wp('3.4%'),
    marginTop: hp('0.8%'),
    textAlign: 'center',
    paddingHorizontal: wp('4%'),
  },
  rationale: {
    color: '#888',
    fontSize: wp('3%'),
    fontStyle: 'italic',
    marginBottom: hp('1%'),
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: hp('0.8%'),
    paddingHorizontal: wp('2%'),
    borderRadius: 8,
    marginBottom: hp('0.5%'),
    backgroundColor: '#2a2a3e',
  },
  draftRowSelected: { backgroundColor: 'rgba(0, 232, 157, 0.12)' },
  draftText: {
    flex: 1,
    color: '#EEE',
    fontSize: wp('3.4%'),
    marginLeft: wp('2%'),
    lineHeight: 18,
  },
  editLabel: {
    color: '#888',
    fontSize: wp('3%'),
    marginTop: hp('1%'),
    marginBottom: hp('0.5%'),
  },
  editInput: {
    color: '#FFF',
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1%'),
    fontSize: wp('3.6%'),
    minHeight: hp('10%'),
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#888',
    fontSize: wp('2.8%'),
    textAlign: 'right',
    marginTop: hp('0.4%'),
  },
  charCountWarn: { color: WARN },
  charCountOver: { color: ERR, fontWeight: '700' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: hp('1.5%'),
  },
  button: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    borderRadius: 8,
    marginLeft: wp('2%'),
    minWidth: wp('20%'),
    alignItems: 'center',
  },
  primaryButton: { backgroundColor: ACCENT },
  primaryButtonDisabled: { backgroundColor: '#3a3a4e' },
  primaryButtonText: { color: '#1a1a2e', fontWeight: '700', fontSize: wp('3.4%') },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  secondaryButtonText: { color: '#BBB', fontWeight: '600', fontSize: wp('3.4%') },
  reasonBtn: { marginLeft: 0, marginTop: hp('0.6%'), alignSelf: 'flex-start' },
  declinePrompt: {
    color: '#EEE',
    fontSize: wp('3.4%'),
    marginBottom: hp('1%'),
  },
  footer: {
    color: '#666',
    fontSize: wp('2.8%'),
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: hp('1.5%'),
  },
});

export default IcebreakerDraftSheet;
