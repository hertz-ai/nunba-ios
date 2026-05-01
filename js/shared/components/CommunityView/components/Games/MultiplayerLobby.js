import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import { Clipboard } from 'react-native';

import { gamesApi } from '../../../../services/socialApi';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
} from '../../../../theme/colors';

// ---------------------------------------------------------------------------
// Helper: generate initials from a name or username
// ---------------------------------------------------------------------------
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// Deterministic avatar color from name
const AVATAR_COLORS = [
  '#6C63FF', '#FF6B6B', '#2ECC71', '#FFAB00', '#00B8D9',
  '#EC4899', '#8B5CF6', '#F59E0B', '#3B82F6', '#10B981',
];
const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ---------------------------------------------------------------------------
// States: idle | creating | waiting
// ---------------------------------------------------------------------------

const MultiplayerLobby = ({ multiplayer, onStartSolo, onGameStart, gameTitle }) => {
  const [lobbyState, setLobbyState] = useState('idle'); // idle | creating | waiting
  const [joinCode, setJoinCode] = useState('');
  const [session, setSession] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Derive participants from multiplayer or session
  const participants = multiplayer?.state?.players
    || session?.players
    || [];
  const sessionCode = session?.code || session?.session_code || session?.id || '';
  const displayCode = sessionCode ? sessionCode.slice(0, 8).toUpperCase() : '';
  const isHost = session?.is_host ?? (participants.length > 0 && participants[0]?.is_host);
  const maxPlayers = session?.max_players || 4;

  // ---- Actions ----

  const handleCreateRoom = useCallback(async () => {
    setLobbyState('creating');
    try {
      const res = await gamesApi.create({ mode: 'multiplayer' });
      const data = res.data || res;
      setSession(data);
      setLobbyState('waiting');
    } catch (e) {
      Alert.alert('Error', 'Failed to create room. Please try again.');
      setLobbyState('idle');
    }
  }, []);

  const handleQuickMatch = useCallback(async () => {
    setLobbyState('creating');
    try {
      const res = await gamesApi.quickMatch({});
      const data = res.data || res;
      if (data.id || data.session_id) {
        setSession(data);
        setLobbyState('waiting');
        // If game starts immediately
        if (data.status === 'playing' || data.status === 'in_progress') {
          if (onGameStart) onGameStart();
        }
      } else {
        setLobbyState('idle');
      }
    } catch (e) {
      Alert.alert('Error', 'No match found. Try creating a room instead.');
      setLobbyState('idle');
    }
  }, [onGameStart]);

  const handleJoinWithCode = useCallback(async () => {
    if (!joinCode.trim()) {
      Alert.alert('Enter Code', 'Please enter a session code to join.');
      return;
    }
    setLobbyState('creating');
    try {
      const res = await gamesApi.join(joinCode.trim());
      const data = res.data || res;
      setSession(data);
      setLobbyState('waiting');
    } catch (e) {
      Alert.alert('Error', 'Invalid code or room is full.');
      setLobbyState('idle');
    }
  }, [joinCode]);

  const handleCopyCode = useCallback(() => {
    if (displayCode) {
      Clipboard.setString(displayCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }, [displayCode]);

  const handleStartGame = useCallback(async () => {
    try {
      if (session?.id) {
        await gamesApi.start(session.id);
      }
      if (onGameStart) onGameStart();
    } catch (e) {
      Alert.alert('Error', 'Failed to start the game.');
    }
  }, [session, onGameStart]);

  const handleLeave = useCallback(async () => {
    try {
      if (session?.id) {
        await gamesApi.leave(session.id);
      }
    } catch (_) {}
    setSession(null);
    setLobbyState('idle');
  }, [session]);

  // ---- Idle state ----

  const renderIdle = () => (
    <Animatable.View animation="fadeInUp" style={styles.idleContainer}>
      <Icon name="gamepad-circle" size={64} color={colors.accent} />
      <Text style={styles.gameTitle}>{gameTitle}</Text>
      <Text style={styles.subtitle}>Choose how to play</Text>

      {/* Solo */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onStartSolo}
        activeOpacity={0.7}
      >
        <Icon name="account" size={22} color={colors.textPrimary} />
        <Text style={styles.actionBtnText}>Play Solo</Text>
      </TouchableOpacity>

      {/* Quick Match */}
      <TouchableOpacity
        style={[styles.actionBtn, styles.actionBtnAccent]}
        onPress={handleQuickMatch}
        activeOpacity={0.7}
      >
        <Icon name="lightning-bolt" size={22} color={colors.textPrimary} />
        <Text style={styles.actionBtnText}>Quick Match</Text>
      </TouchableOpacity>

      {/* Create Room */}
      <TouchableOpacity
        style={[styles.actionBtn, styles.actionBtnOutline]}
        onPress={handleCreateRoom}
        activeOpacity={0.7}
      >
        <Icon name="plus-circle-outline" size={22} color={colors.accent} />
        <Text style={[styles.actionBtnText, { color: colors.accent }]}>
          Create Room
        </Text>
      </TouchableOpacity>

      {/* Join with Code */}
      <View style={styles.joinRow}>
        <TextInput
          style={styles.joinInput}
          placeholder="Enter code"
          placeholderTextColor={colors.textMuted}
          value={joinCode}
          onChangeText={setJoinCode}
          autoCapitalize="characters"
          maxLength={12}
        />
        <TouchableOpacity
          style={styles.joinBtn}
          onPress={handleJoinWithCode}
          activeOpacity={0.7}
        >
          <Icon name="login" size={20} color={colors.textPrimary} />
          <Text style={styles.joinBtnText}>Join</Text>
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  // ---- Creating state (spinner) ----

  const renderCreating = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.creatingText}>Setting up your game...</Text>
    </View>
  );

  // ---- Waiting state ----

  const renderWaiting = () => (
    <Animatable.View animation="fadeInUp" style={styles.waitingContainer}>
      <Text style={styles.waitingTitle}>Waiting for Players</Text>

      {/* Session code */}
      {displayCode ? (
        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>Share this code:</Text>
          <TouchableOpacity
            style={styles.codeDisplay}
            onPress={handleCopyCode}
            activeOpacity={0.7}
          >
            <Text style={styles.codeText}>{displayCode}</Text>
            <Icon
              name={codeCopied ? 'check' : 'content-copy'}
              size={20}
              color={codeCopied ? colors.success : colors.textSecondary}
            />
          </TouchableOpacity>
          {codeCopied && (
            <Animatable.Text animation="fadeIn" style={styles.copiedText}>
              Copied!
            </Animatable.Text>
          )}
        </View>
      ) : null}

      {/* Player count */}
      <Text style={styles.playerCount}>
        {participants.length} / {maxPlayers} players
      </Text>

      {/* Participant avatars */}
      <View style={styles.avatarsRow}>
        {participants.map((player, idx) => {
          const name = player.username || player.name || `P${idx + 1}`;
          const bgColor = getAvatarColor(name);
          return (
            <Animatable.View
              key={player.id || idx}
              animation="bounceIn"
              delay={idx * 100}
              style={styles.avatarWrapper}
            >
              <View style={[styles.avatar, { backgroundColor: bgColor }]}>
                <Text style={styles.avatarText}>{getInitials(name)}</Text>
              </View>
              <Text style={styles.avatarName} numberOfLines={1}>
                {name}
              </Text>
              {player.is_host && (
                <Icon
                  name="crown"
                  size={14}
                  color={colors.pulse}
                  style={styles.crownIcon}
                />
              )}
            </Animatable.View>
          );
        })}

        {/* Empty slots */}
        {Array.from({ length: Math.max(0, maxPlayers - participants.length) }).map(
          (_, idx) => (
            <View key={`empty-${idx}`} style={styles.avatarWrapper}>
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Icon name="account-plus" size={20} color={colors.textMuted} />
              </View>
              <Text style={styles.avatarName}>Waiting...</Text>
            </View>
          ),
        )}
      </View>

      {/* Host Start button */}
      {isHost && (
        <TouchableOpacity
          style={[
            styles.startBtn,
            participants.length < 2 && styles.startBtnDisabled,
          ]}
          onPress={handleStartGame}
          disabled={participants.length < 2}
          activeOpacity={0.7}
        >
          <Icon name="play" size={22} color={colors.textPrimary} />
          <Text style={styles.startBtnText}>Start Game</Text>
        </TouchableOpacity>
      )}

      {!isHost && (
        <View style={styles.waitingHint}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.waitingHintText}>Waiting for host to start...</Text>
        </View>
      )}

      {/* Leave */}
      <TouchableOpacity
        style={styles.leaveBtn}
        onPress={handleLeave}
        activeOpacity={0.7}
      >
        <Icon name="exit-run" size={18} color={colors.error} />
        <Text style={styles.leaveBtnText}>Leave</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  // ---- Main render ----

  switch (lobbyState) {
    case 'creating':
      return renderCreating();
    case 'waiting':
      return renderWaiting();
    case 'idle':
    default:
      return renderIdle();
  }
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Idle
  idleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  gameTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  actionBtnAccent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderColor: colors.accent,
  },
  actionBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  joinRow: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  joinInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  joinBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },

  // Creating
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  creatingText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },

  // Waiting
  waitingContainer: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  waitingTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.lg,
  },

  // Code section
  codeSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  codeLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  codeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  codeText: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    fontFamily: 'monospace',
    letterSpacing: 4,
  },
  copiedText: {
    color: colors.success,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  // Player count
  playerCount: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.md,
  },

  // Avatars
  avatarsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatarWrapper: {
    alignItems: 'center',
    width: 72,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarEmpty: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  avatarName: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  crownIcon: {
    position: 'absolute',
    top: -4,
    right: 10,
  },

  // Start button
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.md,
  },
  startBtnDisabled: {
    backgroundColor: colors.backgroundTertiary,
    opacity: 0.6,
  },
  startBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },

  // Waiting hint
  waitingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  waitingHintText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },

  // Leave
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  leaveBtnText: {
    color: colors.error,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});

export default MultiplayerLobby;
