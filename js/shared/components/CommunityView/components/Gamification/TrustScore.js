import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SkeletonLoader from './SkeletonLoader';

const AXES = [
  { key: 'skill', label: 'Skill', angle: -90 },
  { key: 'usefulness', label: 'Usefulness', angle: -18 },
  { key: 'reliability', label: 'Reliability', angle: 54 },
  { key: 'creativity', label: 'Creativity', angle: 126 },
  { key: 'overall', label: 'Overall', angle: 198 },
];

const getScoreColor = (score) => {
  if (score >= 90) return '#10B981';
  if (score >= 70) return '#3B82F6';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
};

const getScoreLabel = (score) => {
  if (score >= 90) return 'Exceptional';
  if (score >= 70) return 'Trusted';
  if (score >= 50) return 'Building';
  return 'New';
};

const RadarChart = ({ scores, size }) => {
  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = size * 0.4;

  const getPointPosition = (angle, radius) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad),
    };
  };

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <View style={[styles.radarContainer, { width: size, height: size }]}>
      {rings.map((ring, index) => (
        <View
          key={index}
          style={[
            styles.radarRing,
            {
              width: maxRadius * 2 * ring,
              height: maxRadius * 2 * ring,
              borderRadius: maxRadius * ring,
              left: centerX - maxRadius * ring,
              top: centerY - maxRadius * ring,
            },
          ]}
        />
      ))}

      {AXES.map((axis) => {
        const endPoint = getPointPosition(axis.angle, maxRadius);
        const dx = endPoint.x - centerX;
        const dy = endPoint.y - centerY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const rotation = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <View
            key={axis.key}
            style={[
              styles.radarAxis,
              {
                width: length,
                left: centerX,
                top: centerY,
                transform: [
                  { translateY: -0.5 },
                  { rotate: `${rotation}deg` },
                ],
                transformOrigin: 'left center',
              },
            ]}
          />
        );
      })}

      {AXES.map((axis) => {
        const score = scores[axis.key] || 0;
        const normalizedScore = score / 100;
        const radius = maxRadius * normalizedScore;
        const point = getPointPosition(axis.angle, radius);

        return (
          <Animatable.View
            key={axis.key}
            animation="zoomIn"
            delay={AXES.indexOf(axis) * 100}
            style={[
              styles.scorePoint,
              {
                left: point.x - wp('2%'),
                top: point.y - wp('2%'),
                backgroundColor: getScoreColor(score),
              },
            ]}
          />
        );
      })}

      {AXES.map((axis) => {
        const labelPoint = getPointPosition(axis.angle, maxRadius + wp('6%'));
        return (
          <Text
            key={`label-${axis.key}`}
            style={[
              styles.axisLabel,
              {
                left: labelPoint.x - wp('8%'),
                top: labelPoint.y - hp('1%'),
              },
            ]}
          >
            {axis.label}
          </Text>
        );
      })}
    </View>
  );
};

const CompactTrustScore = ({ overallScore, size = 'small' }) => {
  const scoreColor = getScoreColor(overallScore);
  const scoreLabel = getScoreLabel(overallScore);
  const iconSize = size === 'small' ? wp('4%') : wp('6%');
  const fontSize = size === 'small' ? wp('3.5%') : wp('5%');

  return (
    <View style={styles.compactContainer}>
      <View
        style={[
          styles.compactBadge,
          { backgroundColor: scoreColor + '20', borderColor: scoreColor },
        ]}
      >
        <MaterialCommunityIcons
          name="shield-check"
          size={iconSize}
          color={scoreColor}
        />
        <Text style={[styles.compactScore, { color: scoreColor, fontSize }]}>
          {overallScore}
        </Text>
      </View>
      <Text style={styles.compactLabel}>{scoreLabel}</Text>
    </View>
  );
};

const TrustScore = ({
  scores = {
    skill: 0,
    usefulness: 0,
    reliability: 0,
    creativity: 0,
    overall: 0,
  },
  compact = false,
  size = wp('60%'),
  loading = false,
}) => {
  if (loading) {
    return compact ? (
      <SkeletonLoader width={wp('20%')} height={hp('5%')} borderRadius={12} />
    ) : (
      <View style={styles.container}>
        <SkeletonLoader width={size} height={size} borderRadius={size / 2} />
      </View>
    );
  }

  if (compact) {
    return <CompactTrustScore overallScore={scores.overall} size="small" />;
  }

  const overallScore = scores.overall;
  const scoreColor = getScoreColor(overallScore);

  return (
    <Animatable.View
      animation="fadeIn"
      duration={600}
      style={styles.container}
    >
      <Text style={styles.title}>Trust Score</Text>

      <RadarChart scores={scores} size={size} />

      <View style={styles.overallSection}>
        <View
          style={[
            styles.overallBadge,
            { backgroundColor: scoreColor + '20', borderColor: scoreColor },
          ]}
        >
          <MaterialCommunityIcons
            name="shield-check"
            size={wp('6%')}
            color={scoreColor}
          />
          <Text style={[styles.overallScore, { color: scoreColor }]}>
            {overallScore}
          </Text>
        </View>
        <Text style={[styles.overallLabel, { color: scoreColor }]}>
          {getScoreLabel(overallScore)}
        </Text>
      </View>

      <View style={styles.breakdownSection}>
        {AXES.filter((axis) => axis.key !== 'overall').map((axis) => (
          <View key={axis.key} style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>{axis.label}</Text>
            <View style={styles.breakdownBar}>
              <Animatable.View
                animation="slideInLeft"
                duration={800}
                style={[
                  styles.breakdownFill,
                  {
                    width: `${scores[axis.key]}%`,
                    backgroundColor: getScoreColor(scores[axis.key]),
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.breakdownValue,
                { color: getScoreColor(scores[axis.key]) },
              ]}
            >
              {scores[axis.key]}
            </Text>
          </View>
        ))}
      </View>
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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  title: {
    color: '#FFFFFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
    marginBottom: hp('2%'),
  },
  radarContainer: {
    position: 'relative',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  radarAxis: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  scorePoint: {
    position: 'absolute',
    width: wp('4%'),
    height: wp('4%'),
    borderRadius: wp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  axisLabel: {
    position: 'absolute',
    color: '#888',
    fontSize: wp('2.5%'),
    fontWeight: '600',
    width: wp('16%'),
    textAlign: 'center',
  },
  overallSection: {
    alignItems: 'center',
    marginTop: hp('2%'),
  },
  overallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    borderRadius: 16,
    borderWidth: 2,
  },
  overallScore: {
    fontSize: wp('6%'),
    fontWeight: '800',
    marginLeft: wp('2%'),
  },
  overallLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginTop: hp('0.5%'),
  },
  breakdownSection: {
    width: '100%',
    marginTop: hp('2%'),
    paddingTop: hp('2%'),
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  breakdownLabel: {
    color: '#888',
    fontSize: wp('3%'),
    width: wp('22%'),
  },
  breakdownBar: {
    flex: 1,
    height: hp('0.8%'),
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    marginHorizontal: wp('2%'),
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 4,
  },
  breakdownValue: {
    fontSize: wp('3%'),
    fontWeight: '700',
    width: wp('8%'),
    textAlign: 'right',
  },
  compactContainer: {
    alignItems: 'center',
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: 10,
    borderWidth: 1,
  },
  compactScore: {
    fontWeight: '700',
    marginLeft: wp('1%'),
  },
  compactLabel: {
    color: '#666',
    fontSize: wp('2.5%'),
    marginTop: hp('0.2%'),
  },
});

export default TrustScore;
