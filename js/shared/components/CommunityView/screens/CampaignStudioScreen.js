import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Slider from '../components/Slider';
import { useNavigation, useRoute } from '@react-navigation/native';

import { campaignsApi } from '../../../services/socialApi';
import { ConfettiOverlay } from '../components/Gamification';
import { useRoleAccess } from '../components/RoleGuard';

const STEPS = ['Goal', 'Content', 'Audience', 'Budget', 'Preview'];

const GOALS = [
  { id: 'followers', icon: 'account-plus', label: 'Grow Followers', description: 'Increase your follower count', color: '#00e89d' },
  { id: 'boost', icon: 'trending-up', label: 'Boost Post', description: 'Maximize reach on specific content', color: '#00D9FF' },
  { id: 'promote', icon: 'robot', label: 'Promote Agent', description: 'Showcase your AI agent', color: '#9D4EDD' },
  { id: 'community', icon: 'account-group', label: 'Grow Community', description: 'Expand your region membership', color: '#FF6B35' },
];

const INTERESTS = ['Technology', 'Art', 'Gaming', 'Music', 'Sports', 'Business', 'Science', 'Lifestyle'];

const CampaignStudioScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { templateId, userRole } = route.params || {};
  const { isRegionalOrAbove } = useRoleAccess(userRole);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedContent, setSelectedContent] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [targetSimilar, setTargetSimilar] = useState(true);
  const [sparkBudget, setSparkBudget] = useState(500);
  const [duration, setDuration] = useState(7);
  const [campaignName, setCampaignName] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const totalCost = sparkBudget;

  const canProceed = () => {
    switch (currentStep) {
      case 0: return selectedGoal !== null;
      case 1: return true;
      case 2: return true;
      case 3: return sparkBudget >= 100;
      case 4: return campaignName.length > 0;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleLaunch();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSaveDraft = () => {
    console.log('Saving draft...');
    navigation.goBack();
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      const campaignData = {
        name: campaignName,
        goal: selectedGoal,
        interests: selectedInterests,
        budget: sparkBudget,
        duration,
      };
      const res = await campaignsApi.create(campaignData);
      setShowConfetti(true);
      setTimeout(() => {
        navigation.navigate('CampaignDetail', { campaignId: res.data?.id || 'new' });
      }, 2000);
    } catch (e) {
      // show error
    }
    setIsLaunching(false);
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
        <View key={step} style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              currentStep >= index && styles.stepCircleActive,
              currentStep === index && styles.stepCircleCurrent,
            ]}
          >
            {currentStep > index ? (
              <Ionicons name="checkmark" size={14} color="#FFF" />
            ) : (
              <Text style={[styles.stepNumber, currentStep >= index && styles.stepNumberActive]}>
                {index + 1}
              </Text>
            )}
          </View>
          <Text style={[styles.stepLabel, currentStep >= index && styles.stepLabelActive]}>
            {step}
          </Text>
          {index < STEPS.length - 1 && (
            <View style={[styles.stepConnector, currentStep > index && styles.stepConnectorActive]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <Animatable.View animation="fadeInRight" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Your Goal</Text>
      <Text style={styles.stepSubtitle}>What do you want to achieve with this campaign?</Text>
      <View style={styles.goalsGrid}>
        {GOALS.map((goal) => (
          <TouchableOpacity
            key={goal.id}
            style={[
              styles.goalCard,
              selectedGoal === goal.id && { borderColor: goal.color, backgroundColor: `${goal.color}11` },
            ]}
            onPress={() => setSelectedGoal(goal.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.goalIcon, { backgroundColor: `${goal.color}22` }]}>
              <MaterialCommunityIcons name={goal.icon} size={32} color={goal.color} />
            </View>
            <Text style={styles.goalLabel}>{goal.label}</Text>
            <Text style={styles.goalDesc}>{goal.description}</Text>
            {selectedGoal === goal.id && (
              <View style={[styles.goalSelected, { backgroundColor: goal.color }]}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Animatable.View>
  );

  const renderStep2 = () => (
    <Animatable.View animation="fadeInRight" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Content</Text>
      <Text style={styles.stepSubtitle}>
        {selectedGoal === 'boost' ? 'Choose posts to boost' :
         selectedGoal === 'promote' ? 'Select agent to promote' :
         'Select content to feature'}
      </Text>
      <View style={styles.contentPlaceholder}>
        <MaterialCommunityIcons name="file-document-multiple" size={48} color="#555" />
        <Text style={styles.contentPlaceholderText}>Your content will appear here</Text>
        <TouchableOpacity style={styles.selectContentButton}>
          <Text style={styles.selectContentText}>Select Content</Text>
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  const renderStep3 = () => (
    <Animatable.View animation="fadeInRight" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Target Audience</Text>
      <Text style={styles.stepSubtitle}>Define who should see your campaign</Text>

      {/* Regions */}
      <View style={styles.audienceSection}>
        <Text style={styles.audienceSectionTitle}>Regions</Text>
        <TouchableOpacity style={styles.selectButton}>
          <MaterialCommunityIcons name="earth" size={20} color="#00e89d" />
          <Text style={styles.selectButtonText}>Select Regions</Text>
          <Ionicons name="chevron-forward" size={18} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Interests */}
      <View style={styles.audienceSection}>
        <Text style={styles.audienceSectionTitle}>Interests</Text>
        <View style={styles.interestsGrid}>
          {INTERESTS.map((interest) => (
            <TouchableOpacity
              key={interest}
              style={[
                styles.interestChip,
                selectedInterests.includes(interest) && styles.interestChipActive,
              ]}
              onPress={() => {
                if (selectedInterests.includes(interest)) {
                  setSelectedInterests(selectedInterests.filter(i => i !== interest));
                } else {
                  setSelectedInterests([...selectedInterests, interest]);
                }
              }}
            >
              <Text style={[
                styles.interestChipText,
                selectedInterests.includes(interest) && styles.interestChipTextActive,
              ]}>
                {interest}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Similar Users Toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <MaterialCommunityIcons name="account-search" size={24} color="#00D9FF" />
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>Target Similar Users</Text>
            <Text style={styles.toggleDesc}>Reach users similar to your followers</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.toggle, targetSimilar && styles.toggleActive]}
          onPress={() => setTargetSimilar(!targetSimilar)}
        >
          <View style={[styles.toggleKnob, targetSimilar && styles.toggleKnobActive]} />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  const renderStep4 = () => (
    <Animatable.View animation="fadeInRight" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Set Budget</Text>
      <Text style={styles.stepSubtitle}>How much Spark do you want to invest?</Text>

      {/* Spark Slider */}
      <View style={styles.budgetCard}>
        <View style={styles.budgetHeader}>
          <MaterialCommunityIcons name="lightning-bolt" size={28} color="#FFD700" />
          <Text style={styles.budgetValue}>{sparkBudget} Sparks</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={100}
          maximumValue={5000}
          step={50}
          value={sparkBudget}
          onValueChange={setSparkBudget}
          minimumTrackTintColor="#FFD700"
          maximumTrackTintColor="#3A3A4E"
          thumbTintColor="#FFD700"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>100</Text>
          <Text style={styles.sliderLabel}>5000</Text>
        </View>
      </View>

      {/* Duration Picker */}
      <View style={styles.durationSection}>
        <Text style={styles.durationTitle}>Campaign Duration</Text>
        <View style={styles.durationOptions}>
          {[3, 7, 14, 30].map((days) => (
            <TouchableOpacity
              key={days}
              style={[styles.durationOption, duration === days && styles.durationOptionActive]}
              onPress={() => setDuration(days)}
            >
              <Text style={[styles.durationText, duration === days && styles.durationTextActive]}>
                {days} days
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Cost Summary */}
      <View style={styles.costSummary}>
        <Text style={styles.costLabel}>Total Cost</Text>
        <View style={styles.costValue}>
          <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFD700" />
          <Text style={styles.costAmount}>{totalCost} Sparks</Text>
        </View>
      </View>
    </Animatable.View>
  );

  const renderStep5 = () => (
    <Animatable.View animation="fadeInRight" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Preview & Launch</Text>
      <Text style={styles.stepSubtitle}>Review your campaign before launching</Text>

      {/* Campaign Name */}
      <View style={styles.nameSection}>
        <Text style={styles.nameLabel}>Campaign Name</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="Enter campaign name..."
          placeholderTextColor="#666"
          value={campaignName}
          onChangeText={setCampaignName}
        />
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Goal</Text>
          <Text style={styles.summaryValue}>
            {GOALS.find(g => g.id === selectedGoal)?.label || 'Not selected'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Audience</Text>
          <Text style={styles.summaryValue}>
            {selectedInterests.length > 0 ? selectedInterests.join(', ') : 'All users'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Duration</Text>
          <Text style={styles.summaryValue}>{duration} days</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Budget</Text>
          <View style={styles.summaryBudget}>
            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFD700" />
            <Text style={styles.summaryBudgetText}>{sparkBudget} Sparks</Text>
          </View>
        </View>
      </View>

      {/* Estimated Results */}
      <View style={styles.estimateCard}>
        <Text style={styles.estimateTitle}>Estimated Results</Text>
        <View style={styles.estimateRow}>
          <View style={styles.estimateItem}>
            <Text style={styles.estimateValue}>{Math.round(sparkBudget * 25)}</Text>
            <Text style={styles.estimateLabel}>Impressions</Text>
          </View>
          <View style={styles.estimateItem}>
            <Text style={styles.estimateValue}>{Math.round(sparkBudget * 1.5)}</Text>
            <Text style={styles.estimateLabel}>Engagements</Text>
          </View>
          <View style={styles.estimateItem}>
            <Text style={styles.estimateValue}>{Math.round(sparkBudget * 0.2)}</Text>
            <Text style={styles.estimateLabel}>Conversions</Text>
          </View>
        </View>
      </View>
    </Animatable.View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderStep1();
      case 1: return renderStep2();
      case 2: return renderStep3();
      case 3: return renderStep4();
      case 4: return renderStep5();
      default: return null;
    }
  };

  if (!isRegionalOrAbove) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Campaign</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <MaterialCommunityIcons name="shield-lock" size={64} color="#555" />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFF', marginTop: 16, marginBottom: 8 }}>Access Restricted</Text>
          <Text style={{ fontSize: 14, color: '#888', textAlign: 'center' }}>
            You need regional access or higher to create campaigns.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name={currentStep === 0 ? 'close' : 'arrow-back'} size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Campaign</Text>
        <TouchableOpacity onPress={handleSaveDraft} style={styles.draftButton}>
          <Text style={styles.draftButtonText}>Save Draft</Text>
        </TouchableOpacity>
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {renderCurrentStep()}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigationContainer}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.backNavButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#888" />
            <Text style={styles.backNavText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
            currentStep === STEPS.length - 1 && styles.launchButton,
          ]}
          onPress={handleNext}
          disabled={!canProceed()}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === STEPS.length - 1 ? 'Launch Campaign' : 'Next'}
          </Text>
          {currentStep === STEPS.length - 1 ? (
            <MaterialCommunityIcons name="rocket-launch" size={20} color="#121212" />
          ) : (
            <Ionicons name="arrow-forward" size={20} color="#121212" />
          )}
        </TouchableOpacity>
      </View>

      {/* Confetti */}
      <ConfettiOverlay visible={showConfetti} onComplete={() => setShowConfetti(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    textAlign: 'center',
  },
  draftButton: {
    padding: 4,
  },
  draftButtonText: {
    color: '#00e89d',
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  stepIndicator: {
    flexDirection: 'row',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    alignItems: 'center',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2A3E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#00e89d',
  },
  stepCircleCurrent: {
    borderWidth: 2,
    borderColor: '#FFF',
  },
  stepNumber: {
    color: '#666',
    fontSize: wp('3%'),
    fontWeight: '700',
  },
  stepNumberActive: {
    color: '#121212',
  },
  stepLabel: {
    color: '#666',
    fontSize: wp('2.5%'),
    marginTop: 4,
  },
  stepLabelActive: {
    color: '#FFF',
  },
  stepConnector: {
    position: 'absolute',
    top: 14,
    left: '60%',
    width: '80%',
    height: 2,
    backgroundColor: '#2A2A3E',
  },
  stepConnectorActive: {
    backgroundColor: '#00e89d',
  },
  scrollContent: {
    paddingBottom: hp('15%'),
  },
  stepContent: {
    paddingHorizontal: wp('4%'),
    paddingTop: hp('2%'),
  },
  stepTitle: {
    color: '#FFF',
    fontSize: wp('5.5%'),
    fontWeight: '800',
    marginBottom: 4,
  },
  stepSubtitle: {
    color: '#888',
    fontSize: wp('3.5%'),
    marginBottom: hp('2.5%'),
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  goalCard: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2A2A',
    position: 'relative',
  },
  goalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalLabel: {
    color: '#FFF',
    fontSize: wp('3.8%'),
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  goalDesc: {
    color: '#888',
    fontSize: wp('2.8%'),
    textAlign: 'center',
  },
  goalSelected: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentPlaceholder: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('8%'),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderStyle: 'dashed',
  },
  contentPlaceholderText: {
    color: '#888',
    fontSize: wp('3.5%'),
    marginTop: hp('1.5%'),
    marginBottom: hp('2%'),
  },
  selectContentButton: {
    backgroundColor: '#00e89d',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1%'),
    borderRadius: 20,
  },
  selectContentText: {
    color: '#121212',
    fontSize: wp('3.5%'),
    fontWeight: '700',
  },
  audienceSection: {
    marginBottom: hp('2.5%'),
  },
  audienceSectionTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('1%'),
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  selectButtonText: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('3.5%'),
    marginLeft: 10,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  interestChipActive: {
    backgroundColor: '#00e89d22',
    borderColor: '#00e89d',
  },
  interestChipText: {
    color: '#888',
    fontSize: wp('3%'),
    fontWeight: '600',
  },
  interestChipTextActive: {
    color: '#00e89d',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleText: {
    marginLeft: 12,
  },
  toggleTitle: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  toggleDesc: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3A3A4E',
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#00e89d',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#888',
  },
  toggleKnobActive: {
    backgroundColor: '#FFF',
    alignSelf: 'flex-end',
  },
  budgetCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('5%'),
    marginBottom: hp('2.5%'),
    borderWidth: 1,
    borderColor: '#FFD70044',
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('1.5%'),
  },
  budgetValue: {
    color: '#FFD700',
    fontSize: wp('6%'),
    fontWeight: '800',
    marginLeft: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    color: '#666',
    fontSize: wp('2.8%'),
  },
  durationSection: {
    marginBottom: hp('2.5%'),
  },
  durationTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('1%'),
  },
  durationOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  durationOption: {
    flex: 1,
    paddingVertical: hp('1.2%'),
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  durationOptionActive: {
    backgroundColor: '#00e89d22',
    borderColor: '#00e89d',
  },
  durationText: {
    color: '#888',
    fontSize: wp('3.2%'),
    fontWeight: '600',
  },
  durationTextActive: {
    color: '#00e89d',
  },
  costSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  costLabel: {
    color: '#888',
    fontSize: wp('3.5%'),
  },
  costValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  costAmount: {
    color: '#FFD700',
    fontSize: wp('4.5%'),
    fontWeight: '700',
    marginLeft: 6,
  },
  nameSection: {
    marginBottom: hp('2.5%'),
  },
  nameLabel: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('1%'),
  },
  nameInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    color: '#FFF',
    fontSize: wp('4%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  summaryCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp('1%'),
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  summaryLabel: {
    color: '#888',
    fontSize: wp('3.5%'),
  },
  summaryValue: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  summaryBudget: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryBudgetText: {
    color: '#FFD700',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    marginLeft: 4,
  },
  estimateCard: {
    backgroundColor: '#00e89d11',
    borderRadius: 16,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#00e89d44',
  },
  estimateTitle: {
    color: '#00e89d',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
    textAlign: 'center',
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  estimateItem: {
    alignItems: 'center',
  },
  estimateValue: {
    color: '#FFF',
    fontSize: wp('5%'),
    fontWeight: '800',
  },
  estimateLabel: {
    color: '#888',
    fontSize: wp('2.8%'),
    marginTop: 2,
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  backNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1.2%'),
    paddingHorizontal: wp('4%'),
    marginRight: 10,
  },
  backNavText: {
    color: '#888',
    fontSize: wp('3.5%'),
    marginLeft: 4,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00e89d',
    paddingVertical: hp('1.5%'),
    borderRadius: 12,
  },
  nextButtonDisabled: {
    backgroundColor: '#3A3A4E',
  },
  launchButton: {
    backgroundColor: '#FFD700',
  },
  nextButtonText: {
    color: '#121212',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginRight: 8,
  },
});

export default CampaignStudioScreen;
