import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, RefreshControl, Animated, ScrollView, KeyboardAvoidingView, TouchableWithoutFeedback, Dimensions, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/AntDesign';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from './colors';

import Separator from './Separator';
import { useNavigation } from '@react-navigation/native';
import Post from '../../index';
import useThemeStore from '../../../../../../colorThemeZustand';
import OCIcon from 'react-native-vector-icons/Octicons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
const CommentsList = ({ route }) => {
  const { userData, userId, updateCommentCount } = route.params;
  const navigation = useNavigation();
  const { theme } = useThemeStore();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [canReply, setCanReply] = useState(true);
  const [parentCommentId, setParentCommentId] = useState(null);
  const [CommentLikes, setCommentLikes] = useState([])
  const [showRepliesFor, setShowRepliesFor] = useState(null);
  const [visibleDropdownId, setVisibleDropdownId] = useState(null);
  const [allComments, setAllComments] = useState(null)
  const [selectedCommentId, setSelectedCommentId] = useState(null);
  console.log(CommentLikes, "this is th1e userId");
  const translateY = useRef(new Animated.Value(500)).current;
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [CommentID, setCommentID] = useState()
  const [postUserID, setPostUserID] = useState()

  useEffect(() => {


    fetchComments();
  }, [userData, CommentLikes, showRepliesFor]);

  const getCommentLike = (comment_id) => {
    fetch(`https://mailer.hertzai.com/comment_like?comment_id=${comment_id}`)
      .then((response) => response.json())
      .then((data) => {
        console.log("Likes by post_id:", data);

        const uniqueUsers = new Map();


        const filteredData = data.filter((item) => {
          if (!uniqueUsers.has(item.user_id)) {
            uniqueUsers.set(item.user_id, true);
            return true;
          }
          return false;
        });
        setCommentLikes(filteredData);



      })
      .catch((error) => {
        console.error("Error fetching likes by post_id:", error);
      });
  };
  const handleReply = (data) => {
    setNewComment(`@${data.name} `);
    setParentCommentId(data.comment_id);

  };
  const commentLike = (comment_id) => {
    console.log('hello', comment_id)
    fetch("https://mailer.hertzai.com/create_activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment_id: comment_id,
        type: "Like",
      }),
    })
      .then((response) => response.json())
      .then((data) => {

        const activity_id = data.activity_id;

        // Second API call
        return fetch("https://mailer.hertzai.com/Like", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            activity_id: activity_id,
            user_id: userId,
          }),
        });
      })
      .then((response) => {
        if (response.ok) {

          console.log("Like successfully recorded");
        } else {

          console.error("Error recording like");
        }
      })
      .catch((error) => {

        console.error("Network error:", error);
      });
  }
  const formatCreationDate = (creationDate) => {
    const currentDate = new Date();
    const postDate = new Date(creationDate);


    const timeDifference = currentDate - postDate;


    const hoursDifference = Math.floor(timeDifference / (1000 * 60 * 60));
    const daysDifference = Math.floor(hoursDifference / 24);


    if (daysDifference < 1) {
      return `${hoursDifference} h`;
    } else {
      return `${daysDifference} d`;
    }
  };

  //CSS
  const container = {
    ...styles.container,
    backgroundColor: theme === 'dark' ? '#0E1114' : '#FFF',
  };
  const author = {
    ...styles.author,
    color: theme === 'dark' ? '#FFF' : 'gray',
  };
  const commentRow = {
    ...styles.commentRow,
    color: theme === 'dark' ? '#FFF' : 'black',
  };
  const hour = {
    ...styles.hour,
    color: theme === 'dark' ? 'gray' : 'grey',
  };
  const hour1 = {
    ...styles.hour1,
    color: theme === 'dark' ? 'gray' : 'grey',
  };
  const likes1 = {
    ...styles.likes1,
    color: theme === 'dark' ? 'gray' : 'grey',
  };
  const likes = {
    ...styles.likes,
    color: theme === 'dark' ? 'gray' : 'grey',
  };
  const commentCounter = {
    ...styles.commentCounter,
    color: theme === 'dark' ? 'gray' : 'black',
  };
  const hideRepliesText = {
    ...styles.hideRepliesText,
    color: theme === 'dark' ? '#FFF' : 'black',
  };
  const title = {
    ...styles.title,
    color: theme === 'dark' ? '#FFF' : 'black',
  };
  const footer = {
    ...styles.footer,
    backgroundColor: theme === 'dark' ? 'black' : '#FFF',
    borderTopColor: theme === 'dark' ? '#FFF' : 'gray',
  };

  const IconStyle = {

    color: theme === 'dark' ? '#FFF' : 'black',
  };
  const placeholder = {

    color: theme === 'dark' ? '#FFF' : 'black',
  };
  const postButton = {
    ...styles.postButton,
    backgroundColor: theme === 'dark' ? '#1DA1F2' : 'black',
  };


  const blockUser = async () => {
    setIsBottomSheetOpen(false);

    const url = 'https://mailer.hertzai.com/block_user';
    const payload = {
      user_id: userId,
      block_user_id: selectedPost.userID,
      type_of_activity: 'Block',
      scope: 'Post'
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
      console.log(responseJson, 'this id block');

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to block user');
    }
  };






  const fetchComments = () => {
    fetch(`https://mailer.hertzai.com/comment_bypost?post_id=${userData.id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        console.log('this is the data', data);
        if (data) {
          setAllComments(data)
          const topComments = data.filter(comment => comment.parent_comment_id === 0);
          setComments(topComments);
          console.log("this is the the topComments", topComments)

          const replies = data.filter(comment => {
            return data.some(c => c.comment_id === comment.parent_comment_id);
          });

          setReplies(replies);

          console.log('Replies:', replies);
          setLoading(false);
        } else {
          console.error("Invalid data format or no comments found");
        }
      })
      .catch((error) => {
        console.error("Error fetching comments:", error);
      });
  };
  const submitComment = () => {

    if (parentCommentId === null) {
      fetch("https://mailer.hertzai.com/Comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: userData.id,
          user_id: userId,
          text: newComment,
          parent_comment_id: null

        }),
      })
        .then((response) => {
          if (response.ok) {
            setNewComment('');
            fetchComments();
            updateCommentCount();
          } else {
            console.error("Error recording comment");
          }
        })
        .catch((error) => {
          console.error("Network error:", error);
        })
    } else {
      console.log("this is the parent commentid", parentCommentId)

      fetch("https://mailer.hertzai.com/Comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: userData.id,
          user_id: userId,
          text: newComment,
          parent_comment_id: parentCommentId
        }),
      })
        .then((response) => {
          if (response.ok) {
            setNewComment('');
            setParentCommentId(null)
            fetchComments();
            updateCommentCount(commentData);
          } else {
            console.error("Error recording comment");
          }
        })
        .catch((error) => {
          console.error("Network error:", error);
        });
    }
  };




  //

  const toggleReplies = (commentId) => {
    setShowRepliesFor(showRepliesFor === commentId ? null : commentId);
  };

  const deleteReply = async (commentId) => {
    console.log("Deleting comment with ID:", commentId);
    try {
      const response = await fetch(`https://mailer.hertzai.com/delete_comment?comment_id=${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('Success', 'Comment deleted successfully');
        setIsBottomSheetOpen(false)
        fetchComments();
      } else {
        console.log('Error', 'Failed to delete comment');
      }
    } catch (error) {
      console.error(error);
    }
  };
  const toggleDropdown = (data) => {
    console.log(data, 'hello');
    setIsBottomSheetOpen(!isBottomSheetOpen)
    setCommentID(data.comment_id)
    setPostUserID(data.user_id)
  };


  const navigateToReportScreen = (comment_id) => {

    navigation.navigate('ReportComment', { comment_id: comment_id, deleteReply });
  };

  const handleOutsideTap = () => {
    if (isBottomSheetOpen) {
      setIsBottomSheetOpen(false); // Close the bottom sheet
    }
  };

  console.log('this is the showreplies', showRepliesFor)

  return (



    <View style={container}>
      <View style={styles.header}>

        <TouchableOpacity onPress={() => {
          if (isBottomSheetOpen) {
            setIsBottomSheetOpen(false);
          } else {
            navigation.goBack();
          }
        }}>
          <Icon name="left" size={32} style={IconStyle} />
        </TouchableOpacity>
        <Text style={title}>Comments</Text>
        <TouchableOpacity onPress={() => { }}>
          <Feather name="send" size={32} style={IconStyle} />
        </TouchableOpacity>
      </View>


      <ScrollView contentContainerStyle={styles.scrollView} style={styles.commentsContainer}>
        <View style={styles.postContainer}>
          <Post post={userData} />
        </View>
        <Separator />
        <View style={styles.commentList}>
          {comments.map((data) => (
            <TouchableOpacity
              key={data.comment_id}
              style={[
                styles.comment,
                selectedCommentId && selectedCommentId != data.comment_id && styles.blurredComment,
                selectedCommentId == data.comment_id && styles.selectedComment,
              ]}


            >
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 10, marginLeft: 20, marginRight: 20 }}>
                <TouchableOpacity style={{ justifyContent: "center" }}>
     <Image style={styles.avatarStyle2} source={require('../../../../../../images/user1.png')} />
                </TouchableOpacity>

                <Text style={author}>
                  {data.name}
                </Text>

                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                  <View style={{ flex: 1, maxWidth: '95%', borderRadius: 5, marginTop: 5 }}>
                    <Text style={{ color: '#FFF', flexWrap: 'wrap' }} numberOfLines={3}>
                      {data.comment}
                    </Text>
                  </View>


                  <TouchableOpacity onPress={() => toggleDropdown(data.comment_id)} style={{ marginLeft: 10 }}>
                    <OCIcon name="kebab-horizontal" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cardStatsCounter}>
                <Text style={hour}>{formatCreationDate(data.creation_date)}</Text>
                <TouchableOpacity onPress={() => getCommentLike(data.comment_id)}>
                  <Text style={likes1}>{CommentLikes.length}Likes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => commentLike(data.comment_id)}>
                  <Text style={commentCounter}>Lit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleReply(data)}>
                  <Text style={commentCounter}>Reply</Text>
                </TouchableOpacity>



              </View>

              <View style={styles.replyContainer}>
                <TouchableOpacity style={{ flexDirection: "row", justifyContent: "center" }} onPress={() => toggleReplies(data)}>
                  <View style={{ ...styles.replyBar }} />
                  <Text style={hideRepliesText}>
                    {showRepliesFor === data.comment_id ? 'Hide Replies' : 'Show Replies'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showRepliesFor?.comment_id === data.comment_id && (
                <View style={styles.commentList}>
                  {replies.filter(reply => reply.parent_comment_id === data.comment_id).map((reply, index) => (
                    <View key={index}>
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 10, marginLeft: 40, marginRight: 20 }}>
                        <TouchableOpacity style={{ justifyContent: "center" }}>
                         <Image style={styles.avatarStyle2} source={require('./user1.png')} />
                        </TouchableOpacity>
                        <Text style={author}>{reply.name}</Text>
                        <TouchableOpacity onPress={() => toggleDropdown(data)}>
                          <Text numberOfLines={1} style={commentRow}>
                            {reply.comment}
                          </Text></TouchableOpacity>

                      </View>

                      <View style={styles.cardStatsCounter}>
                        <View style={styles.flexStartAligned}>

                          <Text style={hour1}>{formatCreationDate(reply.creation_date)}</Text>
                          <Text style={likes1}>{CommentLikes.length}Likes</Text>
                          <TouchableOpacity onPress={() => commentLike(data.comment_id)}>
                            <Text style={commentCounter}>Lit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        {loading && (
          <View style={styles.spinner}>
            <Text>Loading...</Text>
          </View>
        )}

      </ScrollView>


      <KeyboardAvoidingView behavior="padding" style={footer}>
        <View style={styles.footerContent}>
          <TouchableOpacity style={styles.userPhotoContainer}>
           <Image
             style={styles.avatarStyle}
             source={require('./user1.png')}
           />
          </TouchableOpacity>
          <TextInput
            underlineColorAndroid="transparent"
            style={[styles.inputStyle, { color: theme === 'dark' ? '#FFF' : 'black' }]}
            placeholder={"Add a comment..."}
            placeholderTextColor={theme === 'dark' ? '#FFF' : 'black'}
            value={newComment}
            onChangeText={text => setNewComment(text)}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity onPress={submitComment} style={postButton}>
            <Text>Post</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
      {isBottomSheetOpen && (
        <TouchableWithoutFeedback onPress={handleOutsideTap}>
          <View style={styles.overlay}>
            <Animated.View style={[styles.bottomSheet]}>
              {(userId === 1 || userId === 10202 || userId === Number(String(postUserID).split("'").join(''))) && (
                <TouchableOpacity onPress={() => deleteReply(CommentID)} style={styles.dropdownOption}>
                  <Text style={styles.dropdownOptionText}>Delete</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => navigateToReportScreen(CommentID)} style={styles.dropdownOption}>
                <Text style={styles.dropdownOptionText}>Report</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={blockUser} style={styles.dropdownOption}>
                <Text style={styles.dropdownOptionText}>Block User</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={navigateToReportScreen} style={styles.dropdownOption}>
                <Text style={styles.dropdownOptionText}>Block post</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flexGrow: 1,
    paddingBottom: 90,
  },
  commentsContainer: {
    flex: 1,
  },
  commentList: {
    // paddingVertical: 15,
    // paddingHorizontal: 10,
    flex: 1
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: colors.light_gray,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userPhotoContainer: {
    marginRight: 10,
  },
  avatarStyle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  inputStyle: {
    flex: 1,
    fontSize: 13,
    height: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.light_gray,
    borderRadius: 20,
  },
  postButton: {
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,

  },
  spinner: {
    alignSelf: 'center',
    marginTop: 20,
  },



  avatarStyle2: {
    position: 'absolute',
    top: 0,
    width: 30,
    height: 30,
    alignSelf: 'center',
    borderRadius: 15,
  },
  commentRow: {
    lineHeight: 20,
    fontSize: 14,
    color: colors.black,
    paddingHorizontal: 8,
  },
  author: {
    fontWeight: 'bold',

    marginLeft: 25
  },
  cardStatsCounter: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 45,
    marginTop: 5,

  },
  flexStartAligned: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row'
  },

  rightSide: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginRight: 10
  },

  hour: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  hour1: {
    marginLeft: 18,
    fontSize: 13,
    fontWeight: 'bold',

  },
  likes: {
    fontSize: 13,
    marginLeft: 10,
    fontWeight: 'bold',

  },
  likes1: {
    fontSize: 13,
    marginLeft: 10,
    fontWeight: 'bold',

    marginLeft: 10
  },
  commentCounter: {
    fontSize: 13,
    marginLeft: 10,
    fontWeight: 'bold',

  },
  replyContainer: {
    marginTop: 10,
    marginBottom: 20,
    marginLeft: 45,
    flexDirection: 'row'
  },
  postContainer: {


    width: '100%',
    overflow: 'hidden'
  },
  dropdown: {
    position: 'absolute',
    top: 40,
    right: 40,
    backgroundColor: '#1c1c1c',
    borderRadius: 5,
    padding: 10,
    zIndex: 50,
    width: wp('30%')
  },
  dropdownOption: {
    padding: 10,
    zIndex: 20,
    textAlign: 'center'
  },
  dropdownOptionText: {
    fontSize: 16,
    color: 'red',
    zIndex: 100,
    textAlign: 'center'

  },
    hideRepliesText: {
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 8,
    },

    replyBar: {
      width: 2,
      height: 20,
      backgroundColor: '#666',
      marginRight: 8,
    },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    justifyContent: 'flex-end', // Align bottom sheet at the bottom
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    position: 'absolute'
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
  comment: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    marginVertical: 5,
    marginHorizontal: 10,
    padding: 5,
    borderRadius: 5,
  },
  blurredComment: {
    opacity: 0.1,
  },
  selectedComment: {
    opacity: 1,
    borderColor: 'blue',
    borderWidth: 1,
  },
  commentContent: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 20,
    marginRight: 20,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#3F3F3F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    minHeight: 200,
    maxHeight: 800,
    zIndex: 500000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownOption: {
    display: 'flex',
    margin: hp('1%'),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('1%'),
    paddingVertical: hp('1%'),
  },
  dropdownOptionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#FFF'
  },





});

export default CommentsList;
