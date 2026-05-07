import React, { useState, useEffect, useCallback } from 'react';
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
  NativeModules,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
// react-native-maps is autolinked when the iOS pod is installed.  On
// builds where the native pod hasn't been added yet (early iOS preview
// builds), the JS layer still resolves but `NativeModules.AIRMapManager`
// is undefined.  Probing the native module first lets the screen show
// a passive placeholder card instead of crashing on first render.  See
// docs/NUNBA_PARITY.md "Bucket A iOS placeholders" for context.
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
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
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

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

const MissedConnectionDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { missedId } = route.params;

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    NativeModules.OnboardingModule.getUser_id((userId) => {
      setCurrentUserId(userId);
    });
  }, []);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const result = await encountersApi.getMissed(missedId);
      if (result) {
        setDetail(result);
      }
    } catch (e) {
      console.warn('Failed to fetch missed connection detail:', e.message);
    } finally {
      setLoading(false);
    }
  }, [missedId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleRespond = async () => {
    if (!message.trim()) return;
    try {
      setSubmitting(true);
      await encountersApi.respondMissed(missedId, message.trim());
      setMessage('');
      fetchDetail();
    } catch (e) {
      console.warn('Failed to respond:', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async (responseId) => {
    try {
      await encountersApi.acceptMissedResponse(missedId, responseId);
      fetchDetail();
    } catch (e) {
      console.warn('Failed to accept response:', e.message);
    }
  };

  const isOwner = detail && currentUserId && detail.user_id === currentUserId;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00e89d" />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Missed Connection</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Could not load this missed connection.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Missed Connection</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {detail.lat && detail.lon && (
          <View style={styles.mapContainer}>
            {MapView ? (
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                customMapStyle={darkMapStyle}
                initialRegion={{
                  latitude: detail.lat,
                  longitude: detail.lon,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: detail.lat, longitude: detail.lon }}
                  pinColor="#00e89d"
                />
              </MapView>
            ) : (
              <View style={[styles.map, styles.mapPlaceholder]}>
                <MaterialIcons
                  name="location-on"
                  size={36}
                  color="#00e89d"
                />
                <Text style={styles.mapPlaceholderText}>
                  {detail.lat.toFixed(4)}, {detail.lon.toFixed(4)}
                </Text>
                <Text style={styles.mapPlaceholderHint}>
                  Map preview requires the maps SDK.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.detailCard}>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={20} color="#00e89d" />
            <Text style={styles.locationName}>
              {detail.location_name || 'Unknown Location'}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(detail.was_at || detail.created_at)}</Text>
          <Text style={styles.description}>{detail.description}</Text>
        </View>

        {isOwner && detail.responses && detail.responses.length > 0 && (
          <View style={styles.respondentsSection}>
            <Text style={styles.sectionTitle}>
              Responses ({detail.responses.length})
            </Text>
            {detail.responses.map((resp) => (
              <View key={resp.id} style={styles.respondentCard}>
                <Text style={styles.respondentMessage}>{resp.message}</Text>
                <Text style={styles.respondentDate}>
                  {formatDate(resp.created_at)}
                </Text>
                {!resp.accepted && (
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(resp.id)}
                  >
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                )}
                {resp.accepted && (
                  <View style={styles.acceptedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#00e89d" />
                    <Text style={styles.acceptedText}>Accepted</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {!isOwner && (
          <View style={styles.respondSection}>
            <Text style={styles.sectionTitle}>I was there too</Text>
            <TextInput
              style={styles.responseInput}
              placeholder="Describe yourself or what you were doing..."
              placeholderTextColor="#666"
              multiline
              maxLength={300}
              value={message}
              onChangeText={setMessage}
            />
            <Text style={styles.charCount}>{message.length}/300</Text>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleRespond}
              disabled={submitting || !message.trim()}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#1a1a2e" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#888',
    fontSize: wp('3.5%'),
  },
  scrollContent: {
    paddingBottom: hp('5%'),
  },
  mapContainer: {
    height: 150,
    marginHorizontal: wp('4%'),
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: hp('2%'),
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    backgroundColor: '#242f3e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp('4%'),
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
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: '#2a2a3e',
    marginHorizontal: wp('4%'),
    borderRadius: 12,
    padding: wp('4%'),
    marginBottom: hp('2%'),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationName: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 8,
  },
  dateText: {
    color: '#888',
    fontSize: wp('3.2%'),
    marginBottom: 12,
  },
  description: {
    color: '#DDD',
    fontSize: wp('3.5%'),
    lineHeight: 22,
  },
  respondentsSection: {
    marginHorizontal: wp('4%'),
    marginBottom: hp('2%'),
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
  },
  respondentCard: {
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    padding: wp('3.5%'),
    marginBottom: 10,
  },
  respondentMessage: {
    color: '#DDD',
    fontSize: wp('3.3%'),
    lineHeight: 20,
  },
  respondentDate: {
    color: '#666',
    fontSize: wp('2.8%'),
    marginTop: 6,
  },
  acceptButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#00e89d',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    borderRadius: 16,
    marginTop: 10,
  },
  acceptButtonText: {
    color: '#1a1a2e',
    fontSize: wp('3.2%'),
    fontWeight: '700',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  acceptedText: {
    color: '#00e89d',
    fontSize: wp('3%'),
    marginLeft: 4,
  },
  respondSection: {
    marginHorizontal: wp('4%'),
  },
  responseInput: {
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    padding: wp('3.5%'),
    color: '#FFF',
    fontSize: wp('3.5%'),
    minHeight: hp('12%'),
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  charCount: {
    color: '#666',
    fontSize: wp('2.8%'),
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#00e89d',
    paddingVertical: hp('1.5%'),
    borderRadius: 24,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#1a1a2e',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
});

export default MissedConnectionDetailScreen;
