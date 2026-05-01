import React from 'react';
import {View, StyleSheet, SafeAreaView, StatusBar} from 'react-native';
import {WebView} from 'react-native-webview';
import {colors} from '../../../theme/colors';

/**
 * MindstoryScreen — Opens the Mindstory AI video generation page
 * in a WebView. Reuses the existing PupitCard + VIDEO_GEN_URL pipeline
 * from the Hevolve web frontend. No new native code needed.
 */
const MindstoryScreen = () => {
  const baseUrl = 'https://hevolve.ai';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <WebView
        source={{uri: `${baseUrl}/social/mindstory`}}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background || '#0F0E17'},
  webview: {flex: 1},
});

export default MindstoryScreen;
