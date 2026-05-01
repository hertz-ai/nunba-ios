import { StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    zIndex:20000,
    width:wp('100%')
    
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    width:wp('48%'),
   
  },
  profilePicContainer: {
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 25, 
    padding: 1,
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userInfo: {
    marginLeft: 10,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
  },
  subtitletime: {
    fontSize: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    width:wp('31%'),
    marginRight:wp('1%'),
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 15,
    marginRight:7,
    borderRadius: 20,
  },
  followButtonText: {
    marginRight: 8,
    fontWeight: 'bold',
    fontSize:wp('4%'),
  },
    moreButton: {
    padding: 5,
  },
  dropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#1c1c1c',
    borderRadius: 5,
    padding: 10,
    zIndex: 50,
  },
  dropdownOption: {
    padding: 10,
    zIndex:20
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#fff',
    zIndex:100
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    position:'absolute'
  },
  option: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  optionText: {
    fontSize: 18,
    textAlign: 'center',
  },
});


export default styles;
