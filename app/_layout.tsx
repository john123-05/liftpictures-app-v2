import { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AccessProvider, useAccess } from '@/contexts/AccessContext';
import PasswordScreen from '@/components/PasswordScreen';
import AuthGuard from '@/components/AuthGuard';
import '@/lib/i18n';

function LayoutContent() {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';
  const { hasAccess, isLoading } = useAccess();

  if (isLoading) {
    return <View style={styles.loadingContainer} />;
  }

  if (!hasAccess) {
    return <PasswordScreen />;
  }

  const content = (
    <LanguageProvider>
      <AuthProvider>
        <AuthGuard>
          <CartProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </CartProvider>
        </AuthGuard>
      </AuthProvider>
    </LanguageProvider>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.desktopContainer}>
        <View style={[styles.mobileWrapper, isLandingPage && styles.landingWrapper]}>
          {content}
        </View>
      </View>
    );
  }

  return content;
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AccessProvider>
      <LayoutContent />
    </AccessProvider>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 428,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  landingWrapper: {
    maxWidth: '100%',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
});