import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const DEFAULT_STEPS = [
  { id: 'profile', label: 'Complete your profile', icon: 'account-circle' },
  { id: 'avatar', label: 'Upload an avatar', icon: 'camera' },
  { id: 'interests', label: 'Select interests', icon: 'heart-multiple' },
  { id: 'first_post', label: 'Create your first post', icon: 'pencil-plus' },
  { id: 'follow', label: 'Follow 3 people', icon: 'account-plus' },
  { id: 'join_region', label: 'Join a region', icon: 'map-marker' },
];

const OnboardingChecklist = ({
  steps = DEFAULT_STEPS,
  completedSteps = [],
  currentStep = null,
  onStepPress,
  onDismiss,
  loading = false,
}) => {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SkeletonLoader width={wp('40%')} height={hp('2.5%')} />
          <SkeletonLoader variant="badge" />
        </View>
        <View style={styles.stepsLoading}>
          {[...Array(4)].map((_, i) => (
            <SkeletonLoader
              key={i}
              width={wp('80%')}
              height={hp('4%')}
              style={{ marginTop: hp('1%') }}
            />
          ))}
        </View>
      </View>
    );
  }

  const totalSteps = steps.length;
  const completedCount = completedSteps.length;
  const progressPercentage = (completedCount / totalSteps) * 100;

  if (completedCount === totalSteps) {
    return null;
  }

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <Animatable.View
      animation="fadeIn"
      duration={600}
      style={styles.container}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <View style={styles.progressRing}>
            <Text style={styles.progressText}>
              {completedCount}/{totalSteps}
            </Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Get Started</Text>
            <Text style={styles.subtitle}>
              {Math.round(progressPercentage)}% complete
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={wp('6%')}
            color="#888"
          />
          {onDismiss && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={wp('5%')}
                color="#666"
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <Animatable.View
            animation="slideInLeft"
            duration={800}
            style={[
              styles.progressFill,
              { width: `${progressPercentage}%` },
            ]}
          />
        </View>
      </View>

      {expanded && (
        <Animatable.View
          animation="fadeInDown"
          duration={300}
          style={styles.stepsContainer}
        >
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = step.id === currentStep ||
              (!currentStep && index === completedCount);
            const isLocked = index > completedCount;

            return (
              <Animatable.View
                key={step.id}
                animation="fadeInUp"
                delay={index * 50}
              >
                <TouchableOpacity
                  style={[
                    styles.stepItem,
                    isCompleted && styles.stepCompleted,
                    isCurrent && styles.stepCurrent,
                    isLocked && styles.stepLocked,
                  ]}
                  onPress={() => !isLocked && onStepPress && onStepPress(step.id)}
                  activeOpacity={isLocked ? 1 : 0.7}
                  disabled={isLocked}
                >
                  <View
                    style={[
                      styles.stepIconContainer,
                      isCompleted && styles.stepIconCompleted,
                      isCurrent && styles.stepIconCurrent,
                    ]}
                  >
                    {isCompleted ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={wp('4%')}
                        color="#FFFFFF"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={step.icon}
                        size={wp('4%')}
                        color={isCurrent ? '#10B981' : '#666'}
                      />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.stepLabel,
                      isCompleted && styles.stepLabelCompleted,
                      isCurrent && styles.stepLabelCurrent,
                      isLocked && styles.stepLabelLocked,
                    ]}
                  >
                    {step.label}
                  </Text>

                  {isCurrent && (
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={wp('4%')}
                      color="#10B981"
                    />
                  )}

                  {isLocked && (
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={wp('4%')}
                      color="#444"
                    />
                  )}
                </TouchableOpacity>

                {index < steps.length - 1 && (
                  <View
                    style={[
                      styles.stepConnector,
                      isCompleted && styles.stepConnectorCompleted,
                    ]}
                  />
                )}
              </Animatable.View>
            );
          })}
        </Animatable.View>
      )}
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: hp('10%'),
    right: wp('3%'),
    width: wp('80%'),
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressRing: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: '#10B98120',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    color: '#10B981',
    fontSize: wp('2.8%'),
    fontWeight: '700',
  },
  headerTextContainer: {
    marginLeft: wp('3%'),
  },
  title: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  subtitle: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: hp('0.2%'),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dismissButton: {
    marginLeft: wp('2%'),
    padding: wp('1%'),
  },
  progressBarContainer: {
    marginTop: hp('1.5%'),
    marginBottom: hp('1%'),
  },
  progressBar: {
    height: hp('0.5%'),
    backgroundColor: '#2A2A2A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  stepsContainer: {
    marginTop: hp('1%'),
  },
  stepsLoading: {
    marginTop: hp('1%'),
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1.2%'),
    paddingHorizontal: wp('2%'),
    borderRadius: 10,
  },
  stepCompleted: {
    backgroundColor: '#10B98110',
  },
  stepCurrent: {
    backgroundColor: '#10B98120',
    borderWidth: 1,
    borderColor: '#10B98140',
  },
  stepLocked: {
    opacity: 0.5,
  },
  stepIconContainer: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  stepIconCompleted: {
    backgroundColor: '#10B981',
  },
  stepIconCurrent: {
    backgroundColor: '#10B98130',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  stepLabel: {
    flex: 1,
    color: '#888',
    fontSize: wp('3.2%'),
    fontWeight: '500',
  },
  stepLabelCompleted: {
    color: '#10B981',
    textDecorationLine: 'line-through',
  },
  stepLabelCurrent: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stepLabelLocked: {
    color: '#444',
  },
  stepConnector: {
    width: 2,
    height: hp('1.5%'),
    backgroundColor: '#2A2A2A',
    marginLeft: wp('6%'),
  },
  stepConnectorCompleted: {
    backgroundColor: '#10B981',
  },
});

export default OnboardingChecklist;
