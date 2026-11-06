import {StyleSheet} from 'react-native';

const styles = StyleSheet.create({
  // User-feedback 2026-06-16: image/video previously had hardcoded
  // 130x150 but the card is 120x160 — leaving a strip of card bg
  // visible at the bottom + sometimes a sliver on the right.  Use
  // 100% width/height + borderRadius matching the parent card so the
  // preview fills the rounded container cleanly.
  image: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: '#1B1530',
  },
  video: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  container: {
    marginTop: 10,
    alignContent: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  card: {
    height: 160,
    width: 120,
    borderRadius: 14,
    position: 'relative',
    alignItems: 'center',
    elevation: 5,
    overflow: 'hidden',
  },
  // #416 fix: the card never had a backgroundColor of its own so a
  // missing/failed image left the rail rendering pure-black voids.
  // This warm-purple fill is the same hue used by the "Your story +"
  // CTA so the rail reads as a coherent set even if every server
  // resource is unreachable.
  cardFallbackBg: {
    backgroundColor: '#1B1530',
  },
  titleText: {marginTop: 40, fontWeight: 'bold', position: 'absolute'},
  description: {padding: 3, fontWeight: 'normal', color: '#FFF'},
  circle: {
    height: 36,
    width: 36,
    borderColor: '#00E89D',
    borderWidth: 2.5,
    borderRadius: 18,
  },
  placeholderWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInitial: {
    fontSize: 56,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
  },
});

export default styles;
