import React, {useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, SafeAreaView, StyleSheet, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import KidsThemeProvider from '../components/KidsLearning/KidsThemeProvider';
import useKidsLearningStore from '../../../kidsLearningStore';
import {
  kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize,
  kidsFontWeight, kidsShadows, CATEGORY_MAP,
} from '../../../theme/kidsColors';

const CustomGamesScreen = () => {
  const navigation = useNavigation();
  const {customGames, removeCustomGame} = useKidsLearningStore();

  const handlePlay = useCallback((game) => {
    navigation.navigate('KidsGame', {gameConfig: game});
  }, []);

  const handleDelete = useCallback((game) => {
    Alert.alert('Delete Game', `Remove "${game.title}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: () => removeCustomGame(game.id)},
    ]);
  }, []);

  const renderItem = ({item, index}) => {
    const catInfo = CATEGORY_MAP[item.category] || {color: kidsColors.accent, icon: 'gamepad-variant'};
    return (
      <Animatable.View animation="fadeInUp" delay={index * 60}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, {backgroundColor: catInfo.color + '20'}]}>
            <Icon name={item.icon || catInfo.icon} size={28} color={catInfo.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {catInfo.label || item.category} | Difficulty {item.difficulty || '?'}/5
              {item.serverHtml ? ' | HTML5' : ''}
            </Text>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => handlePlay(item)} style={styles.playBtn}>
              <Icon name="play-circle" size={36} color={kidsColors.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
              <Icon name="delete-outline" size={24} color={kidsColors.incorrect} />
            </TouchableOpacity>
          </View>
        </View>
      </Animatable.View>
    );
  };

  return (
    <KidsThemeProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={28} color={kidsColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Games</Text>
          <TouchableOpacity onPress={() => navigation.navigate('GameCreator')} style={styles.addBtn}>
            <Icon name="plus-circle" size={28} color={kidsColors.accent} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={customGames}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="creation" size={64} color={kidsColors.textMuted} />
              <Text style={styles.emptyTitle}>No custom games yet</Text>
              <Text style={styles.emptyText}>
                Tap "Create" to have our AI agent build a game for you!
              </Text>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => navigation.navigate('GameCreator')}
              >
                <Icon name="plus" size={20} color={kidsColors.textOnDark} />
                <Text style={styles.createBtnText}>Create a Game</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </SafeAreaView>
    </KidsThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: kidsColors.background},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: kidsSpacing.md, paddingVertical: kidsSpacing.md,
  },
  backBtn: {padding: kidsSpacing.xs},
  headerTitle: {fontSize: kidsFontSize.xl, fontWeight: kidsFontWeight.extrabold, color: kidsColors.accent},
  addBtn: {padding: kidsSpacing.xs},
  list: {paddingHorizontal: kidsSpacing.md, paddingBottom: kidsSpacing.xxl},
  card: {
    flexDirection: 'row', alignItems: 'center', gap: kidsSpacing.md,
    backgroundColor: kidsColors.card, padding: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg, marginBottom: kidsSpacing.sm,
    ...kidsShadows.card,
  },
  iconCircle: {width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center'},
  cardInfo: {flex: 1},
  cardTitle: {fontSize: kidsFontSize.md, fontWeight: kidsFontWeight.bold, color: kidsColors.textPrimary},
  cardMeta: {fontSize: kidsFontSize.xs, color: kidsColors.textSecondary, marginTop: 2},
  cardActions: {alignItems: 'center', gap: kidsSpacing.xs},
  playBtn: {},
  deleteBtn: {padding: 2},
  empty: {alignItems: 'center', paddingVertical: kidsSpacing.xxl * 2},
  emptyTitle: {fontSize: kidsFontSize.lg, fontWeight: kidsFontWeight.bold, color: kidsColors.textPrimary, marginTop: kidsSpacing.md},
  emptyText: {fontSize: kidsFontSize.sm, color: kidsColors.textMuted, textAlign: 'center', marginTop: kidsSpacing.sm, paddingHorizontal: kidsSpacing.xl},
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: kidsSpacing.sm,
    backgroundColor: kidsColors.accent, paddingHorizontal: kidsSpacing.xl,
    paddingVertical: kidsSpacing.md, borderRadius: kidsBorderRadius.lg,
    marginTop: kidsSpacing.lg, ...kidsShadows.button,
  },
  createBtnText: {fontSize: kidsFontSize.md, fontWeight: kidsFontWeight.bold, color: kidsColors.textOnDark},
});

export default CustomGamesScreen;
