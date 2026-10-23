import { StyleSheet, Dimensions } from 'react-native';

const { width: WIN_W } = Dimensions.get('window');

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: WIN_W / 1.5,
    marginTop: 5,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1F',
  },
  videoPlaceholderText: {
    color: 'white',
    marginTop: 8,
    fontSize: 13,
    opacity: 0.85,
  },
  videoContainer: {
    width: '100%',
    height: WIN_W / 1.5,
  },
  muteButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  muteButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  caption: {
    paddingHorizontal: 4,
    color:'white',
    fontWeight:'400',
    marginBottom:10,
  },
  // Tap-to-play overlay shown in feed before user explicitly starts
  // a video.  Prevents react-native-video's setSrc / prepareAsync /
  // MediaHTTPConnection re-fetch storm on every FlatList row recycle
  // (logcat 2026-06-03 13:10: 10+ MediaCodec re-inits + 6+ HTTP GETs
  // in 9s of scroll because brentvatne ReactVideoView re-attaches on
  // each remount with no cache layer).  Tap-to-play = no remount, no
  // re-fetch, no codec churn, no bandwidth waste.  Standard
  // Instagram / Reddit feed pattern.
  playOverlay: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});

export default styles;
