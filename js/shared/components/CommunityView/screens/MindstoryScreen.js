import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {colors} from '../../../theme/colors';

/**
 * MindstoryScreen — Opens the Mindstory AI video generation page
 * in a WebView. Reuses the existing PupitCard + VIDEO_GEN_URL pipeline
 * from the Hevolve web frontend. No new native code needed.
 *
 * Fallback UX (#420):
 *   - loading state: full-screen ActivityIndicator + "Loading Mindstory…"
 *   - error state: inline error card with Retry that toggles a render key,
 *     forcing the WebView to unmount + remount with the same source URL.
 *   - success state: WebView renders normally.
 */
const MindstoryScreen = () => {
  const baseUrl = 'https://hevolve.ai';

  // State machine: 'loading' | 'error' | 'success'
  const [status, setStatus] = useState('loading');
  // Bumping renderKey forces WebView remount on retry.
  const [renderKey, setRenderKey] = useState(0);

  const handleLoadStart = useCallback(() => {
    setStatus('loading');
  }, []);

  const handleLoadEnd = useCallback(() => {
    // onLoadEnd fires for both success and error; only promote to success
    // if we haven't already flipped to error via onError / onHttpError.
    setStatus(prev => (prev === 'error' ? 'error' : 'success'));
  }, []);

  const handleError = useCallback(() => {
    setStatus('error');
  }, []);

  const handleHttpError = useCallback(() => {
    setStatus('error');
  }, []);

  const handleRetry = useCallback(() => {
    setStatus('loading');
    setRenderKey(k => k + 1);
  }, []);

  const renderLoading = useCallback(
    () => (
      <View style={styles.overlay} pointerEvents="none">
        <ActivityIndicator size="large" color={colors.textPrimary} />
        <Text style={styles.loadingText}>Loading Mindstory…</Text>
      </View>
    ),
    [],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {status !== 'error' && (
        <WebView
          key={renderKey}
          source={{uri: `${baseUrl}/social/mindstory`}}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          renderLoading={renderLoading}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleHttpError}
        />
      )}

      {status === 'error' && (
        <View style={styles.errorWrap}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              Mindstory unavailable — tap to retry
            </Text>
            <Pressable
              onPress={handleRetry}
              style={({pressed}) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Retry loading Mindstory">
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background || '#000000'},
  webview: {flex: 1},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background || '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card || '#141225',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error || '#e74c3c',
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: colors.error || '#e74c3c',
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default MindstoryScreen;
