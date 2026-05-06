import React, { useState, useEffect, useRef } from 'react';
import { Text, View, TouchableOpacity, Image, NativeModules, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import useThemeStore from '../../../../../../colorThemeZustand';
import styles from './styles';
import OCIcon from 'react-native-vector-icons/Octicons';
import { useNavigation } from '@react-navigation/native';
// #262 — Friend requests now flow through the canonical HARTOS
// gateway (auth + flag + tenant filter + Notification fan-out)
// instead of the legacy direct-DB endpoint at mailer.hertzai.com.
// Both the gateway and the mailer hit the same Hevolve cloud DB,
// so the migration is safe; we just want the JWT/flag/fan-out
// pipeline to apply.
import { friendsApi } from '../../../../../../services/socialApi';

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


  // #262 — friendsApi.sendRequest goes through the HARTOS gateway:
  // JWT auth, friends_v2 flag, tenant_filter, and Notification +
  // WAMP fan-out all apply.  Pre-migration this hit a direct cloud-
  // DB endpoint that bypassed all of that.  Both write to the same
  // Hevolve cloud DB; the gateway path is the canonical one.
  const AddFriend = async () => {
    if (!postUserId) return;
    try {
      await friendsApi.sendRequest(postUserId);
      setFollowed(true);
    } catch (error) {
      Alert.alert(
        'Error',
        error?.error || error?.message || 'Failed to send friend request');
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
