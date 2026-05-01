import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LevelBadge from './LevelBadge';
import SkeletonLoader from './SkeletonLoader';

const CURRENCIES = [
  {
    id: 'pulse',
    name: 'Pulse',
    icon: 'heart-pulse',
    colors: { primary: '#EF4444', secondary: '#DC2626', bg: '#2D1F1F' },
  },
  {
    id: 'spark',
    name: 'Spark',
    icon: 'lightning-bolt',
    colors: { primary: '#F59E0B', secondary: '#D97706', bg: '#2D2A1F' },
  },
  {
    id: 'signal',
    name: 'Signal',
    icon: 'broadcast',
    colors: { primary: '#8B5CF6', secondary: '#7C3AED', bg: '#251F2D' },
  },
  {
    id: 'xp',
    name: 'XP',
    icon: 'star-four-points',
    colors: { primary: '#10B981', secondary: '#059669', bg: '#1F2D25' },
  },
];

const AnimatedCounter = ({ value, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();

    const listener = animatedValue.addListener(({ value: v }) => {
      setDisplayValue(Math.floor(v));
    });

    return () => animatedValue.removeListener(listener);
  }, [value, duration, animatedValue]);

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return <Text style={styles.currencyValue}>{formatNumber(displayValue)}</Text>;
};

const CurrencyCard = ({ currency, amount, onPress, delay = 0 }) => {
  return (
    <Animatable.View
      animation="fadeInRight"
      delay={delay}
      duration={500}
      useNativeDriver
    >
      <TouchableOpacity
        style={[styles.currencyCard, { backgroundColor: currency.colors.bg }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.currencyIconContainer,
            { backgroundColor: currency.colors.primary + '20' },
          ]}
        >
          <MaterialCommunityIcons
            name={currency.icon}
            size={wp('6%')}
            color={currency.colors.primary}
          />
        </View>
        <Text style={styles.currencyName}>{currency.name}</Text>
        <AnimatedCounter value={amount} />
        <View
          style={[
            styles.currencyAccent,
            { backgroundColor: currency.colors.primary },
          ]}
        />
      </TouchableOpacity>
    </Animatable.View>
  );
};

const ResonanceWallet = ({
  balances = { pulse: 0, spark: 0, signal: 0, xp: 0 },
  level = 1,
  currentXP = 0,
  xpToNextLevel = 1000,
  onCurrencyPress,
  onLevelPress,
  loading = false,
}) => {
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SkeletonLoader variant="badge" />
          <View style={styles.headerText}>
            <SkeletonLoader width={wp('30%')} height={hp('2%')} />
            <SkeletonLoader
              width={wp('20%')}
              height={hp('1.5%')}
              style={{ marginTop: hp('0.5%') }}
            />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[...Array(4)].map((_, i) => (
            <SkeletonLoader
              key={i}
              variant="wallet"
              style={{ marginRight: wp('3%') }}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <Animatable.View animation="fadeIn" duration={600} style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={onLevelPress}
        activeOpacity={0.8}
      >
        <LevelBadge
          level={level}
          currentXP={currentXP}
          xpToNextLevel={xpToNextLevel}
          size="small"
        />
        <View style={styles.headerText}>
          <Text style={styles.walletTitle}>Resonance Wallet</Text>
          <Text style={styles.levelLabel}>
            Level {level} - {Math.round((currentXP / xpToNextLevel) * 100)}% to
            next
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={wp('6%')}
          color="#666"
        />
      </TouchableOpacity>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.currencyList}
      >
        {CURRENCIES.map((currency, index) => (
          <CurrencyCard
            key={currency.id}
            currency={currency}
            amount={balances[currency.id] || 0}
            onPress={() => onCurrencyPress && onCurrencyPress(currency.id)}
            delay={index * 100}
          />
        ))}
      </ScrollView>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: wp('4%'),
    marginHorizontal: wp('3%'),
    marginVertical: hp('1%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  headerText: {
    flex: 1,
    marginLeft: wp('3%'),
  },
  walletTitle: {
    color: '#FFFFFF',
    fontSize: wp('4.5%'),
    fontWeight: '700',
  },
  levelLabel: {
    color: '#888',
    fontSize: wp('3%'),
    marginTop: hp('0.3%'),
  },
  currencyList: {
    paddingVertical: hp('0.5%'),
  },
  currencyCard: {
    width: wp('35%'),
    padding: wp('4%'),
    borderRadius: 16,
    marginRight: wp('3%'),
    overflow: 'hidden',
  },
  currencyIconContainer: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  currencyName: {
    color: '#888',
    fontSize: wp('3%'),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
  },
  currencyValue: {
    color: '#FFFFFF',
    fontSize: wp('5%'),
    fontWeight: '800',
  },
  currencyAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});

export default ResonanceWallet;
