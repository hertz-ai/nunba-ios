/**
 * BackupSettingsScreen — RN parity for the web SPA's
 * landing-page/src/components/Social/Settings/BackupSettingsPage.jsx.
 *
 * Three sections, vertically stacked:
 *   1. Create Backup     — passphrase (8+ chars) + Backup button.
 *   2. Backup History    — list of prior encrypted backups with
 *                          per-row Restore action and a single shared
 *                          restore-passphrase TextInput below.
 *   3. Linked Devices    — list of devices linked to this user with
 *                          per-row Unlink (delete-icon) action.
 *
 * Backend (HARTOS — integrations/social/sync_api.py):
 *   POST   /api/social/sync/backup           — create encrypted backup
 *   GET    /api/social/sync/backup/metadata  — list backups (no plaintext)
 *   POST   /api/social/sync/restore          — restore by id + passphrase
 *   GET    /api/social/sync/devices          — list linked devices
 *   DELETE /api/social/sync/devices/<id>     — unlink a device
 *
 * Service: services/socialApi.js → syncApi.{createBackup,
 *   getBackupMetadata, restore, listDevices, unlinkDevice}.
 *
 * Privacy invariants (preserved verbatim from web SPA):
 *   - Passphrase never leaves the device unencrypted; the server
 *     stores ciphertext keyed by the user's passphrase.
 *   - Listing returns metadata only (size, version, timestamp) —
 *     never the encrypted blob.
 *   - Restore requires the same passphrase that created the backup.
 *   - Unlink revokes a paired device's session immediately.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
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
import { syncApi } from '../../../services/socialApi';

const ACCENT = '#6C63FF'; // Match Nunba MUI's purple for backup theming.
const ACCENT_GREEN = '#00e89d';
const ERR = '#ff6b6b';
const MUTED = '#888';
const SUCCESS = '#00e89d';

// HARTOS responses are payload-wrapped: {success, data: {...}}.
// Defensive read so flat responses (just the payload object) still work.
const unwrap = (res) => {
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

const BackupSettingsScreen = () => {
  const [backups, setBackups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null); // {type: 'success'|'error', text}

  const fetchData = useCallback(async () => {
    try {
      const [backupRes, deviceRes] = await Promise.allSettled([
        syncApi.getBackupMetadata(),
        syncApi.listDevices(),
      ]);
      if (backupRes.status === 'fulfilled') {
        const list = unwrap(backupRes.value);
        setBackups(Array.isArray(list) ? list : []);
      }
      if (deviceRes.status === 'fulfilled') {
        const list = unwrap(deviceRes.value);
        setDevices(Array.isArray(list) ? list : []);
      }
    } catch (_) {
      // Silent — banner only shown on user-initiated action failure.
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    })();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleBackup = useCallback(async () => {
    if (backupPassphrase.length < 8) {
      setMessage({
        type: 'error',
        text: 'Passphrase must be at least 8 characters.',
      });
      return;
    }
    setBacking(true);
    setMessage(null);
    try {
      const res = await syncApi.createBackup({ passphrase: backupPassphrase });
      const payload = unwrap(res) || {};
      const size = payload.size_bytes
        ? `${(payload.size_bytes / 1024).toFixed(1)} KB`
        : 'created';
      setMessage({ type: 'success', text: `Backup ${size}.` });
      setBackupPassphrase('');
      await fetchData();
    } catch (e) {
      setMessage({
        type: 'error',
        text: e?.message || 'Backup failed.',
      });
    } finally {
      setBacking(false);
    }
  }, [backupPassphrase, fetchData]);

  const handleRestore = useCallback(
    async (backupId) => {
      if (!restorePassphrase) {
        setMessage({
          type: 'error',
          text: 'Enter your backup passphrase to restore.',
        });
        return;
      }
      setRestoring(true);
      setMessage(null);
      try {
        const res = await syncApi.restore({
          passphrase: restorePassphrase,
          backup_id: backupId,
        });
        const d = unwrap(res) || {};
        setMessage({
          type: 'success',
          text:
            `Restored: ${d.posts || 0} posts, ${d.comments || 0} comments` +
            (d.profile ? ', profile updated.' : '.'),
        });
        setRestorePassphrase('');
      } catch (e) {
        setMessage({
          type: 'error',
          text: e?.message || 'Restore failed — wrong passphrase?',
        });
      } finally {
        setRestoring(false);
      }
    },
    [restorePassphrase],
  );

  const handleUnlink = useCallback(
    async (deviceId) => {
      try {
        await syncApi.unlinkDevice(deviceId);
        setMessage({ type: 'success', text: 'Device unlinked.' });
        await fetchData();
      } catch (e) {
        setMessage({
          type: 'error',
          text: e?.message || 'Failed to unlink device.',
        });
      }
    },
    [fetchData],
  );

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
      testID="backup-settings-screen"
    >
      <Text style={styles.heading}>Backup &amp; Sync</Text>
      <Text style={styles.subtle}>
        Encrypted backups, restore on any device, and the list of
        devices currently signed in to your account.
      </Text>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT_GREEN} />
        </View>
      )}

      {message && (
        <View
          style={[
            styles.banner,
            message.type === 'error' ? styles.bannerError : styles.bannerOk,
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.bannerText}>{message.text}</Text>
          <TouchableOpacity
            onPress={() => setMessage(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            testID="backup-banner-dismiss"
          >
            <MaterialIcons name="close" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Create Backup ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="cloud-upload" size={20} color={ACCENT} />
          <Text style={styles.cardTitle}>Create Backup</Text>
        </View>
        <Text style={styles.cardBody}>
          Your data is encrypted with your passphrase before storage.
          We cannot read it.
        </Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={backupPassphrase}
            onChangeText={setBackupPassphrase}
            placeholder="Backup passphrase (8+ chars)"
            placeholderTextColor={MUTED}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            testID="backup-passphrase-input"
          />
          <TouchableOpacity
            onPress={handleBackup}
            disabled={backing}
            style={[
              styles.button,
              styles.primaryButton,
              backing && styles.primaryButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create backup"
            testID="backup-create-button"
          >
            {backing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Backup</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Backup History ── */}
      {backups.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backup History</Text>
          {backups.map((b) => (
            <View key={b.id} style={styles.listRow} testID={`backup-row-${b.id}`}>
              <View style={styles.listRowText}>
                <Text style={styles.listPrimary}>
                  {b.created_at
                    ? new Date(b.created_at).toLocaleString()
                    : 'Unknown date'}
                </Text>
                <Text style={styles.listSecondary}>
                  {b.size_bytes
                    ? `${(b.size_bytes / 1024).toFixed(1)} KB`
                    : ''}
                  {b.size_bytes && b.backup_version ? ' · ' : ''}
                  {b.backup_version ? `v${b.backup_version}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRestore(b.id)}
                disabled={restoring}
                style={[styles.chip, restoring && styles.chipDisabled]}
                accessibilityRole="button"
                accessibilityLabel={`Restore backup from ${b.created_at}`}
                testID={`backup-restore-${b.id}`}
              >
                <MaterialIcons
                  name="cloud-download"
                  size={14}
                  color={ACCENT}
                />
                <Text style={styles.chipText}>Restore</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TextInput
            style={[styles.input, styles.inputFull]}
            value={restorePassphrase}
            onChangeText={setRestorePassphrase}
            placeholder="Passphrase to restore"
            placeholderTextColor={MUTED}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            testID="backup-restore-passphrase-input"
          />
          {restoring && (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.progressLabel}>Restoring…</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Linked Devices ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="devices-other" size={20} color={ACCENT} />
          <Text style={styles.cardTitle}>Linked Devices</Text>
        </View>
        {devices.length === 0 ? (
          <Text style={styles.cardBody}>
            No devices linked yet. Devices are linked automatically
            when you sign in.
          </Text>
        ) : (
          devices.map((d) => (
            <View
              key={d.id}
              style={styles.listRow}
              testID={`device-row-${d.id}`}
            >
              <View style={styles.listRowText}>
                <Text style={styles.listPrimary}>
                  {d.device_name || d.device_id}
                </Text>
                <Text style={styles.listSecondary}>
                  {d.platform || 'unknown'}
                  {d.linked_at
                    ? ` · linked ${new Date(d.linked_at).toLocaleDateString()}`
                    : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleUnlink(d.id)}
                accessibilityRole="button"
                accessibilityLabel={`Unlink ${d.device_name || d.device_id}`}
                testID={`device-unlink-${d.id}`}
                style={styles.iconButton}
              >
                <MaterialIcons name="delete" size={18} color={ERR} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.2%'),
    borderRadius: 8,
    marginBottom: hp('1.5%'),
  },
  bannerOk: { backgroundColor: 'rgba(0,232,157,0.15)' },
  bannerError: { backgroundColor: 'rgba(255,107,107,0.18)' },
  bannerText: { color: '#FFF', fontSize: wp('3.2%'), flex: 1, marginRight: 8 },
  card: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: wp('4%'),
    marginBottom: hp('1.8%'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.6%'),
  },
  cardTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '600',
    marginLeft: 8,
  },
  cardBody: {
    color: MUTED,
    fontSize: wp('3.2%'),
    marginBottom: hp('1.2%'),
    marginTop: hp('0.4%'),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.1%'),
    fontSize: wp('3.4%'),
  },
  inputFull: { marginTop: hp('1%') },
  button: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.1%'),
    borderRadius: 8,
    minWidth: wp('20%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: { backgroundColor: ACCENT },
  primaryButtonDisabled: { backgroundColor: 'rgba(108,99,255,0.5)' },
  primaryButtonText: { color: '#FFF', fontWeight: '600', fontSize: wp('3.4%') },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('0.9%'),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  listRowText: { flex: 1 },
  listPrimary: { color: '#FFF', fontSize: wp('3.4%') },
  listSecondary: { color: MUTED, fontSize: wp('2.9%'), marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.4)',
    borderRadius: 14,
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.5%'),
  },
  chipDisabled: { opacity: 0.5 },
  chipText: {
    color: ACCENT,
    fontSize: wp('3%'),
    marginLeft: 4,
    fontWeight: '600',
  },
  iconButton: { padding: 6 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1%'),
  },
  progressLabel: { color: MUTED, fontSize: wp('3%'), marginLeft: 6 },
});

export default BackupSettingsScreen;
