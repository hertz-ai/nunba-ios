import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, NativeModules, StyleSheet, PermissionsAndroid, DeviceEventEmitter } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
const { ActivityStarterModule, OnboardingModule } = NativeModules;
import useThemeStore from '../../../../../colorThemeZustand';

export default function addPost() {
    const navigation = useNavigation();
    const { theme } = useThemeStore()
    const [inputValue, setInputValue] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const handleChangeText = (text) => {
        setInputValue(text);
    }


    useEffect(() => {

        const eventListener = DeviceEventEmitter.addListener(
            'AddPost_UserUploadImage',
            event => {
                const { AddPost_UserUploadImage } = event;
                setSelectedImage(AddPost_UserUploadImage);
            },
        );


        return () => {
            eventListener.remove();
        };
    }, [selectedImage, inputValue]);
    console.log(selectedImage, 'this is the uri')
    console.log(inputValue)

    const header = {
        ...styles.header,
        borderBottomColor: theme === 'dark' ? '#0E1114' : '#FFFFFF',
    };
    const mainContainer = {
        ...styles.mainContainer,
        backgroundColor: theme === 'dark' ? '#0E1114' : '#FFFFFF',
    };
    const buttonText = {
        ...styles.buttonText,

        color: theme === 'dark' ? '#FFFFFF' : '#0E1114',
    }
    const button = {
        ...styles.button,
        backgroundColor: theme === 'dark' ? 'grey' : '0078ff',
    };
    const headerText = {
        ...styles.headerText,
        color: theme === 'dark' ? '#FFFFFF' : '#0E1114',
    };
    const Iconstyles = {


        color: theme === 'dark' ? '#FFFFFF' : '#0078ff',
    };
    const postSubmit = () => {
        console.log('function called');
        OnboardingModule.sendRequestToAddPost(selectedImage, inputValue);
        if (true) {
            navigation.navigate('MainScreen');
        }
    }



    return (
        <View style={mainContainer}>

            <View style={header}>

                <View style={styles.leftHeader}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Icon name="arrow-left" size={20} style={Iconstyles} />
                    </TouchableOpacity>
                    <Text style={headerText}>Add Post</Text>
                </View>

                <TouchableOpacity onPress={postSubmit}
                    style={styles.rightHeader}>
                    <Text style={headerText}>Post</Text>
                </TouchableOpacity>
            </View>


            <View style={{ paddingHorizontal: 20, marginTop: 10, height: 250, flex: 1 }}>
                <Image source={require('./user1.png')} style={{ height: 46, width: 46 }} />

                <TextInput
                    style={{ color: theme === 'dark' ? '#FFF' : "grey", fontSize: 18, paddingTop: 16 }}
                    placeholder="Share your thoughts?"
                    placeholderTextColor={theme === 'dark' ? '#FFF' : "grey"}
                    value={inputValue}
                    onChangeText={handleChangeText}
                />
            </View>
            {selectedImage && (
                <Image
                    source={{ uri: selectedImage }}
                    style={{ width: '100%', height: 200, marginTop: 10 }}
                    resizeMode="contain"
                />
            )}

            <View style={styles.row2}>
                {/* <TouchableOpacity style={styles.button}>
                    <Text style={styles.buttonText}>Share Achievements</Text>
                </TouchableOpacity> */}
                <TouchableOpacity style={button} onPress={() => {
                    console.log("button clicked");
                    ActivityStarterModule.navigateToAddPost();
                }
                }>
                    <Text style={buttonText}>Add a photo</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 20,
    },
    mainContainer: {
        flex: 1
    },
    leftHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerText: {
        fontSize: 18,
        marginLeft: 10,
    },
    rightHeader: {

    },
    row2: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 20,
        marginBottom: 10,
        marginHorizontal: 10,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 5,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});
