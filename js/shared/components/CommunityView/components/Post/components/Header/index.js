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
import { ensureCurrentUser, subscribeCurrentUser } from '../../../../../../services/currentUser';

const Header = ({ imageUri, username, location, rating, time, post_id, postUserId, deletePost, openBottomSheet }) => {
  const { OnboardingModule } = NativeModules;
  const [isFollowed, setFollowed] = useState(false);
  const { theme } = useThemeStore();
  const navigation = useNavigation();
  const refRBSheet = useRef();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [me, setMe] = useState({ id: null, username: null, email: null, name: null, phone: null });

  useEffect(() => {
    const initial = ensureCurrentUser();
    setMe({ ...initial });
    const unsub = subscribeCurrentUser((u) => setMe({ ...u }));
    return unsub;
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
          {username && (
            <Text style={usernamestyle} numberOfLines={1}>
              {String(username).includes('@')
                ? String(username).split('@')[0]
                : username}
            </Text>
          )}
          {location && <Text style={subtitle}>{location}</Text>}
          {(rating || time) && <Text style={subtitletime}>{(rating ? rating + ' | ' : '') + (time ? time : '')}</Text>}
        </View>
      </View>
      <View style={styles.right}>
        {(() => {
          const norm = (v) => String(v ?? '').replace(/['"\s]/g, '').toLowerCase();
          const myId = norm(me.id);
          const author = norm(postUserId);
          const displayed = norm(username);
          const isOwnById = myId && author && myId === author;
          const isOwnByIdentity =
            displayed &&
            (displayed === norm(me.username) ||
              displayed === norm(me.email) ||
              displayed === norm(me.name) ||
              displayed === norm(me.phone));
          // Polish round 3 2026-06-03: own posts get a quiet "You"
          // pill in place of the (hidden) Follow chip so the row
          // never has a hole on the right and the user sees a
          // confirmation that this post is theirs.  Subtle outline
          // styling — never competes with the kebab menu.
          if (isOwnById || isOwnByIdentity) {
            return (
              <View
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)',
                  marginRight: 7,
                }}
              >
                <Text style={{
                  color: theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.3,
                }}>You</Text>
              </View>
            );
          }
          return (
            <TouchableOpacity onPress={AddFriend} style={followButton}>
              <Text style={befriendButtonText}>{isFollowed ? 'Following' : 'Follow'}</Text>
              <Icon name={isFollowed ? 'check' : 'plus'} size={18} color='#FFF' />
            </TouchableOpacity>
          );
        })()}
        <TouchableOpacity onPress={() => openBottomSheet({ id: post_id, userID: postUserId })} style={styles.moreButton}>
          <OCIcon name="kebab-horizontal" size={20} color={theme === 'dark' ? '#FFF' : 'black'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Polish round 3 perf 2026-06-03: React.memo prevents Header from
// re-rendering when sibling Body/Footer state changes propagate
// through the Post parent.  Avatar Image + Follow chip layout
// remains stable across the feed scroll lifecycle.
export default React.memo(Header);
