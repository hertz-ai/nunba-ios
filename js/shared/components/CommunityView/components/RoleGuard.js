/**
 * RoleGuard / useRoleAccess — gate UI behind a minimum role tier.
 *
 * Mirrors the Nunba web RoleGuard at landing-page/src/components/
 * RoleGuard.js, including the same ROLE_LEVELS map and minRole prop.
 * The semantic difference: Nunba's web guard `<Navigate>` redirects the
 * router; on RN we render `null` (or a `fallback` element) so the same
 * primitive works for both route-wrap and inline-render use cases.
 *
 * Data source priority (highest first):
 *   1. Explicit `userRole` prop — caller knows the tier (test fixtures,
 *      preview surfaces).
 *   2. `useUserStore` — populated by `userStore.init()` which calls
 *      `GET /auth/me` on app mount.  This is the default for runtime.
 *
 * Without the prop and without an initialised store, the tier defaults
 * to `'flat'` — the same baseline Nunba uses for "authenticated user
 * without an explicit role field" — so legacy callers that don't yet
 * pipe userRole through continue to render their children.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useUserStore from '../../../userStore';

const ROLE_LEVELS = { anonymous: 0, guest: 1, flat: 2, regional: 3, central: 4 };

export function useRoleAccess(userRole) {
  const storeTier = useUserStore((s) => s.accessTier);
  const storeIsAdmin = useUserStore((s) => s.isAdmin);
  const storeIsModerator = useUserStore((s) => s.isModerator);
  const role = userRole || storeTier || 'flat';
  const level = ROLE_LEVELS[role] || 0;
  return {
    accessTier: role,
    isAuthenticated: level >= ROLE_LEVELS.flat,
    canWrite: level >= ROLE_LEVELS.flat,
    canModerate: storeIsModerator || level >= ROLE_LEVELS.regional,
    canAdmin: storeIsAdmin || level >= ROLE_LEVELS.central,
    isAdmin: storeIsAdmin || level >= ROLE_LEVELS.central,
    isRegionalOrAbove: level >= ROLE_LEVELS.regional,
  };
}

export default function RoleGuard({
  children,
  minRole = 'flat',
  userRole,
  fallback = null,
  showAccessDenied = false,
}) {
  const storeTier = useUserStore((s) => s.accessTier);
  const loading = useUserStore((s) => s.loading);
  const role = userRole || storeTier || 'flat';
  const level = ROLE_LEVELS[role] || 0;
  const required = ROLE_LEVELS[minRole] || 0;

  if (loading && !userRole) {
    // Don't flash gated content while /auth/me is in-flight.
    return null;
  }
  if (level >= required) return children;
  if (fallback) return fallback;
  if (!showAccessDenied) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Access Restricted</Text>
      <Text style={styles.message}>
        You need {minRole} access or higher to view this content.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  message: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});

export { ROLE_LEVELS };
