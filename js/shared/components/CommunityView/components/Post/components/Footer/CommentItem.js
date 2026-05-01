import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Avatar, Text } from "react-native-elements";
import { colors } from "./colors";


const CommentItem = ({
  context,
  author,
  message,
  linesType,
  numberOfLines,
  likeCount,
  canReply,
  Time

}) => {
  const [showReplies, setShowReplies] = useState(false);

  const handleHideReplies = () => setShowReplies(false);


  const formatCreationDate = (creationDate) => {
    const currentDate = new Date();
    const postDate = new Date(creationDate);


    const timeDifference = currentDate - postDate;


    const hoursDifference = Math.floor(timeDifference / (1000 * 60 * 60));
    const daysDifference = Math.floor(hoursDifference / 24);


    if (daysDifference < 1) {
      return `${hoursDifference} hours ago`;
    } else {
      return `${daysDifference} days ago`;
    }
  };


  return (
    <View>
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 10, marginLeft: context !== 'Home' ? 20 : 4, marginRight: context !== 'Home' ? 20 : 4 }}>
        {context !== "Home" && (
          <TouchableOpacity style={{ justifyContent: "center" }}>
            <Avatar containerStyle={styles.avatarStyle} rounded source={require('../../../../../images/user1.png')} />
          </TouchableOpacity>
        )}

        <Text style={styles.author}>{author}</Text>
        <Text
          numberOfLines={linesType === "multilines" ? numberOfLines : 1}
          style={styles.commentRow}
        >
          {message}
        </Text>
      </View>
      <View style={styles.cardStatsCounter}>
        <View style={styles.flexStartAligned}>
          <Text style={styles.hour}>{formatCreationDate(Time)}</Text>
          <Text style={styles.likes}>12 Likes</Text>
          <TouchableOpacity>
            <Text style={styles.commentCounter}>Lit</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.commentCounter}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
      {canReply && context !== "Home" && (
        <View>
          <View style={styles.replyContainer}>
            <TouchableOpacity style={{ flexDirection: "row", justifyContent: "center" }}>
              <View style={{ ...styles.replyBar }} />
              <Text style={styles.hideRepliesText} onPress={handleHideReplies}>
                Hide replies
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      )}
    </View>
  );
};



const styles = StyleSheet.create({
  commentRow: {
    lineHeight: 20,
    fontSize: 14,
    color: colors.black,
    paddingHorizontal: 8,
  },
  author: {
    fontWeight: 'bold',
    color: colors.black,
    marginLeft: 25
  },
  flexStartAligned: {
    flex: 1,
    justifyContent: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center'
  }, avatarStyle: {
    position: 'absolute',
    top: 0,
    width: 30,
    height: 30,
    alignSelf: 'center',
    borderRadius: 14,
  },

  cardStatsCounter: {
    flexDirection: 'row',
    marginLeft: 40,
    marginTop: 5
  },
  hour: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.dark_gray,
  },
  likes: {
    fontSize: 13,
    marginLeft: 10,
    fontWeight: 'bold',
    color: colors.dark_gray
  },
  commentCounter: {
    fontSize: 13,
    marginLeft: 12,
    fontWeight: 'bold',
    color: colors.dark_gray
  },
  replyContainer: {
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 30,
    flexDirection: 'row'
  }
});

export default CommentItem;
