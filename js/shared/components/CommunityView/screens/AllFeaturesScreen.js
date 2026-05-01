import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import ICON_MAP from '../../../utils/iconMap';
import { colors, borderRadius, spacing, fontSize, fontWeight } from '../../../theme/colors';

const ALL_FEATURES = [
  { icon: 'search', iconType: 'ion', label: 'Search', color: '#CCCCCC', screen: 'Search' },
  { icon: 'notifications', iconType: 'ion', label: 'Alerts', color: '#FF6B35', screen: 'Notifications' },
  { icon: 'wallet', iconType: 'community', label: 'Resonance', color: '#FFD700', screen: 'ResonanceDashboard' },
  { icon: 'trophy', iconType: 'ion', label: 'Achievements', color: '#F59E0B', screen: 'Achievements' },
  { icon: 'flag', iconType: 'community', label: 'Challenges', color: '#EF4444', screen: 'Challenges' },
  { icon: 'earth', iconType: 'community', label: 'Regions', color: '#3B82F6', screen: 'Regions' },
  { icon: 'explore', iconType: 'material', label: 'Encounters', color: '#00e89d', screen: 'Encounters' },
  { icon: 'flask', iconType: 'community', label: 'Thought Exp.', color: '#7C4DFF', screen: 'ExperimentDiscovery' },
  { icon: 'rocket-launch', iconType: 'community', label: 'Campaigns', color: '#8B5CF6', screen: 'Campaigns' },
  { icon: 'account-group', iconType: 'community', label: 'Communities', color: '#06B6D4', screen: 'Communities' },
  { icon: 'dna', iconType: 'community', label: 'Evolution', color: '#10B981', screen: 'AgentEvolution' },
  { icon: 'account-circle', iconType: 'material', label: 'Profile', color: '#6B7280', screen: 'Profile' },
  { icon: 'code-braces', iconType: 'community', label: 'Recipes', color: '#0078ff', screen: 'Recipes' },
  { icon: 'clipboard-check', iconType: 'community', label: 'Tasks', color: '#00D9FF', screen: 'Tasks' },
  { icon: 'code-tags', iconType: 'community', label: 'Coding', color: '#9D4EDD', screen: 'CodingAgent' },
  { icon: 'gamepad-variant', iconType: 'community', label: 'Kids Zone', color: '#6C5CE7', screen: 'KidsHub' },
  { icon: 'controller-classic', iconType: 'community', label: 'Games', color: '#FF6B6B', screen: 'GameHub' },
  { icon: 'trophy-variant', iconType: 'community', label: 'Seasons', color: '#EC4899', screen: 'Season' },
  { icon: 'view-dashboard', iconType: 'community', label: 'Dashboard', color: '#3B82F6', screen: 'AgentDashboard' },
  { icon: 'cloud-cog-outline', iconType: 'community', label: 'Providers', color: '#4CAF50', screen: 'ProviderManagement' },
  { icon: 'video-vintage', iconType: 'community', label: 'Mindstory', color: '#6C63FF', screen: 'Mindstory' },
];

const AllFeaturesScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>All Features</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {ALL_FEATURES.map((item, index) => {
          const Icon = ICON_MAP[item.iconType] || MaterialIcons;
          return (
            <Animatable.View key={item.screen} animation="fadeInUp" delay={index * 40}>
              <TouchableOpacity
                style={styles.featureCard}
                activeOpacity={0.7}
                onPress={() => {
                  navigation.dispatch(
                    CommonActions.navigate({ name: item.screen })
                  );
                }}
              >
                <View style={[styles.featureIcon, { backgroundColor: item.color + '22' }]}>
                  <Icon name={item.icon} size={24} color={item.color} />
                </View>
                <Text style={styles.featureLabel}>{item.label}</Text>
              </TouchableOpacity>
            </Animatable.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  topBarTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.md,
    justifyContent: 'center',
  },
  featureCard: {
    width: 90,
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
});

export default AllFeaturesScreen;
