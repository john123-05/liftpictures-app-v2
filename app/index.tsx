import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image as RNImage, Platform, ImageBackground, useWindowDimensions, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Image, ShoppingCart, Bell } from 'lucide-react-native';

const ORANGE = '#FF8C42';

const content = {
  de: {
    headline: 'Liftpictures App – Fotos, Tickets & Erlebnisse direkt auf dem Smartphone',
    subline: 'Fotos kaufen, Erlebnisse speichern, Parkbesuche verlängern.',
    ctaPrimary: 'Demo App testen',
    ctaSecondary: 'Kontakt aufnehmen',
    features: {
      photos: {
        title: 'Automatische Fotos',
        text: 'Automatische Foto- & Videoaufnahmen an Attraktionen',
      },
      gallery: {
        title: 'Galerie & Account',
        text: 'Alle Fotos in einem persönlichen Account',
      },
      purchase: {
        title: 'Einfacher Kauf',
        text: 'Fotoverkauf, Fotopass & Tickets direkt in der App',
      },
      marketing: {
        title: 'Marketing & Push',
        text: 'Push-Benachrichtigungen & Wiederbesuche',
      },
    },
    finalCta: 'Bereit, die Demo zu testen?',
  },
  en: {
    headline: 'Liftpictures App – Photos, Tickets & Experiences on your Smartphone',
    subline: 'Buy photos, save memories, extend the park experience.',
    ctaPrimary: 'Test demo app',
    ctaSecondary: 'Contact us',
    features: {
      photos: {
        title: 'Automatic Photos',
        text: 'Automatic photos & videos at attractions',
      },
      gallery: {
        title: 'Gallery & Account',
        text: 'All photos in one personal account',
      },
      purchase: {
        title: 'Easy Purchase',
        text: 'Photo sales, photo pass & tickets in-app',
      },
      marketing: {
        title: 'Marketing & Push',
        text: 'Push notifications & repeat visits',
      },
    },
    finalCta: 'Ready to try the demo?',
  },
  es: {
    headline: 'Liftpictures App – Fotos, entradas y experiencias en tu móvil',
    subline: 'Compra fotos, guarda recuerdos y prolonga la experiencia.',
    ctaPrimary: 'Probar demo',
    ctaSecondary: 'Contacto',
    features: {
      photos: {
        title: 'Fotos Automáticas',
        text: 'Fotos y vídeos automáticos en atracciones',
      },
      gallery: {
        title: 'Galería y Cuenta',
        text: 'Todas las fotos en una cuenta personal',
      },
      purchase: {
        title: 'Compra Fácil',
        text: 'Venta de fotos, pases y entradas en la app',
      },
      marketing: {
        title: 'Marketing y Push',
        text: 'Notificaciones push y visitas recurrentes',
      },
    },
    finalCta: '¿Listo para probar la demo?',
  },
};

export default function LandingPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'de' | 'en' | 'es'>('de');
  const t = content[lang];
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const handleEnterDemo = () => {
    router.push('/auth');
  };

  const handleContact = () => {
    const contactUrls = {
      de: 'https://www.liftpictures.com/kontakt',
      en: 'https://www.liftpictures.com/en/kontakt',
      es: 'https://www.liftpictures.com/es/kontakt',
    };
    Linking.openURL(contactUrls[lang]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.navbar}>
        <RNImage
          source={{ uri: 'https://xcrxltiiovpoladpaewd.supabase.co/storage/v1/object/public/test/logo_70x30.bmp' }}
          style={styles.navbarLogo}
          resizeMode="contain"
        />
        <View style={styles.languageSwitcher}>
          <TouchableOpacity onPress={() => setLang('de')} style={[styles.langButton, lang === 'de' && styles.langButtonActive]}>
            <Text style={[styles.langText, lang === 'de' && styles.langTextActive]}>DE</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLang('en')} style={[styles.langButton, lang === 'en' && styles.langButtonActive]}>
            <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>EN</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLang('es')} style={[styles.langButton, lang === 'es' && styles.langButtonActive]}>
            <Text style={[styles.langText, lang === 'es' && styles.langTextActive]}>ES</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ImageBackground
        source={{
          uri: isMobile
            ? 'https://xcrxltiiovpoladpaewd.supabase.co/storage/v1/object/public/test/liftpicturesattraction.jpg'
            : 'https://xcrxltiiovpoladpaewd.supabase.co/storage/v1/object/public/test/liftpictures.jpg'
        }}
        style={styles.heroSection}
        resizeMode="cover"
      >
        <View style={styles.heroOverlay}>
          <View style={styles.heroContent}>
            <RNImage
              source={{ uri: 'https://xcrxltiiovpoladpaewd.supabase.co/storage/v1/object/public/test/image.png' }}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <Text style={styles.headline}>{t.headline}</Text>
            <Text style={styles.subline}>{t.subline}</Text>

            <View style={styles.ctaButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleEnterDemo}>
                <Text style={styles.primaryButtonText}>{t.ctaPrimary}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleContact}>
                <Text style={styles.secondaryButtonText}>{t.ctaSecondary}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.featuresSection}>
        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <Camera size={40} color={ORANGE} strokeWidth={2} />
            <Text style={styles.featureTitle}>{t.features.photos.title}</Text>
            <Text style={styles.featureText}>{t.features.photos.text}</Text>
          </View>

          <View style={styles.featureCard}>
            <Image size={40} color={ORANGE} strokeWidth={2} />
            <Text style={styles.featureTitle}>{t.features.gallery.title}</Text>
            <Text style={styles.featureText}>{t.features.gallery.text}</Text>
          </View>

          <View style={styles.featureCard}>
            <ShoppingCart size={40} color={ORANGE} strokeWidth={2} />
            <Text style={styles.featureTitle}>{t.features.purchase.title}</Text>
            <Text style={styles.featureText}>{t.features.purchase.text}</Text>
          </View>

          <View style={styles.featureCard}>
            <Bell size={40} color={ORANGE} strokeWidth={2} />
            <Text style={styles.featureTitle}>{t.features.marketing.title}</Text>
            <Text style={styles.featureText}>{t.features.marketing.text}</Text>
          </View>
        </View>
      </View>

      <View style={styles.visualSection}>
        <View style={styles.imagesContainer}>
          <View style={styles.imageWrapper}>
            <RNImage
              source={{ uri: 'https://xcrxltiiovpoladpaewd.supabase.co/storage/v1/object/public/test/mobile.png' }}
              style={styles.screenshot}
              resizeMode="contain"
            />
          </View>
          <View style={styles.imageWrapper}>
            <RNImage
              source={{ uri: 'https://xcrxltiiovpoladpaewd.supabase.co/storage/v1/object/public/test/Bildschirmfoto%202026-01-23%20um%2009.02.55.png' }}
              style={styles.screenshot}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>

      <View style={styles.finalCtaSection}>
        <Text style={styles.finalCtaText}>{t.finalCta}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleEnterDemo}>
          <Text style={styles.primaryButtonText}>{t.ctaPrimary}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
    backgroundColor: '#1a1a1a',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  navbarLogo: {
    width: 140,
    height: 60,
  },
  languageSwitcher: {
    flexDirection: 'row',
    gap: 8,
  },
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  langButtonActive: {
    backgroundColor: ORANGE,
  },
  langText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  langTextActive: {
    color: '#fff',
  },
  heroSection: {
    width: '100%',
    minHeight: 600,
  },
  heroOverlay: {
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    minHeight: 600,
    justifyContent: 'center',
    paddingTop: 100,
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
    maxWidth: 1200,
    width: '100%',
  },
  appIcon: {
    width: 180,
    height: 180,
    marginBottom: 32,
  },
  headline: {
    fontSize: Platform.OS === 'web' ? 48 : 36,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: Platform.OS === 'web' ? 56 : 44,
    maxWidth: 900,
  },
  subline: {
    fontSize: Platform.OS === 'web' ? 20 : 18,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 40,
    maxWidth: 800,
  },
  ctaButtons: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: ORANGE,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#444',
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  featuresSection: {
    backgroundColor: '#0f0f0f',
    paddingVertical: 80,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    justifyContent: 'center',
    maxWidth: 1200,
  },
  featureCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    flex: 1,
    minWidth: 250,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#aaa',
    lineHeight: 22,
  },
  visualSection: {
    paddingVertical: 80,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 40,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 1200,
  },
  imageWrapper: {
    flex: 1,
    minWidth: 350,
    maxWidth: 500,
  },
  screenshot: {
    width: '100%',
    height: 500,
    borderRadius: 12,
  },
  finalCtaSection: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
    backgroundColor: '#0f0f0f',
    width: '100%',
  },
  finalCtaText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 32,
    textAlign: 'center',
  },
});
