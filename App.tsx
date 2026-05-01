/**
 * Nunba Companion — iOS app root.
 *
 * Minimal scaffold for now. Reuses the same JS surface as
 * Hevolve_React_Native (Android sibling) — components and stores
 * are copied into js/ from the Android repo and stay framework-pure.
 * Native bindings are iOS-specific (see ios/NunbaCompanion/Modules).
 */
import React from 'react';
import {SafeAreaView, StatusBar, StyleSheet, Text, View} from 'react-native';

function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Text style={styles.title}>Nunba Companion</Text>
        <Text style={styles.subtitle}>iOS port — scaffold</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0F0E17'},
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24},
  title: {color: '#FFFFFE', fontSize: 28, fontWeight: '700', marginBottom: 8},
  subtitle: {color: '#A7A9BE', fontSize: 16},
});

export default App;
