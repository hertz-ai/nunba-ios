import React, {useEffect, useRef, useCallback, useMemo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Animated, Share, Easing} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {kidsColors, kidsSpacing, kidsFontSize, kidsFontWeight, kidsBorderRadius, kidsShadows} from '../../../../theme/kidsColors';
import GameSounds from './shared/SoundManager';
import MediaCacheManager from './shared/MediaCacheManager';
import {getGameTheme, SPRINGS} from './shared/gameThemes';

/**
 * GameComplete - Bespoke win celebration screen per game template.
 *
 * Each template type gets a unique celebration animation driven by
 * the game theme registry's `celebrationType` and visual tokens.
 */
const GameComplete = ({templateType, result: resultProp, onPlayAgain, onHome}) => {
  const result = resultProp || {correct: 0, total: 0, stars: 0, bestStreak: 0, accuracy: 0};
  const navigation = useNavigation();
  const theme = useMemo(() => getGameTheme(templateType || 'MultipleChoice'), [templateType]);

  // Shared animations
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const starsAnim = useRef(new Animated.Value(0)).current;
  // Celebration-specific
  const celebAnims = useRef(Array.from({length: 6}).map(() => new Animated.Value(0))).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  const accuracy = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;

  useEffect(() => {
    const seq = getCelebrationSequence(theme.celebrationType, {
      scaleAnim, starsAnim, celebAnims, iconRotate, iconScale,
    });
    Animated.sequence(seq).start();

    // Audio
    const celebrationKey = result.isPerfect ? 'sfx_perfect' : 'sfx_complete';
    MediaCacheManager.get(celebrationKey).then(path => {
      if (path) GameSounds.startBackgroundMusic(path, {loop: false, volume: 0.6, fadeInMs: 0});
    }).catch(() => {});

    // TTS
    const msg = getMessage();
    GameSounds.speakText(msg, {voice: 'kids_cheerful'}).catch(() => {});

    return () => { GameSounds.stopBackgroundMusic({fadeOutMs: 0}); };
  }, []);

  const handleShare = useCallback(async () => {
    const title = result.gameTitle || 'Kids Learning Game';
    const emoji = accuracy >= 80 ? '🌟' : accuracy >= 60 ? '🎉' : '💪';
    const message =
      `${emoji} I scored ${accuracy}% on ${title} in Hevolve Kids!\n` +
      `${result.correct}/${result.total} correct with a ${result.bestStreak}-question streak!\n\n` +
      `Download Hevolve to learn and play: https://play.google.com/store/apps/details?id=com.hertzai.hevolve`;
    try { await Share.share({message, title: `${title} - Hevolve Kids`}); } catch (_) {}
  }, [result, accuracy]);

  const getMessage = () => {
    if (result.isPerfect) return theme.winVerb || 'PERFECT!';
    if (accuracy >= 80) return theme.winVerb || 'Amazing!';
    if (accuracy >= 60) return 'Great Job!';
    if (accuracy >= 40) return 'Good Try!';
    return 'Keep Practicing!';
  };

  const getDefaultEmoji = () => {
    if (result.isPerfect) return 'trophy';
    if (accuracy >= 80) return 'star-face';
    if (accuracy >= 60) return 'emoticon-happy';
    if (accuracy >= 40) return 'emoticon-neutral';
    return 'emoticon-sad';
  };

  const winIcon = (result.isPerfect || accuracy >= 80) ? (theme.winIcon || getDefaultEmoji()) : getDefaultEmoji();
  const iconColor = theme.colors?.primary || kidsColors.star;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, {transform: [{scale: scaleAnim}]}]}>
        {/* Celebration header with per-template decoration */}
        <View style={styles.celebrationHeader}>
          {renderCelebrationDecor(theme.celebrationType, celebAnims, theme)}
          <Animated.View style={{
            transform: [
              {scale: iconScale},
              {rotate: iconRotate.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']})},
            ],
          }}>
            <Icon name={winIcon} size={80} color={iconColor} />
          </Animated.View>
        </View>

        <Text style={[styles.message, {color: iconColor}]}>{getMessage()}</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{result.correct}/{result.total}</Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{accuracy}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{result.bestStreak}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
        </View>

        <Animated.View style={[styles.starsRow, {opacity: starsAnim}]}>
          <Icon name="star" size={32} color={kidsColors.star} />
          <Text style={styles.starsText}>+{result.stars} Stars</Text>
        </Animated.View>

        {result.isPerfect && (
          <View style={styles.perfectBadge}>
            <Icon name="crown" size={20} color={kidsColors.star} />
            <Text style={styles.perfectText}>Perfect Score Bonus!</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.homeButton} onPress={onHome || (() => navigation.navigate('KidsHub'))}>
            <Icon name="home" size={24} color={kidsColors.accent} />
            <Text style={styles.homeText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Icon name="share-variant" size={24} color={kidsColors.accentSecondary} />
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.playAgainButton} onPress={onPlayAgain}>
            <Icon name="refresh" size={24} color={kidsColors.textOnDark} />
            <Text style={styles.playAgainText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// ── Celebration animation sequences per type ──

function getCelebrationSequence(type, a) {
  const {scaleAnim, starsAnim, celebAnims, iconRotate, iconScale} = a;
  const cardIn = Animated.spring(scaleAnim, {toValue: 1, ...SPRINGS.playful});
  const starsIn = Animated.timing(starsAnim, {toValue: 1, duration: 800, useNativeDriver: true});

  switch (type) {
    case 'podium':
      return [
        Animated.parallel([
          cardIn,
          Animated.sequence([
            Animated.timing(iconScale, {toValue: 1.3, duration: 400, easing: Easing.out(Easing.back(2)), useNativeDriver: true}),
            Animated.spring(iconScale, {toValue: 1, ...SPRINGS.bouncy}),
          ]),
        ]),
        starsIn,
      ];

    case 'cascade':
      return [
        Animated.parallel([
          cardIn,
          Animated.spring(iconScale, {toValue: 1, ...SPRINGS.bouncy}),
          ...celebAnims.map((ca, i) =>
            Animated.timing(ca, {toValue: 1, duration: 200, delay: i * 100, useNativeDriver: true}),
          ),
        ]),
        starsIn,
      ];

    case 'orbit':
      return [
        Animated.parallel([
          cardIn,
          Animated.sequence([
            Animated.timing(iconScale, {toValue: 1.2, duration: 300, useNativeDriver: true}),
            Animated.parallel([
              Animated.timing(iconRotate, {toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true}),
              Animated.spring(iconScale, {toValue: 1, ...SPRINGS.playful}),
            ]),
          ]),
          ...celebAnims.map((ca, i) =>
            Animated.timing(ca, {toValue: 1, duration: 600, delay: i * 80, useNativeDriver: true}),
          ),
        ]),
        starsIn,
      ];

    case 'formation':
      return [
        Animated.parallel([
          cardIn,
          ...celebAnims.map((ca, i) =>
            Animated.spring(ca, {toValue: 1, ...SPRINGS.standard, delay: i * 60}),
          ),
        ]),
        Animated.spring(iconScale, {toValue: 1, ...SPRINGS.quick}),
        starsIn,
      ];

    case 'rain':
      return [
        cardIn,
        Animated.parallel([
          Animated.spring(iconScale, {toValue: 1, ...SPRINGS.bouncy}),
          ...celebAnims.map((ca, i) =>
            Animated.timing(ca, {toValue: 1, duration: 400, delay: i * 120, easing: Easing.bounce, useNativeDriver: true}),
          ),
        ]),
        starsIn,
      ];

    case 'typewriter':
      return [
        cardIn,
        Animated.stagger(80, celebAnims.map(ca =>
          Animated.timing(ca, {toValue: 1, duration: 150, useNativeDriver: true}),
        )),
        Animated.spring(iconScale, {toValue: 1, ...SPRINGS.bouncy}),
        starsIn,
      ];

    case 'snap':
      return [
        Animated.parallel([
          cardIn,
          Animated.sequence([
            Animated.timing(iconScale, {toValue: 1.4, duration: 200, useNativeDriver: true}),
            Animated.timing(iconScale, {toValue: 0.9, duration: 100, useNativeDriver: true}),
            Animated.spring(iconScale, {toValue: 1, ...SPRINGS.quick}),
          ]),
        ]),
        starsIn,
      ];

    case 'bubbles':
      return [
        cardIn,
        Animated.parallel([
          Animated.spring(iconScale, {toValue: 1, ...SPRINGS.playful}),
          ...celebAnims.map((ca, i) =>
            Animated.timing(ca, {toValue: 1, duration: 800, delay: i * 100, easing: Easing.out(Easing.sin), useNativeDriver: true}),
          ),
        ]),
        starsIn,
      ];

    case 'spotlight':
      return [
        Animated.parallel([
          cardIn,
          Animated.sequence([
            Animated.timing(iconScale, {toValue: 2, duration: 100, useNativeDriver: true}),
            Animated.timing(iconScale, {toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true}),
          ]),
        ]),
        starsIn,
      ];

    case 'pages':
      return [
        cardIn,
        Animated.parallel([
          Animated.timing(iconRotate, {toValue: 0.5, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
          Animated.spring(iconScale, {toValue: 1, ...SPRINGS.bouncy}),
        ]),
        starsIn,
      ];

    case 'freeze':
      return [
        Animated.parallel([
          cardIn,
          Animated.sequence([
            Animated.timing(iconScale, {toValue: 1.5, duration: 200, useNativeDriver: true}),
            Animated.delay(300),
            Animated.spring(iconScale, {toValue: 1, ...SPRINGS.standard}),
          ]),
        ]),
        starsIn,
      ];

    case 'illuminate':
      return [
        cardIn,
        Animated.timing(iconScale, {toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true}),
        Animated.parallel(celebAnims.map(ca =>
          Animated.timing(ca, {toValue: 1, duration: 400, useNativeDriver: true}),
        )),
        starsIn,
      ];

    default:
      return [
        Animated.parallel([
          cardIn,
          Animated.spring(iconScale, {toValue: 1, ...SPRINGS.bouncy}),
        ]),
        starsIn,
      ];
  }
}

// ── Celebration decoration renderers ──

function renderCelebrationDecor(type, celebAnims, theme) {
  const colors = theme.confetti || ['#FDCB6E', '#6C5CE7', '#FF6B6B', '#00B894', '#4ECDC4', '#A29BFE'];

  switch (type) {
    case 'orbit':
    case 'formation':
      return celebAnims.map((anim, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const r = 55;
        return (
          <Animated.View key={i} style={[styles.decorDot, {
            backgroundColor: colors[i % colors.length],
            opacity: anim,
            transform: [{translateX: Math.cos(angle) * r}, {translateY: Math.sin(angle) * r}, {scale: anim}],
          }]} />
        );
      });

    case 'cascade':
    case 'rain':
      return celebAnims.map((anim, i) => (
        <Animated.View key={i} style={[styles.decorStar, {
          opacity: anim,
          transform: [
            {translateY: anim.interpolate({inputRange: [0, 1], outputRange: [-30, 0]})},
            {translateX: (i - 2.5) * 18},
          ],
        }]}>
          <Icon name="star-four-points" size={14} color={colors[i % colors.length]} />
        </Animated.View>
      ));

    case 'bubbles':
      return celebAnims.map((anim, i) => (
        <Animated.View key={i} style={[styles.decorBubble, {
          backgroundColor: colors[i % colors.length] + '40',
          borderColor: colors[i % colors.length],
          opacity: anim,
          transform: [
            {translateY: anim.interpolate({inputRange: [0, 1], outputRange: [20, -20 - i * 8]})},
            {translateX: (i - 2.5) * 16},
            {scale: anim.interpolate({inputRange: [0, 1], outputRange: [0.3, 0.6 + i * 0.1]})},
          ],
        }]} />
      ));

    case 'typewriter':
      return celebAnims.map((anim, i) => {
        const letters = ['W', 'I', 'N', '!', '\u2605', '\u266A'];
        return (
          <Animated.View key={i} style={[styles.decorLetter, {
            opacity: anim,
            transform: [{translateX: (i - 2.5) * 22}, {translateY: -50}, {scale: anim}],
          }]}>
            <Text style={[styles.decorLetterText, {color: colors[i % colors.length]}]}>{letters[i]}</Text>
          </Animated.View>
        );
      });

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: kidsColors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.xl,
    alignItems: 'center',
    width: '85%',
    ...kidsShadows.float,
  },
  celebrationHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    width: 120,
    marginBottom: kidsSpacing.sm,
  },
  message: {
    fontSize: kidsFontSize.xxl,
    fontWeight: kidsFontWeight.extrabold,
    marginTop: kidsSpacing.sm,
    marginBottom: kidsSpacing.lg,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: kidsSpacing.lg,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: kidsSpacing.md,
  },
  statValue: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
  },
  statLabel: {
    fontSize: kidsFontSize.xs,
    color: kidsColors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: kidsColors.border,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.md,
  },
  starsText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.star,
  },
  perfectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
    backgroundColor: kidsColors.backgroundTertiary,
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.sm,
    borderRadius: kidsBorderRadius.full,
    marginBottom: kidsSpacing.lg,
  },
  perfectText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.star,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: kidsSpacing.md,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
    paddingHorizontal: kidsSpacing.lg,
    paddingVertical: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg,
    borderWidth: 2,
    borderColor: kidsColors.accent,
  },
  homeText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.accent,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg,
    borderWidth: 2,
    borderColor: kidsColors.accentSecondary,
  },
  shareText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.accentSecondary,
  },
  playAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.xs,
    paddingHorizontal: kidsSpacing.lg,
    paddingVertical: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg,
    backgroundColor: kidsColors.accent,
    ...kidsShadows.button,
  },
  playAgainText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textOnDark,
  },
  decorDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  decorStar: {
    position: 'absolute',
  },
  decorBubble: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  decorLetter: {
    position: 'absolute',
  },
  decorLetterText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.extrabold,
  },
});

export default GameComplete;
