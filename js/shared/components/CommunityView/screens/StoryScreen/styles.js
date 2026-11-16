import {StyleSheet} from 'react-native';

const styles = StyleSheet.create({
  // Stories are immersive full-bleed.  SafeAreaView on Android
  // reserved the gesture-bar inset (~48dp on Samsung S23) and the
  // video underneath was clipped at the bottom edge.  Using a plain
  // View + flex:1 fills the whole window; the translucent statusbar
  // lets the video go edge-to-edge while still showing time/battery.
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    flex: 1,
    resizeMode: 'cover',
    justifyContent: 'center',
  },
});

export default styles;

