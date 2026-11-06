/**
 * MicStatusOverlay — status-aware overlay for voice-input game templates.
 *
 * Used by BalloonPopTemplate, PeekabooTemplate, SpeechBubbleTemplate so they
 * stop showing a forever "Starting mic..." string when permission is denied,
 * the native module isn't linked, or AudioRecord init throws.  Each non-OK
 * state renders an actionable affordance: tap-to-retry on denial, fallback
 * message on unsupported devices, spinner on starting.
 *
 * Props:
 *   status:    one of MIC_STATUS.* from hooks/useMicAmplitude
 *   error:     human-readable string (only meaningful for denied/error/unsupported)
 *   onRetry:   () => Promise<void> — re-invokes startListening so the
 *              OS permission prompt comes back up.
 *
 * The overlay only renders when status !== 'listening'.  Render it as a
 * sibling of the gameplay area; positionStyle prop lets the template push
 * it where it fits the design (default: full-screen translucent backdrop).
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {MIC_STATUS} from '../../../../../hooks/useMicAmplitude';
import {kidsColors, kidsFontSize, kidsSpacing} from '../../../../../theme/kidsColors';

const MicStatusOverlay = ({status, error, onRetry, positionStyle}) => {
  if (status === MIC_STATUS.LISTENING) return null;

  let emoji = '🎤';
  let title = 'Microphone';
  let subtitle = '';
  let cta = null;
  let showSpinner = false;

  if (status === MIC_STATUS.UNSUPPORTED) {
    emoji = '🔇';
    title = 'Voice input not available';
    subtitle =
      error ||
      'This device or build does not include the microphone module.';
  } else if (status === MIC_STATUS.DENIED) {
    emoji = '🎤';
    title = 'Mic permission needed';
    subtitle =
      error || 'Tap the button to allow microphone access for this game.';
    cta = onRetry ? 'Allow microphone' : null;
  } else if (status === MIC_STATUS.ERROR) {
    emoji = '⚠️';
    title = 'Could not start mic';
    subtitle = error || 'Something went wrong starting the microphone.';
    cta = onRetry ? 'Try again' : null;
  } else if (status === MIC_STATUS.REQUESTING_PERMISSION) {
    title = 'Asking for mic access…';
    subtitle = 'Tap OK on the system prompt.';
    showSpinner = true;
  } else {
    // IDLE or STARTING — show a friendly "getting ready" state.
    title = 'Getting the mic ready…';
    subtitle = 'Speak when you see the listening icon.';
    showSpinner = true;
  }

  return (
    <View style={[styles.overlay, positionStyle]}>
      <View style={styles.card}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {showSpinner ? (
          <ActivityIndicator
            size="large"
            color={kidsColors.primary || '#FF8C42'}
            style={styles.spinner}
          />
        ) : null}
        {cta && onRetry ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={cta}
            style={styles.button}
            onPress={() => {
              const result = onRetry();
              if (result && typeof result.catch === 'function') {
                result.catch(() => {});
              }
            }}>
            <Text style={styles.buttonText}>{cta}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: kidsSpacing.lg,
    zIndex: 50,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: kidsColors.background || '#FFFDF5',
    borderRadius: 24,
    padding: kidsSpacing.xl,
    alignItems: 'center',
    gap: kidsSpacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
  },
  emoji: {
    fontSize: 56,
    marginBottom: kidsSpacing.xs,
  },
  title: {
    fontSize: kidsFontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    color: kidsColors.text || '#3A3A3A',
  },
  subtitle: {
    fontSize: kidsFontSize.md,
    textAlign: 'center',
    color: kidsColors.textMuted || '#7A7A7A',
    paddingHorizontal: kidsSpacing.sm,
  },
  spinner: {
    marginTop: kidsSpacing.md,
  },
  button: {
    marginTop: kidsSpacing.md,
    backgroundColor: kidsColors.primary || '#FF8C42',
    paddingHorizontal: kidsSpacing.xl,
    paddingVertical: kidsSpacing.md,
    borderRadius: 999,
  },
  buttonText: {
    color: '#fff',
    fontSize: kidsFontSize.md,
    fontWeight: '700',
  },
});

export default MicStatusOverlay;
