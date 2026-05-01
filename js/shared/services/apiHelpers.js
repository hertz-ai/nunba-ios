/**
 * Shared auth utilities — single source for NativeModule auth calls.
 *
 * Three auth patterns exist in this app:
 *   1. getAccessToken() — OAuth/session token (socialApi, chatApi, deviceApi)
 *   2. getUserId()      — user ID as bearer (kidsLearningApi, kidsMediaApi, vaultApi)
 *   3. getToken()       — tries accessToken first, falls back to userId (PocketTTS, STT)
 */

import { NativeModules } from 'react-native';

const { OnboardingModule } = NativeModules;

/** Get current user ID via OnboardingModule callback. */
export const getUserId = () =>
  new Promise((resolve, reject) => {
    try {
      OnboardingModule.getUser_id((userId) => resolve(userId));
    } catch (err) {
      reject(err);
    }
  });

/** Get OAuth/session access token via OnboardingModule callback. */
export const getAccessToken = () =>
  new Promise((resolve, reject) => {
    try {
      OnboardingModule.getAccessToken((token) => resolve(token));
    } catch (err) {
      reject(err);
    }
  });

/**
 * Best-effort token: tries accessToken first, falls back to userId.
 * Never rejects — resolves null if both fail.
 */
export const getToken = () =>
  new Promise((resolve) => {
    try {
      OnboardingModule.getAccessToken((token) => resolve(token));
    } catch (_) {
      try {
        OnboardingModule.getUser_id((uid) => resolve(uid));
      } catch (__) {
        resolve(null);
      }
    }
  });

/** Headers with access token (for socialApi, chatApi, deviceApi pattern). */
export const getAuthHeaders = async () => {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

/** Headers with user ID (for kidsLearningApi, kidsMediaApi, vaultApi pattern). */
export const getUserAuthHeaders = async () => {
  const userId = await getUserId();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userId}`,
  };
};
