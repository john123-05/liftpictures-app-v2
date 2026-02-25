import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

const PUBLIC_ROUTES = ['/', 'auth', 'claim'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Don't do anything while auth is loading or navigation is not ready
    if (loading || !navigationState) return;

    const inAuthGroup = segments[0] === 'auth';
    const inPublicRoute = segments.length === 0 || PUBLIC_ROUTES.includes(segments[0]);

    // Redirect unauthenticated users to auth
    if (!user && !inPublicRoute && !inAuthGroup) {
      router.replace('/auth');
    }
  }, [user, loading, segments, navigationState, router]);

  // Show loading only while auth is loading
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6b35" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
