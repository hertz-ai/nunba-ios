import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ROLE_LEVELS = { anonymous: 0, guest: 1, flat: 2, regional: 3, central: 4 };

export function useRoleAccess(userRole) {
  const role = userRole || 'flat';
  const level = ROLE_LEVELS[role] || 0;
  return {
    accessTier: role,
    isAuthenticated: level >= ROLE_LEVELS.flat,
    canWrite: level >= ROLE_LEVELS.flat,
    canModerate: level >= ROLE_LEVELS.regional,
    canAdmin: level >= ROLE_LEVELS.central,
    isRegionalOrAbove: level >= ROLE_LEVELS.regional,
  };
}

export default function RoleGuard({ children, minRole = 'flat', userRole, fallback }) {
  const role = userRole || 'flat';
  const level = ROLE_LEVELS[role] || 0;
  const required = ROLE_LEVELS[minRole] || 0;

  if (level >= required) return children;

  if (fallback) return fallback;

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
