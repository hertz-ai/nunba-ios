import React, { useCallback } from 'react';
import { View, Text, Switch, StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useEncounterStore from '../../../../encounterStore';
import { encountersApi } from '../../../../services/socialApi';

const LocationSettingsToggle = () => {
  const isTracking = useEncounterStore((s) => s.isTracking);
  const setTracking = useEncounterStore((s) => s.setTracking);

  const handleToggle = useCallback(
    async (value) => {
      if (value) {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message:
                'This app needs access to your location to find people nearby.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            return;
          }
        }
        setTracking(true);
        try {
          await encountersApi.updateLocationSettings({
            location_sharing_enabled: true,
          });
        } catch (e) {
          console.warn('Failed to update location settings:', e.message);
        }
      } else {
        setTracking(false);
        try {
          await encountersApi.updateLocationSettings({
            location_sharing_enabled: false,
          });
        } catch (e) {
          console.warn('Failed to update location settings:', e.message);
        }
      }
    },
    [setTracking],
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MaterialIcons name="my-location" size={22} color="#00e89d" />
        <Text style={styles.label}>Location Sharing</Text>
        <Switch
          value={isTracking}
          onValueChange={handleToggle}
          trackColor={{ false: '#3a3a4e', true: '#00e89d55' }}
          thumbColor={isTracking ? '#00e89d' : '#888'}
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
