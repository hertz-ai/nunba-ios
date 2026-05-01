import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import * as Animatable from 'react-native-animatable';

const ProximityBanner = ({ nearbyCount, isScanning }) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Animatable.View
          animation="pulse"
          iterationCount="infinite"
          duration={1500}
          style={styles.pulsingDot}
        />
        <Text style={styles.countText}>
          {isScanning
            ? 'Scanning...'
            : `${nearbyCount} ${nearbyCount === 1 ? 'person' : 'people'} nearby`}
        </Text>
      </View>
      <View style={styles.liveBadge}>
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a2a3a',
    marginHorizontal: wp('3%'),
    marginVertical: hp('1%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3a4a',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00e89d',
    marginRight: 10,
  },
  countText: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  liveBadge: {
    backgroundColor: '#00e89d',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveText: {
    color: '#1a1a2e',
    fontSize: wp('2.5%'),
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default ProximityBanner;
