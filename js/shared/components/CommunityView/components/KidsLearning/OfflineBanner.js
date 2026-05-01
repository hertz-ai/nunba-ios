import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsFontSize, kidsFontWeight} from '../../../../theme/kidsColors';

const OfflineBanner = ({visible}) => {
  if (!visible) return null;
  return (
    <View style={styles.container}>
      <Icon name="wifi-off" size={16} color={kidsColors.textOnDark} />
      <Text style={styles.text}>Playing offline - progress syncs when connected</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    backgroundColor: kidsColors.textSecondary,
    paddingVertical: kidsSpacing.xs,
    paddingHorizontal: kidsSpacing.md,
  },
  text: {
    fontSize: kidsFontSize.xs,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textOnDark,
  },
});

export default OfflineBanner;
