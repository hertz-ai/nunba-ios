import React, {useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {kidsColors, kidsSpacing, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../theme/kidsColors';
import GameSounds from './shared/SoundManager';

const GameHeader = ({title, score, streak, questionsAnswered, totalQuestions, showTimer, timeLeft, onBack}) => {
  const navigation = useNavigation();
  const [isMuted, setIsMuted] = useState(GameSounds.isMuted());

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    GameSounds.setMuted(newMuted);
  }, [isMuted]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <Icon name="arrow-left" size={28} color={kidsColors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <View style={styles.statsRow}>
        {streak >= 3 && (
          <View style={styles.statBadge}>
            <Icon name="fire" size={18} color={kidsColors.streakFire} />
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        )}
        <View style={styles.statBadge}>
          <Icon name="star" size={18} color={kidsColors.star} />
          <Text style={styles.scoreText}>{score}</Text>
        </View>
        <TouchableOpacity
          onPress={toggleMute}
          style={styles.muteButton}
          accessibilityLabel={isMuted ? 'Unmute audio' : 'Mute audio'}
          accessibilityRole="button"
        >
          <Icon name={isMuted ? 'volume-off' : 'volume-high'} size={22} color={kidsColors.textSecondary} />
        </TouchableOpacity>
      </View>

      {totalQuestions > 0 && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {width: `${(questionsAnswered / totalQuestions) * 100}%`},
            ]}
          />
        </View>
      )}

      {showTimer && timeLeft !== undefined && (
        <View style={styles.timerBar}>
          <View
            style={[
              styles.timerFill,
              {width: `${timeLeft}%`},
              timeLeft < 25 && {backgroundColor: kidsColors.incorrect},
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: kidsColors.card,
    paddingHorizontal: kidsSpacing.md,
    paddingTop: kidsSpacing.sm,
    paddingBottom: kidsSpacing.sm,
    ...kidsShadows.card,
  },
  backButton: {
    position: 'absolute',
    left: kidsSpacing.md,
    top: kidsSpacing.sm,
    zIndex: 10,
    padding: kidsSpacing.xs,
  },
  title: {
    textAlign: 'center',
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    marginBottom: kidsSpacing.xs,
    paddingHorizontal: 50,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: kidsSpacing.md,
    marginBottom: kidsSpacing.xs,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: kidsColors.backgroundTertiary,
    paddingHorizontal: kidsSpacing.sm,
    paddingVertical: kidsSpacing.xs,
    borderRadius: 20,
  },
  streakText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.streakFire,
  },
  scoreText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.star,
  },
  muteButton: {
    padding: kidsSpacing.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: kidsColors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: kidsColors.accent,
    borderRadius: 3,
  },
  timerBar: {
    height: 4,
    backgroundColor: kidsColors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: kidsSpacing.xs,
  },
  timerFill: {
    height: '100%',
    backgroundColor: kidsColors.correct,
    borderRadius: 2,
  },
});

export default GameHeader;
