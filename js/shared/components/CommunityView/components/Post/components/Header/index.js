import React, { useState, useEffect, useRef } from 'react';
import { Text, View, TouchableOpacity, Image, NativeModules } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import useThemeStore from '../../../../../../colorThemeZustand';
import styles from './styles';
import OCIcon from 'react-native-vector-icons/Octicons';
import { useNavigation } from '@react-navigation/native';

const Header = ({ imageUri, username, location, rating, time, post_id, postUserId, deletePost, openBottomSheet }) => {
  const { OnboardingModule } = NativeModules;
  const [isFollowed, setFollowed] = useState(false);
  const { theme } = useThemeStore();
  const navigation = useNavigation();
  const refRBSheet = useRef();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        OnboardingModule.getUser_id((userId) => {
         // console.log('UserID',userId)
          setUserId(userId);
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  // const deletePostHandler = () => {
  //   const post_id_delete = String(post_id);
  //   let reason = null;
  //   deletePost(post_id_delete, reason);
  //   setDropdownVisible(false);
  // };

  // const navigateToReportScreen = () => {
  //   setDropdownVisible(false);
  //   navigation.navigate('Report', { post_id: String(post_id), deletePost });
  // };

  const usernamestyle = {
    ...styles.username,
    color: theme === 'dark' ? '#fff' : 'black',
  };

  const subtitle = {
    ...styles.subtitle,
    color: theme === 'dark' ? 'white' : 'grey',
  };

  const subtitletime = {
    ...styles.subtitlemerge,
    color: theme === 'dark' ? 'grey' : 'grey',
  };

  const befriendButtonText = {
    ...styles.followButtonText,
    color: theme === 'dark' ? '#fff' : 'black',
  };

  const followButton = {
    ...styles.followButton,
    backgroundColor: theme === 'dark' ? 'black' : '#ADD8E6'
  };

  const container = {
    ...styles.container,
    backgroundColor: theme === 'dark' ? '#000' : '#FFF',
  };


  const AddFriend = async () => {
    console.log(postUserId,userId,'hello')
    
    const url = 'https://mailer.hertzai.com/add_friend';
    const payload = {
      user_id: userId,
      friend_user_id: postUserId

    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseJson = await response.json();
      setFollowed(true)
      console.log(responseJson, 'this id post id');


    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to block user');
    }
  };


  return (
    <View style={container}>
      <View style={styles.left}>
        <View style={styles.profilePicContainer}>
          <Image
            source={imageUri ? { uri: imageUri } : require('../../../../../../images/user1.png')}
            style={styles.profilePic}
          />
        </View>
        <View style={styles.userInfo}>
          {username && <Text style={usernamestyle}>{username}</Text>}
          {location && <Text style={subtitle}>{location}</Text>}
          {(rating || time) && <Text style={subtitletime}>{(rating ? rating + ' | ' : '') + (time ? time : '')}</Text>}
        </View>
      </View>
      <View style={styles.right}>
        <TouchableOpacity onPress={AddFriend} style={followButton}>
          <Text style={befriendButtonText}>{isFollowed ? 'Following' : 'Follow'}</Text>
          <Icon name={isFollowed ? 'check' : 'plus'} size={18} color='#FFF' />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openBottomSheet({ id: post_id, userID: postUserId })} style={styles.moreButton}>
          <OCIcon name="kebab-horizontal" size={20} color={theme === 'dark' ? '#FFF' : 'black'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Header;
