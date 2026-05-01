import React from 'react';
import { NativeModules, View, TextInput, TouchableOpacity, Text } from 'react-native';
import styles from './styles';
import ProfilePicture from '../../ProfilePicture';
import FAIcon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
const data = {
  imageUri:
    'http://awsvm1.hertzai.com:5454/txt/voice_dump/cropped8531671542975014342.jpg',
};
const { ActivityStarterModule } = NativeModules;

const AddPost = () => {
  const navigation = useNavigation();
  const [text, onChangeText] = React.useState('');


  const postButton = () => {
    navigation.navigate('AddPost');


  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ProfilePicture
          uri={data.imageUri}
          size={40}
          position={'static'}
          top={0}
          elevation={0}
          padding={6}
        />
        <TouchableOpacity onPress={postButton} style={styles.addPost}>
          <View style={styles.addPostIcon}>
            <FAIcon name="microphone" size={30} color={'#0078ff'} />
          </View>
          <Text style = {styles.buttonText}>Share your thoughts</Text>
           
        </TouchableOpacity>
      </View>
      {/* <View style={styles.row2}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Share Achievements</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}
        onPress={() => {
          console.log("button clicked");
          ActivityStarterModule.navigateToAddPost();
        }
        }>

          <Text style={styles.buttonText}>Share a photo</Text>
        </TouchableOpacity>
        
      </View>{/* <TouchableOpacity onPress={postButton}> *
          <Text style={styles.buttonText}>Add Photo</Text>
        </TouchableOpacity> */}


    </View>
  );
};

export default AddPost;
