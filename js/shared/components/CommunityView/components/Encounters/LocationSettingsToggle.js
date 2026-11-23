import React, { useCallback } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useEncounterStore from '../../../../encounterStore';
import { enableTracking, disableTracking } from '../../../../services/encounterTracker';

// The switch drives the real tracker.  It used to only flip isTracking in the
// store: switching off hid the screen's state while the GPS watch and the
// pings kept running, and switching on showed "on" with no watch at all.
const LocationSettingsToggle = () => {
  const isTracking = useEncounterStore((s) => s.isTracking);

  const handleToggle = useCallback((value) => (value ? enableTracking() : disableTracking()), []);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MaterialIcons name="my-location" size={22} color="#6C63FF" />
        <Text style={styles.label}>Location Sharing</Text>
        <Switch
          value={isTracking}
          onValueChange={handleToggle}
          trackColor={{ false: '#3a3a4e', true: '#6C63FF55' }}
          thumbColor={isTracking ? '#6C63FF' : '#888'}
        />
      </View>
      <Text style={styles.privacyText}>
        Your exact location is never shared. Only approximate distance is shown.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    flex: 1,
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginLeft: 10,
  },
  privacyText: {
    color: '#666',
    fontSize: wp('2.8%'),
    marginTop: 6,
    lineHeight: 16,
  },
});

export default LocationSettingsToggle;
