import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  NativeModules,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
// Probe react-native-maps native module before requiring (see
// MissedConnectionDetailScreen.js for rationale).  Falls back to a
// passive lat/lon placeholder when the iOS pod isn't installed.
let MapView = null;
let Marker = null;
let PROVIDER_GOOGLE = null;
try {
  if (NativeModules.AIRMapManager || NativeModules.AIRMapModule) {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps.MapView;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  }
} catch (_) {
  // pod not installed — leave MapView null and fall through to placeholder.
}
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import useEncounterStore from '../../../encounterStore';
import { encountersApi } from '../../../services/socialApi';
import AutoSuggestInput from '../components/Encounters/AutoSuggestInput';

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
];

const DEFAULT_LAT = 21.1458;
const DEFAULT_LON = 79.0882;

const CreateMissedConnectionScreen = () => {
  const navigation = useNavigation();
  const storeLat = useEncounterStore((s) => s.lat);
  const storeLon = useEncounterStore((s) => s.lon);

  const initialLat = storeLat || DEFAULT_LAT;
  const initialLon = storeLon || DEFAULT_LON;

  const [markerCoord, setMarkerCoord] = useState({
    latitude: initialLat,
    longitude: initialLon,
  });
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [wasAt, setWasAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 7);

  const handleMarkerDrag = useCallback((e) => {
    setMarkerCoord(e.nativeEvent.coordinate);
  }, []);

  const handleLocationSelect = useCallback(({ name, lat, lon }) => {
    setLocationName(name);
    if (lat && lon) {
      setMarkerCoord({ latitude: parseFloat(lat), longitude: parseFloat(lon) });
    }
  }, []);

  const handleDateChange = useCallback((event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setWasAt(selectedDate);
    }
  }, []);

  const handleSubmit = async () => {
    if (!locationName.trim() || !description.trim()) return;
    try {
      setSubmitting(true);
      await encountersApi.createMissed({
        lat: markerCoord.latitude,
        lon: markerCoord.longitude,
        location_name: locationName.trim(),
        description: description.trim(),
        was_at: wasAt.toISOString(),
      });
      navigation.goBack();
    } catch (e) {
      console.warn('Failed to create missed connection:', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post Missed Connection</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Drop a pin where you saw them</Text>
        <View style={styles.mapContainer}>
          {MapView ? (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              customMapStyle={darkMapStyle}
              initialRegion={{
                latitude: initialLat,
                longitude: initialLon,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              region={{
                latitude: markerCoord.latitude,
                longitude: markerCoord.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={markerCoord}
                draggable
                onDragEnd={handleMarkerDrag}
                pinColor="#00e89d"
              />
            </MapView>
          ) : (
            <View style={[styles.map, styles.mapPlaceholder]}>
              <MaterialIcons
                name="place"
                size={36}
                color="#00e89d"
              />
              <Text style={styles.mapPlaceholderText}>
                {markerCoord.latitude.toFixed(4)},{' '}
                {markerCoord.longitude.toFixed(4)}
              </Text>
              <Text style={styles.mapPlaceholderHint}>
                Map preview requires the maps SDK. Use the Location
                Name field below to describe where you saw them.
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.label}>Location Name</Text>
        <AutoSuggestInput
          value={locationName}
          onChangeText={setLocationName}
          onSelect={handleLocationSelect}
          currentLat={markerCoord.latitude}
          currentLon={markerCoord.longitude}
        />

        <Text style={styles.label}>When were you there?</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <MaterialIcons name="event" size={20} color="#00e89d" />
          <Text style={styles.dateButtonText}>{formatDisplayDate(wasAt)}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={wasAt}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={minDate}
            maximumDate={new Date()}
          />
        )}

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Describe the person or moment..."
          placeholderTextColor="#666"
          multiline
          maxLength={500}
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.length}/500</Text>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (submitting || !locationName.trim() || !description.trim()) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || !locationName.trim() || !description.trim()}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#1a1a2e" />
          ) : (
            <Text style={styles.submitButtonText}>Post Missed Connection</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    fontSize: wp('4.5%'),
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  scrollContent: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('5%'),
  },
  label: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginTop: hp('2%'),
    marginBottom: hp('0.8%'),
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    backgroundColor: '#242f3e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp('5%'),
  },
  mapPlaceholderText: {
    color: '#FFF',
    fontSize: wp('3.4%'),
    fontWeight: '600',
    marginTop: 6,
  },
  mapPlaceholderHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: wp('2.8%'),
    marginTop: 4,
    textAlign: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a3e',
    padding: wp('3.5%'),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  dateButtonText: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    marginLeft: 10,
  },
  descriptionInput: {
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    padding: wp('3.5%'),
    color: '#FFF',
    fontSize: wp('3.5%'),
    minHeight: hp('15%'),
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  charCount: {
    color: '#666',
    fontSize: wp('2.8%'),
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#00e89d',
    paddingVertical: hp('1.8%'),
    borderRadius: 24,
    alignItems: 'center',
    marginTop: hp('3%'),
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#1a1a2e',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
});

export default CreateMissedConnectionScreen;
