import React, { useEffect, useState } from 'react';
import { NativeModules, View, TextInput, Text } from 'react-native';
import styles from './styles';
import ProfilePicture from '../../ProfilePicture';
import FAIcon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import PressableScale from '../../../../shared/PressableScale';
import { ensureCurrentUser, subscribeCurrentUser } from '../../../../../services/currentUser';
const data = {
  imageUri:
    'http://awsvm1.hertzai.com:5454/txt/voice_dump/cropped8531671542975014342.jpg',
};
const { ActivityStarterModule } = NativeModules;

const firstNameOf = (u) => {
  const raw = u?.name || u?.username || u?.email || '';
  const beforeAt = String(raw).split('@')[0];
  const head = beforeAt.split(/[\s._-]+/)[0] || '';
  return head ? head.charAt(0).toUpperCase() + head.slice(1) : '';
};

const AddPost = () => {
  const navigation = useNavigation();
  const [text, onChangeText] = React.useState('');
  const [me, setMe] = useState(() => ensureCurrentUser());

  useEffect(() => {
    const unsub = subscribeCurrentUser((u) => setMe({ ...u }));
    return unsub;
  }, []);

  const firstName = firstNameOf(me);
  const placeholder = firstName ? `What's on your mind, ${firstName}?` : 'Share your thoughts';

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
        <PressableScale
          onPress={postButton}
          style={styles.addPost}
          scaleTo={0.97}
          accessibilityLabel={placeholder}
        >
          <View style={styles.addPostIcon}>
            <FAIcon name="microphone" size={30} color={'#0078ff'} />
          </View>
          <Text style={styles.buttonText} numberOfLines={1}>{placeholder}</Text>
        </PressableScale>
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
