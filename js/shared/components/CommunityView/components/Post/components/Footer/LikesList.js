import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome'; // Assuming you are using FontAwesome icons


const LikesList = ({ route }) => {
    const { likesData } = route.params;
    const navigation = useNavigation();


    useEffect(() => {

    }, [likesData])



    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={18} style={styles.icon} />
                </TouchableOpacity>
                <Text style={styles.headerText}>Likes</Text>
            </View>
            <ScrollView>
                {likesData.map((user, index) => (
                    <View key={index} style={styles.userContainer}>
                        <Image
                            source={user.profilePic ? { uri: user.profilePic } : require('./user1.png')}
                            style={styles.profilePic}
                        />

                        <Text style={styles.username}>{user.name}</Text>
                        <TouchableOpacity style={styles.followButton}>
                            <Text style={styles.followButtonText}>Follow</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#121212',
    },
    icon: {
        color: '#fff',
        marginRight: 10,
        marginLeft: 15,
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    userContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        backgroundColor: '#121212',
        padding: 10,
        borderRadius: 8,
        marginHorizontal: 10,
    },
    profilePic: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 10,
        borderColor: 'white',
        borderWidth: 2
    },
    username: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
    },
    followButton: {
        backgroundColor: '#1DA1F2',
        paddingVertical: 5,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    followButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});

export default LikesList;
