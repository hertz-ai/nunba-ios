import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MapView, { Marker, Circle, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Slider from '../components/Slider';
import { useNavigation } from '@react-navigation/native';
import useEncounterStore from '../../../encounterStore';
import { encountersApi } from '../../../services/socialApi';

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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MissedConnectionsMapScreen = () => {
  const navigation = useNavigation();
  const lat = useEncounterStore((s) => s.lat);
  const lon = useEncounterStore((s) => s.lon);
  const radius = useEncounterStore((s) => s.radius);
  const setRadius = useEncounterStore((s) => s.setRadius);

  const [connections, setConnections] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  const userLat = lat || 21.1458;
  const userLon = lon || 79.0882;

  useEffect(() => {
    const { NativeModules } = require('react-native');
    NativeModules.OnboardingModule.getUser_id((userId) => {
      setCurrentUserId(userId);
    });
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const result = await encountersApi.searchMissed({
        lat: userLat,
        lon: userLon,
        radius,
      });
      if (result && Array.isArray(result.results)) {
        setConnections(result.results);
      }
    } catch (e) {
      console.warn('Failed to fetch map connections:', e.message);
    }
  }, [userLat, userLon, radius]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const getMarkerColor = (item) => {
    if (item.user_id === currentUserId) return '#4a90d9';
    if (item.response_count > 0) return '#00e89d';
    return '#ff6b6b';
  };

  const formatRadiusLabel = (val) => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}km`;
    return `${Math.round(val)}m`;
  };

  const handleRadiusChange = useCallback(
    (val) => {
      setRadius(Math.round(val));
    },
    [setRadius],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Missed Connections Map</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.mapWrapper}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: userLat,
            longitude: userLon,
            latitudeDelta: radius / 50000,
            longitudeDelta: radius / 50000,
          }}
          showsUserLocation={false}
        >
          {/* User location marker */}
          <Marker
            coordinate={{ latitude: userLat, longitude: userLon }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner} />
            </View>
          </Marker>

          {/* Search radius circle */}
          <Circle
            center={{ latitude: userLat, longitude: userLon }}
            radius={radius}
            fillColor="rgba(0, 232, 157, 0.08)"
            strokeColor="rgba(0, 232, 157, 0.3)"
            strokeWidth={1}
          />

          {/* Missed connection markers */}
          {connections.map((item) => {
            if (!item.lat || !item.lon) return null;
            const color = getMarkerColor(item);
            return (
              <Marker
                key={item.id}
                coordinate={{ latitude: item.lat, longitude: item.lon }}
                pinColor={color}
              >
                <Callout
                  onPress={() =>
                    navigation.navigate('MissedConnectionDetail', {
                      missedId: item.id,
                    })
                  }
                >
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>
                      {item.location_name || 'Unknown'}
                    </Text>
                    <Text style={styles.calloutDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={styles.calloutResponses}>
                      {item.response_count || 0} response
                      {(item.response_count || 0) !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.calloutAction}>Tap to view details</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      </View>

      {/* Bottom radius control */}
      <View style={styles.radiusControl}>
        <View style={styles.radiusHeader}>
          <MaterialIcons name="radar" size={20} color="#00e89d" />
          <Text style={styles.radiusLabel}>
            Search Radius: {formatRadiusLabel(radius)}
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={100}
          maximumValue={5000}
          step={100}
          value={radius}
          onSlidingComplete={handleRadiusChange}
          minimumTrackTintColor="#00e89d"
          maximumTrackTintColor="#3a3a4e"
          thumbTintColor="#00e89d"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>100m</Text>
          <Text style={styles.sliderLabel}>5km</Text>
        </View>
      </View>
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
  mapWrapper: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  calloutContainer: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  calloutDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  calloutResponses: {
    fontSize: 11,
    color: '#00a67d',
    fontWeight: '600',
    marginBottom: 4,
  },
  calloutAction: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  radiusControl: {
    backgroundColor: '#2a2a3e',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.5%'),
    borderTopWidth: 1,
    borderTopColor: '#3a3a4e',
  },
  radiusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radiusLabel: {
    color: '#FFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginLeft: 8,
  },
  slider: {
    width: SCREEN_WIDTH - wp('10%'),
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    color: '#888',
    fontSize: wp('2.8%'),
  },
});

export default MissedConnectionsMapScreen;
