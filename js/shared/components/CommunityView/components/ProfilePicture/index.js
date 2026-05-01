import React from 'react';
import {Image, View} from 'react-native';
import styles from './styles';

const ProfilePicture = ({
  uri,
  size = 80,
  position = 'absolute',
  top = -40,
  elevation = 5,
  padding = 0,
}) => {
  return (
    <View
      style={[
        styles.container,
        {position: position, elevation: elevation, top: top, padding: padding},
      ]}>
      <Image
        source={{uri}}
        style={[styles.image, {height: size, width: size}]}
      />
    </View>
  );
};

export default ProfilePicture;
