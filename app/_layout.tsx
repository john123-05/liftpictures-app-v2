import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AccessProvider, useAccess } from '@/contexts/AccessContext';
import PasswordScreen from '@/components/PasswordScreen';
import AuthGuard from '@/components/AuthGuard';
import '@/lib/i18n';

function LayoutContent() {
  const { hasAccess, isLoading } = useAccess();
  const neonPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(neonPulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(neonPulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [neonPulse]);

  const outlinePulseStyle = {
    opacity: neonPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.55, 0.9],
    }),
    transform: [
      {
        scale: neonPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.01],
        }),
      },
    ],
  };

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
        <LinearGradient
          colors={['#22272e', '#2d333b', '#24292f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.desktopBackground}
        >
          <View style={styles.desktopContentRow}>
            <View style={styles.infoCard}>
              <LinearGradient
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.infoCardGradient}
              >
                <View style={styles.infoBadge}>
                  <Text style={styles.infoBadgeText}>FEATURES</Text>
                </View>
                <Text style={styles.infoTitle}>Was die App kann</Text>
                <Text style={styles.infoSubtitle}>Alles in einem Flow, von Fahrt bis Download.</Text>

                <View style={styles.infoItemRow}>
                  <View style={styles.infoDot} />
                  <Text style={styles.infoLine}>Fotos pro Fahrt automatisch anzeigen</Text>
                </View>
                <View style={styles.infoItemRow}>
                  <View style={styles.infoDot} />
                  <Text style={styles.infoLine}>Einzelbilder oder Tagesfotopass kaufen</Text>
                </View>
                <View style={styles.infoItemRow}>
                  <View style={styles.infoDot} />
                  <Text style={styles.infoLine}>Favoriten, Warenkorb und Käufe speichern</Text>
                </View>
                <View style={styles.infoItemRow}>
                  <View style={styles.infoDot} />
                  <Text style={styles.infoLine}>Gekaufte Bilder teilen und herunterladen</Text>
                </View>
                <View style={styles.infoItemRow}>
                  <View style={styles.infoDot} />
                  <Text style={styles.infoLine}>Profil, Avatar und Dashboard-Ranking nutzen</Text>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.phoneFrameShell}>
              <Animated.View style={[styles.phoneOutlineGlow, outlinePulseStyle]} />
              <View style={styles.phoneFrame}>
                <View style={styles.phoneNotch} />
                <View style={styles.mobileWrapper}>{content}</View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <LinearGradient
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.infoCardGradient}
              >
                <View style={styles.infoBadge}>
                  <Text style={styles.infoBadgeText}>FLOW</Text>
                </View>
                <Text style={styles.infoTitle}>So funktioniert der Ablauf</Text>
                <Text style={styles.infoSubtitle}>Schnell, sicher und komplett automatisiert.</Text>

                <View style={styles.infoItemRow}>
                  <View style={styles.infoStepPill}><Text style={styles.infoStepPillText}>1</Text></View>
                  <Text style={styles.infoLine}>Anmelden und Fahrt auswählen oder erfassen</Text>
                </View>
                <View style={styles.infoItemRow}>
                  <View style={styles.infoStepPill}><Text style={styles.infoStepPillText}>2</Text></View>
                  <Text style={styles.infoLine}>Bilder ansehen und in den Warenkorb legen</Text>
                </View>
                <View style={styles.infoItemRow}>
                  <View style={styles.infoStepPill}><Text style={styles.infoStepPillText}>3</Text></View>
                  <Text style={styles.infoLine}>Checkout über Stripe abschließen</Text>
                </View>
                <View style={styles.infoItemRow}>
                  <View style={styles.infoStepPill}><Text style={styles.infoStepPillText}>4</Text></View>
                  <Text style={styles.infoLine}>Webhook schaltet Bilder automatisch frei</Text>
                </View>
                <View style={styles.infoItemRow}>
                  <View style={styles.infoStepPill}><Text style={styles.infoStepPillText}>5</Text></View>
                  <Text style={styles.infoLine}>Bilder erscheinen unter Gekaufte Bilder</Text>
                </View>
                <View style={styles.infoItemRow}>
                  <View style={styles.infoStepPill}><Text style={styles.infoStepPillText}>6</Text></View>
                  <Text style={styles.infoLine}>Danach direkt teilen oder downloaden</Text>
                </View>
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
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
    backgroundColor: '#24292f',
  },
  desktopBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  desktopContentRow: {
    width: '100%',
    maxWidth: 1360,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  infoCard: {
    flex: 1,
    maxWidth: 330,
    minWidth: 220,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  infoCardGradient: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  infoBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 115, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.5)',
    marginBottom: 10,
  },
  infoBadgeText: {
    color: '#ffb17f',
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 19,
  },
  infoItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  infoDot: {
    width: 7,
    height: 7,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: '#ff7b3d',
    shadowColor: '#ff7b3d',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  infoStepPill: {
    width: 18,
    height: 18,
    marginTop: 2,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 123, 61, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 84, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStepPillText: {
    color: '#ffd2ba',
    fontSize: 11,
    fontWeight: '700',
  },
  infoLine: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 21,
  },
  phoneFrameShell: {
    width: '100%',
    maxWidth: 440,
    aspectRatio: 430 / 900,
    position: 'relative',
    flexShrink: 0,
  },
  phoneOutlineGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: 'rgba(255, 115, 0, 0.55)',
    shadowColor: '#ff6b00',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 0,
  },
  phoneFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    padding: 8,
    backgroundColor: '#0f1115',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 18 },
    overflow: 'hidden',
    zIndex: 1,
  },
  phoneNotch: {
    position: 'absolute',
    top: 10,
    left: '50%',
    marginLeft: -62,
    width: 124,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#050608',
    zIndex: 3,
  },
  mobileWrapper: {
    flex: 1,
    width: '100%',
    borderRadius: 48,
    backgroundColor: 'rgba(10, 10, 10, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
});
