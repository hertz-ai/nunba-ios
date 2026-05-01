import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('ScreenErrorBoundary caught:', error?.message, errorInfo?.componentStack?.substring(0, 200));
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.error}>{this.state.error?.message || 'Unknown error'}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
          {this.props.navigation && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => this.props.navigation.goBack()}
            >
              <Text style={styles.backText}>Go Back</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  error: { color: '#FF6B6B', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  button: {
    backgroundColor: '#00e89d', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginBottom: 12,
  },
  buttonText: { color: '#121212', fontSize: 16, fontWeight: '700' },
  backButton: { padding: 12 },
  backText: { color: '#888', fontSize: 14 },
});

export default ScreenErrorBoundary;
