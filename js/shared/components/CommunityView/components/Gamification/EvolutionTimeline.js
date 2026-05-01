import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const EVOLUTION_STAGES = [
  {
    key: 'seed',
    label: 'Seed',
    icon: 'seed',
    color: '#6B7280',
    xpRequired: 0,
    description: 'Just planted',
  },
  {
    key: 'sprout',
    label: 'Sprout',
    icon: 'sprout',
    color: '#10B981',
    xpRequired: 500,
    description: 'First leaves',
  },
  {
    key: 'sapling',
    label: 'Sapling',
    icon: 'tree',
    color: '#3B82F6',
    xpRequired: 2000,
    description: 'Growing strong',
  },
  {
    key: 'tree',
    label: 'Tree',
    icon: 'pine-tree',
    color: '#8B5CF6',
    xpRequired: 5000,
    description: 'Fully developed',
  },
  {
    key: 'ancient',
    label: 'Ancient',
    icon: 'tree-outline',
    color: '#F59E0B',
    xpRequired: 10000,
    description: 'Legendary wisdom',
  },
];

const EvolutionTimeline = ({
  currentXP = 0,
  currentStage = 'seed',
  specialization = null,
  onStagePress,
  loading = false,
}) => {
  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader width={wp('50%')} height={hp('2.5%')} />
        <View style={styles.timelineLoading}>
          {[...Array(5)].map((_, i) => (
            <SkeletonLoader
              key={i}
              width={wp('12%')}
              height={wp('12%')}
              borderRadius={wp('6%')}
              style={{ marginVertical: hp('1%') }}
            />
          ))}
        </View>
      </View>
    );
  }

  const currentStageIndex = EVOLUTION_STAGES.findIndex(
    (s) => s.key === currentStage
  );
  const nextStage = EVOLUTION_STAGES[currentStageIndex + 1];

  const getProgressToNextStage = () => {
    if (!nextStage) return 100;
    const currentStageXP = EVOLUTION_STAGES[currentStageIndex].xpRequired;
    const nextStageXP = nextStage.xpRequired;
    const progress =
      ((currentXP - currentStageXP) / (nextStageXP - currentStageXP)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const progressToNext = getProgressToNextStage();

  return (
    <Animatable.View animation="fadeIn" duration={600} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Evolution Path</Text>
        {specialization && (
          <View style={styles.specializationBadge}>
            <MaterialCommunityIcons
              name="star-four-points"
              size={wp('3%')}
              color="#F59E0B"
            />
            <Text style={styles.specializationText}>{specialization}</Text>
          </View>
        )}
      </View>

      <View style={styles.timeline}>
        {EVOLUTION_STAGES.map((stage, index) => {
          const isPast = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isFuture = index > currentStageIndex;
          const isLast = index === EVOLUTION_STAGES.length - 1;

          return (
            <Animatable.View
              key={stage.key}
              animation="fadeInUp"
              delay={index * 100}
              style={styles.stageContainer}
            >
              {!isLast && (
                <View style={styles.connectorContainer}>
                  <View
                    style={[
                      styles.connector,
                      {
                        backgroundColor: isPast ? stage.color : '#2A2A2A',
                      },
                    ]}
                  />
                  {isCurrent && (
                    <Animatable.View
                      animation="fadeIn"
                      style={[
                        styles.connectorProgress,
                        {
                          height: `${progressToNext}%`,
                          backgroundColor: nextStage?.color || stage.color,
                        },
                      ]}
                    />
                  )}
                </View>
              )}

              <View style={styles.stageRow}>
                <View
                  style={[
                    styles.stageIcon,
                    {
                      backgroundColor: isFuture
                        ? '#1A1A1A'
                        : stage.color + '20',
                      borderColor: isFuture ? '#2A2A2A' : stage.color,
                    },
                  ]}
                >
                  {isCurrent && (
                    <Animatable.View
                      animation="pulse"
                      iterationCount="infinite"
                      duration={1500}
                      style={[
                        styles.glowEffect,
                        { backgroundColor: stage.color + '30' },
                      ]}
                    />
                  )}
                  <MaterialCommunityIcons
                    name={stage.icon}
                    size={wp('6%')}
                    color={isFuture ? '#444' : stage.color}
                  />
                  {isPast && (
                    <View style={styles.checkmark}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={wp('4%')}
                        color="#10B981"
                      />
                    </View>
                  )}
                </View>

                <View style={styles.stageInfo}>
                  <Text
                    style={[
                      styles.stageLabel,
                      {
                        color: isFuture ? '#666' : '#FFFFFF',
                        fontWeight: isCurrent ? '700' : '600',
                      },
                    ]}
                  >
                    {stage.label}
                  </Text>
                  <Text
                    style={[
                      styles.stageDescription,
                      { color: isFuture ? '#444' : '#888' },
                    ]}
                  >
                    {stage.description}
                  </Text>
                  {isCurrent && nextStage && (
                    <View style={styles.xpProgress}>
                      <Text style={styles.xpText}>
                        {currentXP.toLocaleString()} /{' '}
                        {nextStage.xpRequired.toLocaleString()} XP
                      </Text>
                      <View style={styles.xpBar}>
                        <Animatable.View
                          animation="slideInLeft"
                          style={[
                            styles.xpFill,
                            {
                              width: `${progressToNext}%`,
                              backgroundColor: nextStage.color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}
                  {isFuture && (
                    <Text style={styles.xpRequired}>
                      {stage.xpRequired.toLocaleString()} XP required
                    </Text>
                  )}
                </View>
              </View>
            </Animatable.View>
          );
        })}
      </View>

      {currentStageIndex === EVOLUTION_STAGES.length - 1 && (
        <Animatable.View
          animation="fadeIn"
          delay={500}
          style={styles.maxLevelBadge}
        >
          <MaterialCommunityIcons
            name="crown"
            size={wp('5%')}
            color="#F59E0B"
          />
          <Text style={styles.maxLevelText}>Maximum Evolution Reached!</Text>
        </Animatable.View>
      )}
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginVertical: hp('1%'),
    marginHorizontal: wp('3%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  title: {
    color: '#FFFFFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
  },
  specializationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B20',
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.4%'),
    borderRadius: 10,
  },
  specializationText: {
    color: '#F59E0B',
    fontSize: wp('2.8%'),
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
  timeline: {
    paddingLeft: wp('2%'),
  },
  timelineLoading: {
    alignItems: 'center',
    paddingVertical: hp('2%'),
  },
  stageContainer: {
    position: 'relative',
    paddingBottom: hp('2%'),
  },
  connectorContainer: {
    position: 'absolute',
    left: wp('6%'),
    top: wp('12%'),
    bottom: 0,
    width: 3,
  },
  connector: {
    flex: 1,
    width: 3,
    borderRadius: 2,
  },
  connectorProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    borderRadius: 2,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stageIcon: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: wp('3%'),
  },
  glowEffect: {
    position: 'absolute',
    width: wp('16%'),
    height: wp('16%'),
    borderRadius: wp('8%'),
  },
  checkmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#121212',
    borderRadius: wp('2%'),
  },
  stageInfo: {
    flex: 1,
    paddingTop: hp('0.3%'),
  },
  stageLabel: {
    fontSize: wp('3.8%'),
  },
  stageDescription: {
    fontSize: wp('2.8%'),
    marginTop: hp('0.2%'),
  },
  xpProgress: {
    marginTop: hp('0.8%'),
  },
  xpText: {
    color: '#888',
    fontSize: wp('2.5%'),
    marginBottom: hp('0.3%'),
  },
  xpBar: {
    height: hp('0.6%'),
    backgroundColor: '#2A2A2A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 3,
  },
  xpRequired: {
    color: '#444',
    fontSize: wp('2.5%'),
    marginTop: hp('0.3%'),
  },
  maxLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B20',
    paddingVertical: hp('1%'),
    borderRadius: 10,
    marginTop: hp('1%'),
  },
  maxLevelText: {
    color: '#F59E0B',
    fontSize: wp('3.2%'),
    fontWeight: '700',
    marginLeft: wp('2%'),
  },
});

export default EvolutionTimeline;
