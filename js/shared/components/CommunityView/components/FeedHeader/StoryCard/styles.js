import {StyleSheet} from 'react-native';

const styles = StyleSheet.create({
  image: {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  position: 'absolute',
  height: 150,
  backgroundColor: '#fff',
  width: 130
  },
  video: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
      width: 130
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
    overflow: 'hidden', // add this line
  },
  titleText: {marginTop: 40, fontWeight: 'bold',  position: 'absolute',},
  description: {padding: 3, fontWeight: 'normal',color:'#FFF'},
  circle: {
    height: 36,
    width: 36,
    borderColor: '#00E89D',
    borderWidth: 2.5,
    borderRadius: 18,
  },
});

export default styles;
