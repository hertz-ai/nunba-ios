import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { recipesApi } from '../../../services/socialApi';

const RecipeDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipeId } = route.params;
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRecipe = useCallback(async () => {
    try {
      const res = await recipesApi.get(recipeId);
      setRecipe(res.data || null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => { fetchRecipe(); }, [fetchRecipe]);

  const handleFork = async () => {
    try {
      await recipesApi.fork(recipeId);
      Alert.alert('Forked!', 'Recipe has been forked to your collection.');
    } catch (err) {
      Alert.alert('Error', err.error || 'Failed to fork recipe');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00e89d" />
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recipe</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Recipe not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{recipe.name || 'Recipe'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeIn">
          <View style={styles.infoCard}>
            <View style={styles.iconBg}>
              <MaterialCommunityIcons name="code-braces" size={32} color="#0078ff" />
            </View>
            <Text style={styles.title}>{recipe.name || recipe.title}</Text>
            <Text style={styles.author}>by {recipe.author_name || 'Unknown'}</Text>
            {recipe.description && <Text style={styles.desc}>{recipe.description}</Text>}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="source-fork" size={16} color="#888" />
                <Text style={styles.statText}>{recipe.fork_count || 0} forks</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={16} color="#888" />
                <Text style={styles.statText}>{recipe.created_at ? new Date(recipe.created_at).toLocaleDateString() : 'N/A'}</Text>
              </View>
            </View>

            {recipe.tags && recipe.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {recipe.tags.map((tag, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {recipe.steps && recipe.steps.length > 0 && (
            <View style={styles.stepsCard}>
              <Text style={styles.sectionTitle}>Steps</Text>
              {recipe.steps.map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{typeof step === 'string' ? step : step.description || JSON.stringify(step)}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.forkBtn} onPress={handleFork} activeOpacity={0.8}>
            <MaterialCommunityIcons name="source-fork" size={20} color="#121212" />
            <Text style={styles.forkBtnText}>Fork this Recipe</Text>
          </TouchableOpacity>
        </Animatable.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%') },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: wp('3.5%') },
  content: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  infoCard: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: wp('5%'),
    marginBottom: hp('2%'), borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center',
  },
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#0078ff22', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { color: '#FFF', fontSize: wp('5%'), fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  author: { color: '#888', fontSize: wp('3.5%'), marginBottom: 8 },
  desc: { color: '#AAA', fontSize: wp('3.5%'), textAlign: 'center', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: wp('6%'), marginVertical: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: '#888', fontSize: wp('3%') },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: '#2A2A3E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: '#888', fontSize: wp('2.8%') },
  stepsCard: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: wp('5%'),
    marginBottom: hp('2%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  sectionTitle: { color: '#FFF', fontSize: wp('4%'), fontWeight: '700', marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0078ff22', justifyContent: 'center', alignItems: 'center' },
  stepNumText: { color: '#0078ff', fontWeight: '700', fontSize: wp('3%') },
  stepText: { flex: 1, color: '#CCC', fontSize: wp('3.5%'), lineHeight: wp('5%') },
  forkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0078ff', borderRadius: 12, paddingVertical: hp('1.5%'),
  },
  forkBtnText: { color: '#121212', fontWeight: '700', fontSize: wp('4%') },
});

export default RecipeDetailScreen;
