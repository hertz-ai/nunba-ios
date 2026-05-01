import React, {useMemo} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  SafeAreaView, StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import KidsThemeProvider from '../components/KidsLearning/KidsThemeProvider';
import useKidsLearningStore from '../../../kidsLearningStore';
import useKidsIntelligenceStore from '../../../kidsIntelligenceStore';
import {
  kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize,
  kidsFontWeight, kidsShadows, CATEGORY_MAP,
} from '../../../theme/kidsColors';

const CATEGORIES = ['english', 'math', 'lifeSkills', 'science', 'creativity'];

const KidsProgressScreen = () => {
  const navigation = useNavigation();
  const {
    totalStars, englishProgress, mathProgress, lifeSkillsProgress,
    scienceProgress, creativityProgress, gameHistory,
  } = useKidsLearningStore();
  const {getThreeRSummary} = useKidsIntelligenceStore();

  const progressMap = {
    english: englishProgress,
    math: mathProgress,
    lifeSkills: lifeSkillsProgress,
    science: scienceProgress,
    creativity: creativityProgress,
  };

  const threeRData = useMemo(() => {
    const data = {};
    CATEGORIES.forEach(cat => {
      data[cat] = getThreeRSummary(cat);
    });
    data.overall = getThreeRSummary(null);
    return data;
  }, [getThreeRSummary, gameHistory]);

  const renderThreeRBar = (label, value, color) => (
    <View style={styles.threeRRow}>
      <Text style={styles.threeRLabel}>{label}</Text>
      <View style={styles.threeRBarBg}>
        <View style={[styles.threeRBarFill, {width: `${value}%`, backgroundColor: color}]} />
      </View>
      <Text style={styles.threeRValue}>{value}%</Text>
    </View>
  );

  const renderCategoryCard = (category) => {
    const catInfo = CATEGORY_MAP[category] || {color: kidsColors.accent, icon: 'help', label: category};
    const progress = progressMap[category];
    const threeR = threeRData[category];

    return (
      <Animatable.View key={category} animation="fadeInUp" delay={CATEGORIES.indexOf(category) * 80}>
        <View style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <View style={[styles.catIcon, {backgroundColor: catInfo.color + '20'}]}>
              <Icon name={catInfo.icon} size={24} color={catInfo.color} />
            </View>
            <View style={styles.catInfo}>
              <Text style={styles.catName}>{catInfo.label}</Text>
              <Text style={styles.catGames}>{progress.gamesPlayed} games played</Text>
            </View>
            {progress.bestScore > 0 && (
              <View style={styles.bestScore}>
                <Icon name="trophy" size={16} color={kidsColors.star} />
                <Text style={styles.bestScoreText}>{progress.bestScore}</Text>
              </View>
            )}
          </View>

          {threeR.totalConcepts > 0 && (
            <View style={styles.threeRSection}>
              <Text style={styles.threeRTitle}>Learning Intelligence ({threeR.totalConcepts} concepts)</Text>
              {renderThreeRBar('Registration', threeR.registration, kidsColors.correct)}
              {renderThreeRBar('Retention', threeR.retention, kidsColors.accent)}
              {renderThreeRBar('Recall', threeR.recall, kidsColors.star)}
            </View>
          )}
        </View>
      </Animatable.View>
    );
  };

  return (
    <KidsThemeProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Icon name="arrow-left" size={28} color={kidsColors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Progress</Text>
            <View style={{width: 40}} />
          </View>

          {/* Stars Summary */}
          <Animatable.View animation="bounceIn" style={styles.starsCard}>
            <Icon name="star-circle" size={64} color={kidsColors.star} />
            <Text style={styles.totalStarsNum}>{totalStars}</Text>
            <Text style={styles.totalStarsLabel}>Total Stars Earned</Text>
          </Animatable.View>

          {/* Overall 3R */}
          {threeRData.overall.totalConcepts > 0 && (
            <View style={styles.overallCard}>
              <Text style={styles.sectionTitle}>Overall Learning Intelligence</Text>
              {renderThreeRBar('Registration', threeRData.overall.registration, kidsColors.correct)}
              {renderThreeRBar('Retention', threeRData.overall.retention, kidsColors.accent)}
              {renderThreeRBar('Recall', threeRData.overall.recall, kidsColors.star)}
              <Text style={styles.conceptCount}>
                {threeRData.overall.totalConcepts} concepts tracked
              </Text>
            </View>
          )}

          {/* Category Progress */}
          <Text style={styles.sectionTitle}>By Subject</Text>
          {CATEGORIES.map(renderCategoryCard)}

          {/* Recent Games */}
          <Text style={styles.sectionTitle}>Recent Games</Text>
          {gameHistory.slice(0, 10).map((game, index) => {
            const catInfo = CATEGORY_MAP[game.category] || {color: kidsColors.accent};
            const accuracy = game.total > 0 ? Math.round((game.correct / game.total) * 100) : 0;
            return (
              <View key={index} style={styles.historyItem}>
                <View style={[styles.historyDot, {backgroundColor: catInfo.color}]} />
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle}>{game.gameTitle}</Text>
                  <Text style={styles.historyMeta}>
                    {accuracy}% correct {game.isPerfect ? '- PERFECT!' : ''}
                  </Text>
                </View>
                <View style={styles.historyStars}>
                  <Icon name="star" size={16} color={kidsColors.star} />
                  <Text style={styles.historyStarsText}>+{game.stars}</Text>
                </View>
              </View>
            );
          })}

          {gameHistory.length === 0 && (
            <View style={styles.emptyHistory}>
              <Icon name="gamepad-variant" size={40} color={kidsColors.textMuted} />
              <Text style={styles.emptyText}>Play some games to see your progress!</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </KidsThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: kidsColors.background},
  scroll: {paddingBottom: kidsSpacing.xxl},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: kidsSpacing.md, paddingVertical: kidsSpacing.md,
  },
  backBtn: {padding: kidsSpacing.xs},
  headerTitle: {fontSize: kidsFontSize.xl, fontWeight: kidsFontWeight.extrabold, color: kidsColors.accent},
  starsCard: {
    alignItems: 'center', backgroundColor: kidsColors.card,
    marginHorizontal: kidsSpacing.md, marginBottom: kidsSpacing.md,
    paddingVertical: kidsSpacing.xl, borderRadius: kidsBorderRadius.xl, ...kidsShadows.card,
  },
  totalStarsNum: {fontSize: kidsFontSize.display, fontWeight: kidsFontWeight.extrabold, color: kidsColors.star, marginTop: kidsSpacing.sm},
  totalStarsLabel: {fontSize: kidsFontSize.sm, color: kidsColors.textSecondary},
  overallCard: {
    backgroundColor: kidsColors.card, marginHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.md, padding: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg, ...kidsShadows.card,
  },
  sectionTitle: {
    fontSize: kidsFontSize.lg, fontWeight: kidsFontWeight.bold, color: kidsColors.textPrimary,
    paddingHorizontal: kidsSpacing.md, marginTop: kidsSpacing.md, marginBottom: kidsSpacing.sm,
  },
  conceptCount: {fontSize: kidsFontSize.xs, color: kidsColors.textMuted, marginTop: kidsSpacing.sm, textAlign: 'center'},
  categoryCard: {
    backgroundColor: kidsColors.card, marginHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.sm, padding: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg, ...kidsShadows.card,
  },
  categoryHeader: {flexDirection: 'row', alignItems: 'center', gap: kidsSpacing.md},
  catIcon: {width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center'},
  catInfo: {flex: 1},
  catName: {fontSize: kidsFontSize.md, fontWeight: kidsFontWeight.bold, color: kidsColors.textPrimary},
  catGames: {fontSize: kidsFontSize.xs, color: kidsColors.textSecondary},
  bestScore: {flexDirection: 'row', alignItems: 'center', gap: 4},
  bestScoreText: {fontSize: kidsFontSize.sm, fontWeight: kidsFontWeight.bold, color: kidsColors.star},
  threeRSection: {marginTop: kidsSpacing.md},
  threeRTitle: {fontSize: kidsFontSize.xs, color: kidsColors.textMuted, marginBottom: kidsSpacing.sm},
  threeRRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: kidsSpacing.sm},
  threeRLabel: {fontSize: kidsFontSize.xs, fontWeight: kidsFontWeight.medium, color: kidsColors.textSecondary, width: 80},
  threeRBarBg: {flex: 1, height: 8, backgroundColor: kidsColors.border, borderRadius: 4, overflow: 'hidden'},
  threeRBarFill: {height: '100%', borderRadius: 4},
  threeRValue: {fontSize: kidsFontSize.xs, fontWeight: kidsFontWeight.bold, color: kidsColors.textPrimary, width: 36, textAlign: 'right'},
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.md, paddingVertical: kidsSpacing.sm,
    backgroundColor: kidsColors.card, marginHorizontal: kidsSpacing.md,
    marginBottom: 4, borderRadius: kidsBorderRadius.sm,
  },
  historyDot: {width: 8, height: 8, borderRadius: 4},
  historyInfo: {flex: 1},
  historyTitle: {fontSize: kidsFontSize.sm, fontWeight: kidsFontWeight.medium, color: kidsColors.textPrimary},
  historyMeta: {fontSize: kidsFontSize.xs, color: kidsColors.textSecondary},
  historyStars: {flexDirection: 'row', alignItems: 'center', gap: 2},
  historyStarsText: {fontSize: kidsFontSize.sm, fontWeight: kidsFontWeight.bold, color: kidsColors.star},
  emptyHistory: {alignItems: 'center', paddingVertical: kidsSpacing.xl},
  emptyText: {fontSize: kidsFontSize.sm, color: kidsColors.textMuted, marginTop: kidsSpacing.sm},
});

export default KidsProgressScreen;
