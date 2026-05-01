import React from 'react';
import { View } from 'react-native';
import Header from './components/Header';
import Body from './components/Body';
import Footer from './components/Footer';
import styles from './styles';
import useThemeStore from '../../../../colorThemeZustand';

const Post = ({ post,deletePost, openBottomSheet,openCommentBottomSheet }) => {
  const { theme } = useThemeStore();

  const containerStyle = {
    ...styles.container,
    borderBottomColor:theme=== 'dark' ? '#0E1114' : '#FFFFFF',
    backgroundColor: theme === 'dark' ? 'black' : '#FFFFFF', 
    borderColor: theme === 'dark' ? 'grey' : '#99c9ff', 

  };


  return (
    <View style={containerStyle}>
      <Header
        imageUri={post.user.imageUri}
        username={post.user.username}
        location={post.user.location}
        rating={post.user.rating}
        time={post.user.time}
        post_id={post.id}
        postUserId={post.userID}
        deletePost={deletePost}
        openBottomSheet={openBottomSheet}
       
      />
      <Body
        resourceUri={post.resourceUri}
        contentType={post.contentType}
        caption={post.caption}
        userData = {post}
      />
      <Footer
        likesCount={post.likesCount}
        shareCount={post.shareCount}
        commentsCount={post.commentsCount}
        viewsCount={post.viewsCount}
        userData={post}
        openCommentBottomSheet={openCommentBottomSheet}
     
      />
    </View>
  );
};

export default Post;
