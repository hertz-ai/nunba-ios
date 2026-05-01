import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
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
import { useNavigation } from '@react-navigation/native';

import { onboardingApi } from '../../../services/socialApi';
import { ConfettiOverlay, OnboardingChecklist } from '../components/Gamification';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    icon: 'hand-wave',
    iconColor: '#FFD700',
    title: 'Welcome to Hevolve!',
    description: 'Join millions of creators and AI agents building the future of social interaction.',
    reward: 10,
    actionType: 'continue',
  },
  {
    id: 'interests',
    icon: 'heart-multiple',
    iconColor: '#EF4444',
    title: 'Pick Your Interests',
    description: 'Help us personalize your experience by selecting topics you care about.',
    reward: 25,
    actionType: 'interests',
    options: ['Technology', 'Art & Design', 'Gaming', 'Music', 'Science', 'Sports', 'Business', 'Lifestyle', 'Entertainment', 'Education'],
  },
  {
    id: 'handle',
    icon: 'at',
    iconColor: '#00D9FF',
    title: 'Claim Your Handle',
    description: 'Choose a unique handle that represents you across the platform.',
    reward: 50,
    actionType: 'handle',
  },
  {
    id: 'follow',
    icon: 'account-plus',
    iconColor: '#10B981',
    title: 'Follow Creators',
    description: 'Discover and follow creators that match your interests.',
    reward: 25,
    actionType: 'suggestions',
    suggestions: [
      { id: 's1', name: 'TechGuru', handle: '@techguru', avatar: null },
      { id: 's2', name: 'ArtMaster', handle: '@artmaster', avatar: null },
      { id: 's3', name: 'GamePro', handle: '@gamepro', avatar: null },
    ],
  },
  {
    id: 'interact',
    icon: 'message-text',
    iconColor: '#9D4EDD',
    title: 'Your First Interaction',
    description: 'Like or comment on a post to start engaging with the community.',
    reward: 50,
    actionType: 'sample_post',
  },
  {
    id: 'join',
    icon: 'account-group',
    iconColor: '#FF6B35',
    title: 'Join a Community',
    description: 'Regions are communities built around shared interests. Find your tribe!',
    reward: 75,
    actionType: 'regions',
    regions: [
      { id: 'r1', name: 'Tech Enthusiasts', members: 45000 },
      { id: 'r2', name: 'Creative Hub', members: 32000 },
      { id: 'r3', name: 'Gaming Zone', members: 78000 },
    ],
  },
  {
    id: 'create',
    icon: 'plus-circle',
    iconColor: '#00e89d',
    title: 'Create Something',
    description: 'Share your first post with the world. It can be anything - a thought, image, or idea!',
    reward: 100,
    actionType: 'create',
  },
  {
    id: 'try_kids_zone',
    icon: 'gamepad-variant',
    iconColor: '#FF6B6B',
    title: 'Try Kids Zone',
    description: 'Fun learning games for young minds!',
    reward: 50,
    actionType: 'KidsHub',
  },
  {
    id: 'explore_encounters',
    icon: 'compass-outline',
    iconColor: '#6C63FF',
    title: 'Explore Encounters',
    description: 'Discover people and ideas nearby.',
    reward: 25,
    actionType: 'Encounters',
  },
  {
    id: 'check_resonance',
    icon: 'wallet-outline',
    iconColor: '#00D9FF',
    title: 'Check Resonance',
    description: 'See your reputation and level up!',
    reward: 25,
    actionType: 'ResonanceDashboard',
  },
];

const OnboardingOverlayScreen = () => {
  const navigation = useNavigation();
  const flatListRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [handle, setHandle] = useState('');
  const [handleAvailable, setHandleAvailable] = useState(null);
  const [followedSuggestions, setFollowedSuggestions] = useState([]);
  const [joinedRegions, setJoinedRegions] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [totalRewards, setTotalRewards] = useState(0);

  const currentStepData = ONBOARDING_STEPS[currentStep];

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const res = await onboardingApi.getProgress();
        if (res.data?.completedSteps) setCompletedSteps(res.data.completedSteps);
      } catch (e) { /* start fresh */ }
    };
    loadProgress();
  }, []);

  const handleCompleteStep = async (stepIndex) => {
    try {
      await onboardingApi.completeStep({ step: stepIndex });
    } catch (e) { /* fire and forget */ }
  };

  const handleNext = () => {
    // Mark current step as completed
    if (!completedSteps.includes(currentStepData.id)) {
      setCompletedSteps([...completedSteps, currentStepData.id]);
      setTotalRewards(totalRewards + currentStepData.reward);
      handleCompleteStep(currentStep);
    }

    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      flatListRef.current?.scrollToIndex({ index: currentStep + 1, animated: true });
    } else {
      // Complete onboarding
      setShowConfetti(true);
      setTimeout(() => {
        navigation.goBack();
      }, 3000);
    }
  };

  const handleSkip = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      flatListRef.current?.scrollToIndex({ index: currentStep + 1, animated: true });
    } else {
      navigation.goBack();
    }
  };

  const handleDismiss = async () => {
    try { await onboardingApi.dismiss(); } catch (e) {}
    navigation.goBack();
  };

  const handleCheckHandle = (text) => {
    setHandle(text);
    if (text.length >= 3) {
      // Simulate check
      setTimeout(() => {
        setHandleAvailable(text.toLowerCase() !== 'taken');
      }, 500);
    } else {
      setHandleAvailable(null);
    }
  };

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const toggleFollow = (id) => {
    if (followedSuggestions.includes(id)) {
      setFollowedSuggestions(followedSuggestions.filter(i => i !== id));
    } else {
      setFollowedSuggestions([...followedSuggestions, id]);
    }
  };

  const toggleRegion = (id) => {
    if (joinedRegions.includes(id)) {
      setJoinedRegions(joinedRegions.filter(i => i !== id));
    } else {
      setJoinedRegions([...joinedRegions, id]);
    }
  };

  const canProceed = () => {
    switch (currentStepData.actionType) {
      case 'interests': return selectedInterests.length >= 3;
      case 'handle': return handle.length >= 3 && handleAvailable;
      case 'suggestions': return followedSuggestions.length >= 1;
      case 'regions': return joinedRegions.length >= 1;
      default: return true;
    }
  };

  const renderStepContent = () => {
    switch (currentStepData.actionType) {
      case 'interests':
        return (
          <View style={styles.interestsGrid}>
            {currentStepData.options.map((interest) => (
              <TouchableOpacity
                key={interest}
                style={[
                  styles.interestChip,
                  selectedInterests.includes(interest) && styles.interestChipActive,
                ]}
                onPress={() => toggleInterest(interest)}
              >
                <Text style={[
                  styles.interestText,
                  selectedInterests.includes(interest) && styles.interestTextActive,
                ]}>
                  {interest}
                </Text>
                {selectedInterests.includes(interest) && (
                  <Ionicons name="checkmark" size={16} color="#00e89d" style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            ))}
            <Text style={styles.selectionHint}>Select at least 3 interests</Text>
          </View>
        );

      case 'handle':
        return (
          <View style={styles.handleSection}>
            <View style={styles.handleInputContainer}>
              <Text style={styles.handlePrefix}>@</Text>
              <TextInput
                style={styles.handleInput}
                placeholder="yourhandle"
                placeholderTextColor="#666"
                value={handle}
                onChangeText={handleCheckHandle}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {handleAvailable !== null && (
                <Ionicons
                  name={handleAvailable ? 'checkmark-circle' : 'close-circle'}
                  size={24}
                  color={handleAvailable ? '#10B981' : '#EF4444'}
                />
              )}
            </View>
            {handleAvailable !== null && (
              <Text style={[styles.handleStatus, { color: handleAvailable ? '#10B981' : '#EF4444' }]}>
                {handleAvailable ? 'Handle is available!' : 'Handle is taken, try another'}
              </Text>
            )}
          </View>
        );

      case 'suggestions':
        return (
          <View style={styles.suggestionsSection}>
            {currentStepData.suggestions.map((suggestion) => (
              <View key={suggestion.id} style={styles.suggestionCard}>
                <View style={styles.suggestionAvatar}>
                  <Ionicons name="person" size={24} color="#888" />
                </View>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName}>{suggestion.name}</Text>
                  <Text style={styles.suggestionHandle}>{suggestion.handle}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    followedSuggestions.includes(suggestion.id) && styles.followButtonActive,
                  ]}
                  onPress={() => toggleFollow(suggestion.id)}
                >
                  <Text style={[
                    styles.followButtonText,
                    followedSuggestions.includes(suggestion.id) && styles.followButtonTextActive,
                  ]}>
                    {followedSuggestions.includes(suggestion.id) ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );

      case 'sample_post':
        return (
          <View style={styles.samplePostSection}>
            <View style={styles.samplePost}>
              <View style={styles.samplePostHeader}>
                <View style={styles.samplePostAvatar}>
                  <Ionicons name="person" size={20} color="#888" />
                </View>
                <View style={styles.samplePostInfo}>
                  <Text style={styles.samplePostName}>Welcome Bot</Text>
                  <Text style={styles.samplePostHandle}>@welcome</Text>
                </View>
              </View>
              <Text style={styles.samplePostContent}>
                Welcome to Hevolve! We are excited to have you here. Get ready to explore, create, and connect!
              </Text>
              <View style={styles.samplePostActions}>
                <TouchableOpacity style={styles.samplePostAction} onPress={handleNext}>
                  <Ionicons name="heart-outline" size={24} color="#888" />
                  <Text style={styles.samplePostActionText}>Like</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.samplePostAction} onPress={handleNext}>
                  <Ionicons name="chatbubble-outline" size={22} color="#888" />
                  <Text style={styles.samplePostActionText}>Comment</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case 'regions':
        return (
          <View style={styles.regionsSection}>
            {currentStepData.regions.map((region) => (
              <TouchableOpacity
                key={region.id}
                style={[
                  styles.regionCard,
                  joinedRegions.includes(region.id) && styles.regionCardActive,
                ]}
                onPress={() => toggleRegion(region.id)}
              >
                <View style={styles.regionIcon}>
                  <MaterialCommunityIcons name="earth" size={28} color="#00D9FF" />
                </View>
                <View style={styles.regionInfo}>
                  <Text style={styles.regionName}>{region.name}</Text>
                  <Text style={styles.regionMembers}>{region.members.toLocaleString()} members</Text>
                </View>
                {joinedRegions.includes(region.id) ? (
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                ) : (
                  <Ionicons name="add-circle-outline" size={24} color="#888" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'create':
        return (
          <View style={styles.createSection}>
            <TouchableOpacity style={styles.createButton} onPress={handleNext}>
              <MaterialCommunityIcons name="pencil-plus" size={32} color="#00e89d" />
              <Text style={styles.createButtonText}>Create Your First Post</Text>
            </TouchableOpacity>
            <Text style={styles.createHint}>Don't worry, you can skip this for now</Text>
          </View>
        );

      default:
        return null;
    }
  };

  const renderStep = ({ item, index }) => (
    <View style={styles.stepContainer}>
      <Animatable.View animation="fadeIn" style={styles.stepContent}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${item.iconColor}22` }]}>
          <MaterialCommunityIcons name={item.icon} size={48} color={item.iconColor} />
        </View>

        {/* Title & Description */}
        <Text style={styles.stepTitle}>{item.title}</Text>
        <Text style={styles.stepDescription}>{item.description}</Text>

        {/* Reward Badge */}
        <View style={styles.rewardBadge}>
          <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFD700" />
          <Text style={styles.rewardText}>+{item.reward} Sparks</Text>
        </View>

        {/* Action Area */}
        {index === currentStep && renderStepContent()}
      </Animatable.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={24} color="#888" />
        </TouchableOpacity>
        <View style={styles.stepIndicator}>
          {ONBOARDING_STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.stepDot,
                index === currentStep && styles.stepDotActive,
                index < currentStep && styles.stepDotCompleted,
              ]}
            />
          ))}
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Steps */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_STEPS}
        keyExtractor={(item) => item.id}
        renderItem={renderStep}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Navigation */}
      <View style={styles.navigationContainer}>
        <View style={styles.totalRewards}>
          <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFD700" />
          <Text style={styles.totalRewardsText}>{totalRewards} Sparks Earned</Text>
        </View>
        <TouchableOpacity
          style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed()}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === ONBOARDING_STEPS.length - 1 ? 'Complete' : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#121212" />
        </TouchableOpacity>
      </View>

      {/* Confetti */}
      <ConfettiOverlay visible={showConfetti} onComplete={() => {}} />

      {/* Completion Celebration */}
      {showConfetti && (
        <Animatable.View animation="zoomIn" style={styles.celebrationOverlay}>
          <View style={styles.celebrationCard}>
            <MaterialCommunityIcons name="party-popper" size={64} color="#FFD700" />
            <Text style={styles.celebrationTitle}>Onboarding Complete!</Text>
            <Text style={styles.celebrationSubtitle}>You earned {totalRewards} Sparks</Text>
            <View style={styles.celebrationReward}>
              <MaterialCommunityIcons name="lightning-bolt" size={32} color="#FFD700" />
              <Text style={styles.celebrationRewardText}>{totalRewards}</Text>
            </View>
          </View>
        </Animatable.View>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
  },
  dismissButton: {
    padding: 4,
    width: 60,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3A3A4E',
  },
  stepDotActive: {
    width: 24,
    backgroundColor: '#00e89d',
  },
  stepDotCompleted: {
    backgroundColor: '#00e89d',
  },
  skipButton: {
    padding: 4,
    width: 60,
    alignItems: 'flex-end',
  },
  skipText: {
    color: '#888',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  stepContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  stepContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: wp('6%'),
    paddingTop: hp('5%'),
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('3%'),
  },
  stepTitle: {
    color: '#FFF',
    fontSize: wp('6.5%'),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: hp('1%'),
  },
  stepDescription: {
    color: '#888',
    fontSize: wp('4%'),
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: hp('2%'),
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70022',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 20,
    marginBottom: hp('3%'),
  },
  rewardText: {
    color: '#FFD700',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    marginLeft: 6,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  interestChipActive: {
    backgroundColor: '#00e89d22',
    borderColor: '#00e89d',
  },
  interestText: {
    color: '#888',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  interestTextActive: {
    color: '#00e89d',
  },
  selectionHint: {
    color: '#666',
    fontSize: wp('3%'),
    marginTop: hp('1.5%'),
    width: '100%',
    textAlign: 'center',
  },
  handleSection: {
    width: '100%',
    alignItems: 'center',
  },
  handleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    width: '100%',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  handlePrefix: {
    color: '#888',
    fontSize: wp('5%'),
    fontWeight: '600',
  },
  handleInput: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('5%'),
    marginLeft: 4,
  },
  handleStatus: {
    fontSize: wp('3%'),
    marginTop: hp('1%'),
  },
  suggestionsSection: {
    width: '100%',
    gap: 10,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  suggestionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A3E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionName: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
  suggestionHandle: {
    color: '#888',
    fontSize: wp('3%'),
  },
  followButton: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    backgroundColor: '#00e89d',
    borderRadius: 16,
  },
  followButtonActive: {
    backgroundColor: '#00e89d22',
    borderWidth: 1,
    borderColor: '#00e89d',
  },
  followButtonText: {
    color: '#121212',
    fontSize: wp('3.2%'),
    fontWeight: '700',
  },
  followButtonTextActive: {
    color: '#00e89d',
  },
  samplePostSection: {
    width: '100%',
  },
  samplePost: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  samplePostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  samplePostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A3E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  samplePostInfo: {
    marginLeft: 10,
  },
  samplePostName: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  samplePostHandle: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
  samplePostContent: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    lineHeight: 22,
    marginBottom: hp('1.5%'),
  },
  samplePostActions: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: hp('1%'),
    borderTopWidth: 1,
    borderTopColor: '#2A2A3E',
  },
  samplePostAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  samplePostActionText: {
    color: '#888',
    fontSize: wp('3%'),
    marginLeft: 6,
  },
  regionsSection: {
    width: '100%',
    gap: 10,
  },
  regionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: wp('3%'),
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  regionCardActive: {
    borderColor: '#10B981',
    backgroundColor: '#10B98111',
  },
  regionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00D9FF22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  regionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  regionName: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
  regionMembers: {
    color: '#888',
    fontSize: wp('3%'),
  },
  createSection: {
    width: '100%',
    alignItems: 'center',
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#00e89d22',
    borderRadius: 16,
    padding: wp('6%'),
    width: '100%',
    borderWidth: 2,
    borderColor: '#00e89d',
    borderStyle: 'dashed',
  },
  createButtonText: {
    color: '#00e89d',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginTop: hp('1%'),
  },
  createHint: {
    color: '#666',
    fontSize: wp('3%'),
    marginTop: hp('1.5%'),
  },
  navigationContainer: {
    padding: wp('4%'),
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  totalRewards: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('1.5%'),
  },
  totalRewardsText: {
    color: '#FFD700',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginLeft: 6,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00e89d',
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
  },
  nextButtonDisabled: {
    backgroundColor: '#3A3A4E',
  },
  nextButtonText: {
    color: '#121212',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginRight: 8,
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  celebrationCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: wp('8%'),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  celebrationTitle: {
    color: '#FFF',
    fontSize: wp('6%'),
    fontWeight: '800',
    marginTop: hp('2%'),
  },
  celebrationSubtitle: {
    color: '#888',
    fontSize: wp('4%'),
    marginTop: hp('1%'),
  },
  celebrationReward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70022',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    borderRadius: 20,
    marginTop: hp('2%'),
  },
  celebrationRewardText: {
    color: '#FFD700',
    fontSize: wp('8%'),
    fontWeight: '800',
    marginLeft: 8,
  },
});

export default OnboardingOverlayScreen;
