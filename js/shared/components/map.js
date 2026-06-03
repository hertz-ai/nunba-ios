import React from 'react';
import MapView, {
  Callout,
  Circle,
  Geojson,
  Marker,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
} from 'react-native';

import CustomMarker from './CustomMarker';
import data from './data';
import Demo from './demo';
import Scrolls from '../wallpaper/scrolls';

const styles = StyleSheet.create({
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});
const mapStyles = [
  {
    stylers: [
      {
        color: '#224929',
      },
    ],
  },
  {
    elementType: 'geometry',
    stylers: [
      {
        color: '#ebe3cd',
      },
    ],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#523735',
      },
    ],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [
      {
        color: '#f5f1e6',
      },
    ],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#c9b2a6',
      },
    ],
  },
  {
    featureType: 'administrative',
    elementType: 'labels.text.fill',
    stylers: [
      {
        visibility: 'simplified',
      },
    ],
  },
  {
    featureType: 'administrative.country',
    stylers: [
      {
        color: '#a3a2a9',
      },
      {
        saturation: 70,
      },
    ],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [
      {
        color: '#2adf48',
      },
    ],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'geometry',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#dcd2be',
      },
    ],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#ae9e90',
      },
    ],
  },
  {
    featureType: 'administrative.locality',
    stylers: [
      {
        color: '#9fada6',
      },
    ],
  },
  {
    featureType: 'administrative.neighborhood',
    stylers: [
      {
        color: '#39ea56',
      },
    ],
  },
  {
    featureType: 'administrative.province',
    stylers: [
      {
        color: '#51e69e',
      },
    ],
  },
  {
    featureType: 'landscape.natural',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [
      {
        color: '#dfd2ae',
      },
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [
      {
        color: '#dfd2ae',
      },
    ],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#93817c',
      },
    ],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [
      {
        color: '#a5b076',
      },
    ],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#447530',
      },
    ],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [
      {
        color: '#f5f1e6',
      },
    ],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [
      {
        color: '#fdfcf8',
      },
    ],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [
      {
        color: '#f8c967',
      },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#e9bc62',
      },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [
      {
        color: '#e98d58',
      },
    ],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#db8555',
      },
    ],
  },
  {
    featureType: 'road.local',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'road.local',
    elementType: 'labels',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#806b63',
      },
    ],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [
      {
        color: '#dfd2ae',
      },
    ],
  },
  {
    featureType: 'transit.line',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#8f7d77',
      },
    ],
  },
  {
    featureType: 'transit.line',
    elementType: 'labels.text.stroke',
    stylers: [
      {
        color: '#ebe3cd',
      },
    ],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [
      {
        color: '#dfd2ae',
      },
    ],
  },
  {
    featureType: 'water',
    elementType: 'geometry.fill',
    stylers: [
      {
        color: '#b9d3c2',
      },
    ],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#92998d',
      },
    ],
  },
];
const Map = () => {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        zoom={50}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 21.1458,
          longitude: 79.0882,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        customMapStyle={mapStyles}
        // showsUserLocation={true}
      >
        {data.map(items => {
          return (
            <Marker
              onPress={() => {
                alert('Internship or PPO?');
              }}
              name="story"
              key={items.latitude}
              coordinate={{
                latitude: items.latitude,
                longitude: items.longitude,
              }}>
              <CustomMarker image={items.image} />
            </Marker>
          );
        })}

        {/* <Marker coordinate={{ latitude: 21.1458,longitude: 78.0382, }}>
                   <CustomMarker/>
              </Marker> */}
      </MapView>
    </View>
  );
};
export default Map;
