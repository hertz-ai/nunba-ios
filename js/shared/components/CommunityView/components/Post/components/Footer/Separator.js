import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";

const Separator = () => {
  return <View style={styles.separator} />;
};

const styles = StyleSheet.create({
  separator: {
    height: 1,
    width: Dimensions.get("window").width,
    backgroundColor: "#D8D8D8",
    marginTop: 20,
  },
});

export default Separator;
