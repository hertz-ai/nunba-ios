import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { recipesApi } from '../../../services/socialApi';

const RecipesScreen = () => {
  const navigation = useNavigation();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecipes = useCallback(async () => {
    try {
      const res = await recipesApi.list({ limit: 50 });
      setRecipes(res.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
  }, [fetchRecipes]);

  const handleFork = async (id) => {
    try {
      await recipesApi.fork(id);
      Alert.alert('Forked!', 'Recipe has been forked to your collection.');
    } catch (err) {
      Alert.alert('Error', err.error || 'Failed to fork recipe');
    }
  };

  const renderItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 50}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconBg}>
            <MaterialCommunityIcons name="code-braces" size={24} color="#0078ff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name || item.title || 'Untitled Recipe'}</Text>
            <Text style={styles.cardMeta}>by {item.author_name || 'Unknown'} — {item.fork_count || 0} forks</Text>
          </View>
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.slice(0, 3).map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.forkBtn} onPress={() => handleFork(item.id)}>
            <MaterialCommunityIcons name="source-fork" size={16} color="#0078ff" />
            <Text style={styles.forkText}>Fork</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recipes</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00e89d" />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <MaterialCommunityIcons name="code-braces-box" size={48} color="#555" />
              <Text style={styles.emptyText}>No shared recipes yet</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e89d" />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp('4%'), paddingVertical: hp('1.5%') },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: wp('5%'), fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 32 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: hp('15%') },
  emptyText: { color: '#888', fontSize: wp('3.5%'), marginTop: hp('2%') },
  listContent: { paddingHorizontal: wp('4%'), paddingBottom: hp('10%') },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: wp('4%'),
    marginBottom: hp('1%'), borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  iconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0078ff22', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { color: '#FFF', fontSize: wp('3.8%'), fontWeight: '700' },
  cardMeta: { color: '#888', fontSize: wp('3%') },
  cardDesc: { color: '#AAA', fontSize: wp('3.2%'), marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  tagsRow: { flexDirection: 'row', gap: 6 },
  tag: { backgroundColor: '#2A2A3E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: '#888', fontSize: wp('2.5%') },
  forkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  forkText: { color: '#0078ff', fontWeight: '600', fontSize: wp('3%') },
});

export default RecipesScreen;
