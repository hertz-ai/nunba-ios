import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const DIMENSIONS = [
  { key: 'skill', label: 'Skill', icon: 'brain' },
  { key: 'usefulness', label: 'Usefulness', icon: 'hand-heart' },
  { key: 'reliability', label: 'Reliability', icon: 'shield-check' },
  { key: 'creativity', label: 'Creativity', icon: 'lightbulb-on' },
];

const StarButton = ({ filled, onPress, size, delay = 0, disabled }) => {
  return (
    <Animatable.View animation="bounceIn" delay={delay} duration={400}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
      >
        <MaterialCommunityIcons
          name={filled ? 'star' : 'star-outline'}
          size={size}
          color={filled ? '#F59E0B' : '#3A3A3A'}
        />
      </TouchableOpacity>
    </Animatable.View>
  );
};

const RatingRow = ({
  dimension,
  value,
  onChange,
  starSize,
  showLabel = true,
  disabled = false,
}) => {
  return (
    <View style={styles.ratingRow}>
      {showLabel && (
        <View style={styles.labelContainer}>
          <MaterialCommunityIcons
            name={dimension.icon}
            size={wp('4%')}
            color="#666"
          />
          <Text style={styles.dimensionLabel}>{dimension.label}</Text>
        </View>
      )}
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <StarButton
            key={star}
            filled={star <= value}
            onPress={() => onChange && onChange(dimension.key, star)}
            size={starSize}
            delay={star * 50}
            disabled={disabled}
          />
        ))}
      </View>
      {showLabel && (
        <Text style={styles.ratingValue}>{value > 0 ? value.toFixed(1) : '-'}</Text>
      )}
    </View>
  );
};

const CompactStarRating = ({ averageRating, starSize = wp('5%'), onPress }) => {
  return (
    <TouchableOpacity
      style={styles.compactContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.compactStars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialCommunityIcons
            key={star}
            name={
              star <= Math.floor(averageRating)
                ? 'star'
                : star - 0.5 <= averageRating
                ? 'star-half-full'
                : 'star-outline'
            }
            size={starSize}
            color={star <= averageRating ? '#F59E0B' : '#3A3A3A'}
          />
        ))}
      </View>
      <Text style={styles.compactValue}>{averageRating.toFixed(1)}</Text>
    </TouchableOpacity>
  );
};

const StarRating = ({
  ratings = { skill: 0, usefulness: 0, reliability: 0, creativity: 0 },
  onChange,
  compact = false,
  disabled = false,
  showAverage = true,
  title = 'Rate this agent',
  loading = false,
}) => {
  const [localRatings, setLocalRatings] = useState(ratings);

  const handleRatingChange = (dimension, value) => {
    const newRatings = { ...localRatings, [dimension]: value };
    setLocalRatings(newRatings);
    onChange && onChange(newRatings);
  };

  const calculateAverage = () => {
    const values = Object.values(localRatings);
    const validValues = values.filter((v) => v > 0);
    if (validValues.length === 0) return 0;
    return validValues.reduce((a, b) => a + b, 0) / validValues.length;
  };

  const averageRating = calculateAverage();

  if (loading) {
    return compact ? (
      <SkeletonLoader width={wp('30%')} height={hp('3%')} borderRadius={8} />
    ) : (
      <View style={styles.container}>
        <SkeletonLoader width={wp('50%')} height={hp('2%')} />
        {[...Array(4)].map((_, i) => (
          <SkeletonLoader
            key={i}
            width={wp('80%')}
            height={hp('3%')}
            style={{ marginTop: hp('1%') }}
          />
        ))}
      </View>
    );
  }

  if (compact) {
    return <CompactStarRating averageRating={averageRating} />;
  }

  return (
    <Animatable.View animation="fadeIn" duration={500} style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {DIMENSIONS.map((dimension, index) => (
        <Animatable.View
          key={dimension.key}
          animation="fadeInUp"
          delay={index * 100}
        >
          <RatingRow
            dimension={dimension}
            value={localRatings[dimension.key]}
            onChange={handleRatingChange}
            starSize={wp('6%')}
            disabled={disabled}
          />
        </Animatable.View>
      ))}

      {showAverage && (
        <View style={styles.averageSection}>
          <View style={styles.averageDivider} />
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Overall Rating</Text>
            <View style={styles.averageStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <MaterialCommunityIcons
                  key={star}
                  name={
                    star <= Math.floor(averageRating)
                      ? 'star'
                      : star - 0.5 <= averageRating
                      ? 'star-half-full'
                      : 'star-outline'
                  }
                  size={wp('5%')}
                  color={star <= averageRating ? '#F59E0B' : '#3A3A3A'}
                />
              ))}
            </View>
            <Text style={styles.averageValue}>
              {averageRating > 0 ? averageRating.toFixed(1) : '-'}
            </Text>
          </View>
        </View>
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
  title: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('2%'),
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
    paddingVertical: hp('0.5%'),
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: wp('28%'),
  },
  dimensionLabel: {
    color: '#888',
    fontSize: wp('3%'),
    marginLeft: wp('2%'),
  },
  starsContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
  },
  ratingValue: {
    color: '#F59E0B',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    width: wp('10%'),
    textAlign: 'right',
  },
  averageSection: {
    marginTop: hp('1%'),
  },
  averageDivider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginBottom: hp('1.5%'),
  },
  averageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  averageLabel: {
    color: '#FFFFFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  averageStars: {
    flexDirection: 'row',
  },
  averageValue: {
    color: '#F59E0B',
    fontSize: wp('4.5%'),
    fontWeight: '800',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactStars: {
    flexDirection: 'row',
  },
  compactValue: {
    color: '#F59E0B',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    marginLeft: wp('2%'),
  },
});

export default StarRating;
