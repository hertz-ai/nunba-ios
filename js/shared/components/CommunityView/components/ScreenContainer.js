import React from 'react';
import { View, SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import useOrientation from '../../../hooks/useOrientation';

/**
 * Landscape-aware screen wrapper.
 * In portrait: full width as normal.
 * In landscape: caps content at 600dp and centers it, preventing stretched cramped layouts.
 *
 * Usage:
 *   <ScreenContainer backgroundColor="#121212">
 *     {content}
 *   </ScreenContainer>
 */
const ScreenContainer = ({ children, backgroundColor = '#121212', statusBarStyle = 'light-content' }) => {
  const { isLandscape } = useOrientation();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <View style={[styles.inner, isLandscape && styles.landscape]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: { flex: 1 },
  landscape: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
});

export default ScreenContainer;
