import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    NativeModules,
    StyleSheet,
    DeviceEventEmitter,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import MentionInput from '../../../../shared/MentionInput';
import Icon from 'react-native-vector-icons/FontAwesome';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import useThemeStore from '../../../../../colorThemeZustand';
import { hapticLight } from '../../../../../services/haptics';
import { colors } from '../../../../../theme/colors';
import { createCommunityPost } from '../../../../../services/communityFeedApi';

const { ActivityStarterModule, OnboardingModule } = NativeModules;

export default function addPost() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { theme } = useThemeStore();
    const [inputValue, setInputValue] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [userId, setUserId] = useState(0);
    const [posting, setPosting] = useState(false);

    const handleChangeText = useCallback((text) => {
        setInputValue(text);
    }, []);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('AddPost_UserUploadImage', (event) => {
            setSelectedImage(event?.AddPost_UserUploadImage || null);
        });
        // user_id is required by the add-post backend (getUser_id exists on iOS).
        try {
            if (typeof OnboardingModule?.getUser_id === 'function') {
                OnboardingModule.getUser_id((id) => { if (id) setUserId(Number(id)); });
            }
        } catch (_) {}
        return () => sub.remove();
    }, []);

    const hasContent = inputValue.trim().length > 0 || !!selectedImage;

    const isDark = theme === 'dark';
    // Inset the header below the status bar / notch (it sits at the top of the
    // screen with no SafeAreaView, so without this it renders behind the clock).
    const headerStyle = { ...styles.header, paddingTop: styles.header.marginTop + insets.top, marginTop: 0, borderBottomColor: isDark ? '#0E1114' : '#FFFFFF' };
    const mainContainer = { ...styles.mainContainer, backgroundColor: isDark ? '#0E1114' : '#FFFFFF' };
    const headerText = { ...styles.headerText, color: isDark ? '#FFFFFF' : '#0E1114' };
    const photoButton = { ...styles.photoButton, backgroundColor: colors.accent };
    const postPillEnabled = { ...styles.postPill, backgroundColor: colors.accent };
    const postPillDisabled = { ...styles.postPill, backgroundColor: isDark ? '#2A2D32' : '#E5E7EB' };
    const postPillTextEnabled = { ...styles.postPillText, color: '#FFFFFF' };
    const postPillTextDisabled = { ...styles.postPillText, color: isDark ? '#6B7280' : '#9CA3AF' };

    const postSubmit = useCallback(async () => {
        if (!hasContent || posting) return;
        try { hapticLight(); } catch (_) {}
        // The add-post backend requires an image (400 "No image file provided"
        // otherwise). On Android the native picker enforces this; mirror it here.
        if (!selectedImage) {
            alert('Please add a photo to post.');
            return;
        }
        // Android calls native sendRequestToAddPost; iOS has none, so post via
        // the shared JS service. If a native impl ever appears, prefer it.
        if (typeof OnboardingModule?.sendRequestToAddPost === 'function') {
            OnboardingModule.sendRequestToAddPost(selectedImage, inputValue);
            navigation.navigate('MainScreen');
            return;
        }
        setPosting(true);
        try {
            const created = await createCommunityPost({
                userId,
                caption: inputValue,
                imageUri: selectedImage,
            });
            // Surface the new post in the feed immediately — the Feed listens
            // for 'AddPostKey' (same event Android emits from getAllPosts).
            if (created && created.id) {
                DeviceEventEmitter.emit('AddPostKey', {
                    AddPostKey: JSON.stringify(created),
                });
            }
            navigation.navigate('MainScreen');
        } catch (e) {
            alert('Could not post. Please try again.\n' + (e?.message || ''));
        } finally {
            setPosting(false);
        }
    }, [hasContent, posting, selectedImage, inputValue, userId, navigation]);

    const clearImage = useCallback(() => {
        try { hapticLight(); } catch (_) {}
        setSelectedImage(null);
    }, []);

    const openPhotoPicker = useCallback(async () => {
        try { hapticLight(); } catch (_) {}
        // Android opens its native picker; iOS uses the JS image picker.
        if (typeof ActivityStarterModule?.navigateToAddPost === 'function') {
            ActivityStarterModule.navigateToAddPost();
            return;
        }
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                selectionLimit: 1,
                quality: 0.8,
            });
            if (result?.didCancel) return;
            const uri = result?.assets?.[0]?.uri;
            if (uri) {
                setSelectedImage(uri);
            } else if (result?.errorCode) {
                alert('Could not open photos: ' + (result.errorMessage || result.errorCode));
            }
        } catch (e) {
            alert('Could not open the photo library.\n' + (e?.message || ''));
        }
    }, []);

    return (
        <KeyboardAvoidingView
            style={mainContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={headerStyle}>
                <View style={styles.leftHeader}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityLabel="Cancel post"
                    >
                        <Icon name="arrow-left" size={20} color={isDark ? '#FFFFFF' : '#0078ff'} />
                    </TouchableOpacity>
                    <Text style={headerText}>Add Post</Text>
                </View>

                <TouchableOpacity
                    onPress={postSubmit}
                    disabled={!hasContent}
                    style={hasContent ? postPillEnabled : postPillDisabled}
                    accessibilityLabel="Post"
                    accessibilityState={{ disabled: !hasContent }}
                >
                    <Text style={hasContent ? postPillTextEnabled : postPillTextDisabled}>Post</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.composerBody}>
                <Image source={require('./user1.png')} style={styles.avatar} />

                <MentionInput
                    style={{
                        color: isDark ? '#FFF' : '#0E1114',
                        fontSize: 18,
                        paddingTop: 16,
                        flex: 1,
                    }}
                    placeholder="What's on your mind?"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.55)' : '#6B7280'}
                    value={inputValue}
                    onChangeText={handleChangeText}
                    multiline
                />
            </View>

            {selectedImage ? (
                <View style={styles.imagePreviewWrap}>
                    <Image
                        source={{ uri: selectedImage }}
                        style={styles.imagePreview}
                        resizeMode="contain"
                    />
                    <TouchableOpacity
                        onPress={clearImage}
                        style={styles.imageRemove}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Remove photo"
                    >
                        <Ionicons name="close" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            ) : null}

            <View style={styles.row2}>
                <TouchableOpacity style={photoButton} onPress={openPhotoPicker}>
                    <Ionicons name="image-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.photoButtonText}>Add a photo</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 20,
    },
    leftHeader: { flexDirection: 'row', alignItems: 'center' },
    headerText: { fontSize: 18, marginLeft: 10, fontWeight: '600' },
    postPill: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 999,
        minWidth: 64,
        alignItems: 'center',
        justifyContent: 'center',
    },
    postPillText: { fontSize: 14, fontWeight: '700' },
    composerBody: { paddingHorizontal: 20, marginTop: 10, minHeight: 200, flex: 1 },
    avatar: { height: 46, width: 46, borderRadius: 23 },
    imagePreviewWrap: { width: '100%', marginTop: 10, position: 'relative' },
    imagePreview: { width: '100%', height: 200 },
    imageRemove: {
        position: 'absolute',
        top: 8,
        right: 12,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    row2: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 20,
        marginBottom: 10,
        marginHorizontal: 10,
    },
    photoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
    },
    photoButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
