import {StyleSheet} from 'react-native';

const styles = StyleSheet.create({
  container: {
    borderBottomColor: '#99c9ff',
    borderBottomWidth: 4,
    borderColor: '#99c9ff',
    backgroundColor:'#0E1114'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row2: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 8,
  },
  addPost: {
    flexDirection: 'row',
    flex: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 30,
    margin: 10,
    justifyContent:'flex-start',
    alignItems:'center',
  },
  addPostIcon: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginLeft:7
  },
});

export default styles;
