/**
 * PrivacySettingsScreen — RN parity for the web SPA's
 * landing-page/src/components/Social/Settings/PrivacySettingsPage.jsx
 * (commit 9d6e45e0 / F3 GREENLIT).  PRODUCT_MAP J208.
 *
 * Append-only cloud-capability consent UX:
 *   - List active + revoked consents (newest first).  Audit trail
 *     visible by design — revoke does NOT hide the row.
 *   - Per scope: Grant button (with 18+ + I-understand for
 *     encounter_icebreaker scope per encounter_api.py:332 server
 *     gate) / Revoke button if currently active.
 *   - Re-grant after revoke creates a NEW row server-side; UI
 *     refreshes the list to show the chronological audit trail.
 *
 * Mission anchors (project_encounter_icebreaker.md §1):
 *   1. Append-only HISTORY visible — never let the UI suggest revoke
 *      "deletes" the consent.
 *   2. Re-grant produces a NEW row.  UI refreshes list after every
 *      action so the row count visibly grows.
 *   3. 18+ defense-in-depth on encounter_icebreaker scope.  Defaults
 *      UNCHECKED on every dialog open — never persisted (mirrors the
 *      DiscoverableTogglePanel anchor 1 pattern).
 *   4. Privacy-first copy: "Drafts run locally without it" framing
 *      makes consent feel like an opt-in, not friction.
 *
 * Backend chain (HARTOS, JWT-only writes):
 *   GET    /api/social/consent           — list user's consents
 *   POST   /api/social/consent           — grant (append-only)
 *   POST   /api/social/consent/revoke    — revoke (sets revoked_at)
 * Service: consentApi.list / grant / revoke (services/socialApi.js,
 *   added in commit BELOW).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { consentApi } from '../../../services/socialApi';

const ACCENT = '#00e89d';
const ERR = '#ff6b6b';
const MUTED = '#888';

// Scope catalog — UI-side mirror of HARTOS server-side enum.
// `requiresAge18` = encounter-design constraint (server enforces
// independently per encounter_api.py:332).  Add new scopes here as
// the cloud_capability surface expands.
const CLOUD_SCOPES = [
  {
    scope: '*',
    label: 'All cloud capabilities',
    description:
      'Allow any cloud-backed AI feature on this account. You can revoke at any time.',
    requiresAge18: false,
  },
  {
    scope: 'encounter_icebreaker',
    label: 'Icebreaker drafting via cloud LLM',
    description:
      'Generate icebreaker openers using a cloud LLM at central topology nodes. Drafts run locally without it.',
    requiresAge18: true,
  },
  // ── UNIF-G6: external-room agent presence (parity with web
  // landing-page/src/.../cloudCapabilityScopes.js).  All three
  // honor HIVE MISSION: agent ALWAYS announces presence.
  {
    scope: 'agent_joins_external_room',
    label: 'AI joins external rooms',
    description:
      'AI agent participates in an external room (Discord audio / Teams meet / WhatsApp group / Reddit voice / etc.) to take notes / answer / co-pilot. Always announces presence — never silent.',
    requiresAge18: false,
  },
  {
    scope: 'agent_listens_external_audio',
    label: 'AI listens to external voice rooms',
    description:
      'AI agent transcribes external voice rooms into your knowledge graph. Always announces presence first.',
    requiresAge18: false,
  },
  {
    scope: 'agent_writes_external_room',
    label: 'AI posts in external rooms on your behalf',
    description:
      'AI agent posts on your behalf when you ask. Each post is attributed to your agent and visible in audit log.',
    requiresAge18: false,
  },
];

const formatTs = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const PrivacySettingsScreen = () => {
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [grantDialog, setGrantDialog] = useState(null); // scope object or null
  const [understood, setUnderstood] = useState(false);
  const [age18, setAge18] = useState(false);
  const [revokeDialog, setRevokeDialog] = useState(null); // consent row or null

  const fetchConsents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await consentApi.list();
      // Server returns {success, data: {consents:[...]}} per HARTOS
      // consent_api list endpoint.  Defensive: also accept bare data
      // array for forward-compat.
      const data = result?.data;
      const list = Array.isArray(data?.consents)
        ? data.consents
        : Array.isArray(data)
          ? data
          : [];
      setConsents(list);
    } catch (e) {
      setError(`Couldn't load consents: ${e?.message || 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  const isScopeActive = useCallback(
    (scope) =>
      consents.some(
        (c) => c.scope === scope && c.granted && !c.revoked_at,
      ),
    [consents],
  );

  const openGrantDialog = useCallback((scopeDef) => {
    // ANCHOR 3: 18+ + I-understand defaults UNCHECKED on every open.
    setUnderstood(false);
    setAge18(false);
    setGrantDialog(scopeDef);
  }, []);

  const closeGrantDialog = useCallback(() => {
    setGrantDialog(null);
    setUnderstood(false);
    setAge18(false);
  }, []);

  const handleGrant = useCallback(async () => {
    if (!grantDialog) return;
    setSubmitting(true);
    try {
      await consentApi.grant({
        consent_type: 'cloud_capability',
        scope: grantDialog.scope,
      });
      closeGrantDialog();
      await fetchConsents();
    } catch (e) {
      setError(`Grant failed: ${e?.message || 'unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }, [grantDialog, closeGrantDialog, fetchConsents]);

  const handleRevoke = useCallback(async () => {
    if (!revokeDialog) return;
    setSubmitting(true);
    try {
      await consentApi.revoke({
        consent_type: revokeDialog.consent_type,
        scope: revokeDialog.scope,
      });
      setRevokeDialog(null);
      await fetchConsents();
    } catch (e) {
      setError(`Revoke failed: ${e?.message || 'unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }, [revokeDialog, fetchConsents]);

  const grantBtnDisabled =
    submitting ||
    !understood ||
    (grantDialog?.requiresAge18 && !age18);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="privacy-settings-screen"
    >
      <Text style={styles.heading}>Privacy &amp; cloud capabilities</Text>
      <Text style={styles.subtle}>
        Grant or revoke cloud-AI features. Every change is recorded — your
        audit history is shown below.
      </Text>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      )}

      {error && (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      {!loading &&
        CLOUD_SCOPES.map((s) => {
          const active = isScopeActive(s.scope);
          return (
            <View key={s.scope} style={styles.scopeCard}>
              <View style={styles.scopeHeader}>
                <Text style={styles.scopeLabel}>{s.label}</Text>
                <View
                  style={[styles.statusPill, active ? styles.pillActive : styles.pillRevoked]}
                  accessibilityRole="text"
                  accessibilityLiveRegion="polite"
                >
                  <Text style={styles.statusPillText}>
                    {active ? 'Active' : 'Off'}
                  </Text>
                </View>
              </View>
              <Text style={styles.scopeDesc}>{s.description}</Text>
              {active ? (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => {
                    const row = consents.find(
                      (c) => c.scope === s.scope && c.granted && !c.revoked_at,
                    );
                    if (row) setRevokeDialog(row);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Revoke ${s.label}`}
                  testID={`consent-revoke-${s.scope}`}
                >
                  <Text style={styles.secondaryButtonText}>Revoke</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={() => openGrantDialog(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Grant ${s.label}`}
                  testID={`consent-grant-${s.scope}`}
                >
                  <Text style={styles.primaryButtonText}>Grant</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

      {/* Audit history — append-only.  Visibility is the feature. */}
      {!loading && consents.length > 0 && (
        <View style={styles.auditWrap} testID="consent-audit-history">
          <Text style={styles.auditHeader}>Audit history</Text>
          {consents.map((row) => (
            <View key={row.id} style={styles.auditRow}>
              <Text style={styles.auditScope}>
                {row.scope}
                {' · '}
                {row.revoked_at ? 'Revoked' : 'Active'}
              </Text>
              <Text style={styles.auditTs}>
                Granted {formatTs(row.granted_at)}
                {row.revoked_at ? ` · Revoked ${formatTs(row.revoked_at)}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Grant confirmation dialog — 18+ + I-understand checkboxes
          for sensitive scopes. */}
      <Modal
        visible={!!grantDialog}
        animationType="fade"
        transparent
        onRequestClose={closeGrantDialog}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialog} testID="consent-grant-dialog">
            <Text style={styles.dialogTitle}>
              Grant {grantDialog?.label}
            </Text>
            <Text style={styles.dialogBody}>{grantDialog?.description}</Text>
            <TouchableOpacity
              onPress={() => setUnderstood((v) => !v)}
              style={styles.checkboxRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: understood }}
              accessibilityLabel="I understand"
            >
              <MaterialIcons
                name={understood ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={understood ? ACCENT : MUTED}
              />
              <Text style={styles.checkboxLabel}>I understand</Text>
            </TouchableOpacity>
            {grantDialog?.requiresAge18 && (
              <TouchableOpacity
                onPress={() => setAge18((v) => !v)}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: age18 }}
                accessibilityLabel="I am 18 or older"
              >
                <MaterialIcons
                  name={age18 ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={age18 ? ACCENT : MUTED}
                />
                <Text style={styles.checkboxLabel}>I am 18 or older</Text>
              </TouchableOpacity>
            )}
            <View style={styles.dialogActions}>
              <TouchableOpacity
                onPress={closeGrantDialog}
                style={[styles.button, styles.secondaryButton]}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleGrant}
                style={[
                  styles.button,
                  styles.primaryButton,
                  grantBtnDisabled && styles.primaryButtonDisabled,
                ]}
                disabled={grantBtnDisabled}
                accessibilityRole="button"
                accessibilityLabel="Confirm grant"
                accessibilityState={{ disabled: grantBtnDisabled }}
                testID="consent-grant-confirm"
              >
                <Text style={styles.primaryButtonText}>Grant</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Revoke confirmation dialog. */}
      <Modal
        visible={!!revokeDialog}
        animationType="fade"
        transparent
        onRequestClose={() => setRevokeDialog(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialog} testID="consent-revoke-dialog">
            <Text style={styles.dialogTitle}>Revoke this consent?</Text>
            <Text style={styles.dialogBody}>
              Disables {revokeDialog?.scope} immediately. Your audit
              history keeps the record. You can re-grant later if you
              change your mind.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                onPress={() => setRevokeDialog(null)}
                style={[styles.button, styles.secondaryButton]}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRevoke}
                style={[styles.button, styles.primaryButton]}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Confirm revoke"
                testID="consent-revoke-confirm"
              >
                <Text style={styles.primaryButtonText}>Revoke</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: wp('4%') },
  heading: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    marginBottom: hp('0.6%'),
  },
  subtle: { color: MUTED, fontSize: wp('3.2%'), marginBottom: hp('1.5%') },
  center: { paddingVertical: hp('4%'), alignItems: 'center' },
  errorText: { color: ERR, fontSize: wp('3.2%'), marginVertical: hp('1%') },
  scopeCard: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('3.5%'),
    marginBottom: hp('1.2%'),
  },
  scopeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  scopeLabel: { flex: 1, color: '#FFF', fontSize: wp('3.6%'), fontWeight: '600' },
  scopeDesc: { color: MUTED, fontSize: wp('3%'), marginBottom: hp('1%') },
  statusPill: {
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.3%'),
    borderRadius: 8,
  },
  pillActive: { backgroundColor: 'rgba(0, 232, 157, 0.18)' },
  pillRevoked: { backgroundColor: 'rgba(136, 136, 136, 0.18)' },
  statusPillText: { color: '#FFF', fontSize: wp('2.6%'), fontWeight: '600' },
  button: {
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 8,
    alignSelf: 'flex-start',
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
  auditWrap: { marginTop: hp('2%') },
  auditHeader: {
    color: '#FFF',
    fontSize: wp('3.6%'),
    fontWeight: '600',
    marginBottom: hp('0.6%'),
  },
  auditRow: {
    paddingVertical: hp('0.6%'),
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  auditScope: { color: '#EEE', fontSize: wp('3.2%') },
  auditTs: { color: MUTED, fontSize: wp('2.6%'), marginTop: 2 },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  dialog: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: wp('4%'),
    width: '100%',
    maxWidth: 480,
  },
  dialogTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('0.8%'),
  },
  dialogBody: { color: '#EEE', fontSize: wp('3.2%'), marginBottom: hp('1.5%') },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.6%'),
  },
  checkboxLabel: { color: '#EEE', fontSize: wp('3.2%'), marginLeft: wp('2%') },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: hp('1.2%'),
  },
});

export default PrivacySettingsScreen;
