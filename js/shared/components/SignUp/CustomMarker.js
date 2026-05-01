import React from 'react';
import {
  Animated,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
//import LinearGradient from 'react-native-linear-gradient'

const CustomMarker = ({image}) => {
  return (
    <View style={styles.roundMarker}>
      <Image style={styles.roundImage} source={{uri: image}} />
    </View>
  );
};

const styles = StyleSheet.create({
  roundMarker: {
    height: 60,
    width: 60,
    backgroundColor: 'white',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'white',
    fontWeight: '500',
  },
  roundImage: {
    height: 56,
    width: 56,
    borderRadius: 27,
    borderColor: 'red',
  },
});

export default CustomMarker;
