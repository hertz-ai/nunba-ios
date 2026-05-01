import { StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
const styles = StyleSheet.create({
  likes: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginHorizontal:wp('2%')
  },
  iconText: {
    
    marginLeft: 5, 

  },
  
  topContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginVertical: 2,
    paddingTop: 1,
  },
  bottomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:'space-between',
    marginBottom:1,
    width:wp('100%'),
   
    paddingHorizontal:4,

  },
  hr: {
    borderBottomColor: '#dadada',
    borderBottomWidth: 1,
    marginHorizontal: 15,
    marginVertical: 5,
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center', 
    padding:10
    
  
  },
  iconContainer: {

      borderRadius: 8, 
      overflow: 'hidden', 
  },
   
   
  
  info: {
    alignSelf: 'center',
    fontSize: 13,
    fontWeight:'bold',
    color: 'grey',
    marginRight:wp('2%')
  },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    //done
    fontSize: 16,
    fontWeight: '700',
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  container:{
    marginTop:12,
    marginBottom:12
  },
  button1: {
   
    flexDirection: 'row',
    alignItems: 'center', 

  },
});

export default styles;
