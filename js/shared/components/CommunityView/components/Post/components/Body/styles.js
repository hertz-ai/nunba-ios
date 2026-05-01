import { StyleSheet, Dimensions } from 'react-native';

const styles = StyleSheet.create({
  image: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').width / 1.5,
    marginTop:5
  },
  video: {
    width: '100%',
    height: '100%',
   
  },
  videoContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').width / 1.5,
  
    
   
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
});

export default styles;
