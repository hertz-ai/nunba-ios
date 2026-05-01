/**
 * ShareLandingScreen - Resolves deep links with full campaign attribution.
 *
 * Enhanced flow (integrating Hevolve.ai SEO + Nunba-HART channel routing):
 *   1. Extract `token` from navigation params (populated by React Navigation
 *      linking config from URLs like https://hevolve.ai/s/abc123 or
 *      hevolve://share/abc123).
 *   2. Capture UTM parameters and campaign attribution (deepLinkService).
 *   3. Call shareApi.resolve(token) to get resource type + ID + OG metadata.
 *   4. Handle consent-gated private links (from Hevolve.ai ShareConsentDialog).
 *   5. Track the view with shareApi.trackView(token) + marketing attribution.
 *   6. Navigate (replace) to the appropriate detail screen.
 *   7. If resolution fails, show a friendly error with a retry/home option.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { shareApi } from '../../../services/socialApi';
import deepLinkService, { RESOURCE_ROUTE_MAP } from '../../../services/deepLinkService';
import marketingNotificationService from '../../../services/marketingNotificationService';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../../theme/colors';

const ShareLandingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { token, requiresConsent: initialConsent, ogData: initialOg, resourceType: initialType, resourceId: initialId } = route.params || {};

  const [error, setError] = useState(null);
  const [resolving, setResolving] = useState(true);
  const [consentRequired, setConsentRequired] = useState(initialConsent || false);
  const [ogData, setOgData] = useState(initialOg || null);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const resolveAndNavigate = useCallback(async () => {
    if (!token) {
      setError('Invalid share link - no token provided.');
      setResolving(false);
      return;
    }

    setResolving(true);
    setError(null);

    try {
      const res = await shareApi.resolve(token);
      const data = res?.data || res;

      const resourceType = data?.resource_type || data?.type;
      const resourceId = data?.resource_id || data?.id;

      if (!resourceType || !resourceId) {
        setError('This share link has expired or is invalid.');
        setResolving(false);
        return;
      }

      // Capture OG metadata for SEO preview
      if (data?.og) setOgData(data.og);

      // Fire-and-forget view tracking + marketing attribution
      shareApi.trackView(token).catch(() => {});
      marketingNotificationService.trackEngagement('share_link_opened', {
        token,
        resource_type: resourceType,
        resource_id: resourceId,
        source_channel: data?.source_channel,
      });

      // Check for consent-gated private content (Hevolve.ai pattern)
      if (data?.requires_consent) {
        setConsentRequired(true);
        setPendingNavigation({ resourceType, resourceId });
        setResolving(false);
        return;
      }

      navigateToResource(resourceType, resourceId);
    } catch (err) {
      console.warn('ShareLanding resolve failed:', err);
      const message =
        err?.response?.status === 404
          ? 'This share link has expired or was removed.'
          : err?.response?.status === 403
          ? 'You do not have permission to view this content.'
          : 'Could not load this share link. Please try again.';
      setError(message);
      setResolving(false);
    }
  }, [token, navigation]);

  const navigateToResource = useCallback((resourceType, resourceId) => {
    const mapping = RESOURCE_ROUTE_MAP[resourceType];
    if (!mapping) {
      setError(`Unsupported content type: ${resourceType}`);
      setResolving(false);
      return;
    }

    // Replace this screen so pressing back doesn't return here
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'MainScreen' },
          { name: mapping.screen, params: { [mapping.paramKey]: resourceId } },
        ],
      }),
    );
  }, [navigation]);

  const handleConsentGranted = useCallback(async () => {
    if (!pendingNavigation) return;
    try {
      // Grant consent via API (matches Hevolve.ai shareApi.grantConsent)
      await shareApi.grantConsent?.(token);
    } catch {}
    setConsentRequired(false);
    navigateToResource(pendingNavigation.resourceType, pendingNavigation.resourceId);
  }, [pendingNavigation, token, navigateToResource]);

  const handleConsentDenied = useCallback(() => {
    setConsentRequired(false);
    goHome();
  }, []);

  useEffect(() => {
    // If we already have resourceType/Id from deep link service, navigate directly
    if (initialType && initialId && !initialConsent) {
      navigateToResource(initialType, initialId);
      return;
    }
    resolveAndNavigate();
  }, [resolveAndNavigate, initialType, initialId, initialConsent]);

  const goHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainScreen' }],
      }),
    );
  };

  return (
    <SafeAreaView style={s.container}>
      {resolving ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>Opening shared content...</Text>
          {ogData?.title && (
            <View style={s.ogPreview}>
              {ogData.image && (
                <Image source={{ uri: ogData.image }} style={s.ogImage} resizeMode="cover" />
              )}
              <Text style={s.ogTitle} numberOfLines={2}>{ogData.title}</Text>
              {ogData.description && (
                <Text style={s.ogDescription} numberOfLines={3}>{ogData.description}</Text>
              )}
            </View>
          )}
        </View>
      ) : consentRequired ? (
        <View style={s.center}>
          <Ionicons name="shield-checkmark-outline" size={56} color={colors.accent} />
          <Text style={s.errorTitle}>Private Content</Text>
          <Text style={s.errorText}>
            This content requires your consent to view. The sharer will see that you accessed it.
          </Text>
          {ogData?.title && (
            <Text style={s.ogTitle} numberOfLines={2}>{ogData.title}</Text>
          )}
          <View style={s.actions}>
            <TouchableOpacity style={s.retryBtn} onPress={handleConsentGranted}>
              <Ionicons name="checkmark-circle" size={18} color={colors.textPrimary} />
              <Text style={s.retryText}>View Content</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.homeBtn} onPress={handleConsentDenied}>
              <Ionicons name="close-circle-outline" size={18} color={colors.accent} />
              <Text style={s.homeText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="link-outline" size={56} color={colors.textMuted} />
          <Text style={s.errorTitle}>Link Problem</Text>
          <Text style={s.errorText}>{error}</Text>

          <View style={s.actions}>
            <TouchableOpacity style={s.retryBtn} onPress={resolveAndNavigate}>
              <Ionicons name="refresh" size={18} color={colors.textPrimary} />
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.homeBtn} onPress={goHome}>
              <Ionicons name="home-outline" size={18} color={colors.accent} />
              <Text style={s.homeText}>Go Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.md,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  retryText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  homeText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  // SEO OG preview card (shown while resolving)
  ogPreview: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  ogImage: {
    width: '100%',
    height: 160,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  ogTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  ogDescription: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ShareLandingScreen;
