import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('privacy.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Shield size={24} color="#ff8c42" />
          <Text style={styles.heroTitle}>{t('privacy.heroTitle')}</Text>
          <Text style={styles.heroText}>{t('privacy.heroDate')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.section1Title')}</Text>
          <Text style={styles.text}>
            {t('privacy.section1Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.section2Title')}</Text>
          <Text style={styles.text}>{t('privacy.section2Intro')}</Text>
          <Text style={styles.bullet}>{t('privacy.section2Bullet1')}</Text>
          <Text style={styles.bullet}>{t('privacy.section2Bullet2')}</Text>
          <Text style={styles.bullet}>{t('privacy.section2Bullet3')}</Text>
          <Text style={styles.bullet}>{t('privacy.section2Bullet4')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.section3Title')}</Text>
          <Text style={styles.bullet}>{t('privacy.section3Bullet1')}</Text>
          <Text style={styles.bullet}>{t('privacy.section3Bullet2')}</Text>
          <Text style={styles.bullet}>{t('privacy.section3Bullet3')}</Text>
          <Text style={styles.bullet}>{t('privacy.section3Bullet4')}</Text>
          <Text style={styles.bullet}>{t('privacy.section3Bullet5')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.section4Title')}</Text>
          <Text style={styles.text}>
            {t('privacy.section4Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.section5Title')}</Text>
          <Text style={styles.text}>
            {t('privacy.section5Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.section6Title')}</Text>
          <Text style={styles.text}>
            {t('privacy.section6Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.section7Title')}</Text>
          <Text style={styles.bullet}>{t('privacy.section7Bullet1')}</Text>
          <Text style={styles.bullet}>{t('privacy.section7Bullet2')}</Text>
          <Text style={styles.bullet}>{t('privacy.section7Bullet3')}</Text>
          <Text style={styles.bullet}>{t('privacy.section7Bullet4')}</Text>
          <Text style={styles.bullet}>{t('privacy.section7Bullet5')}</Text>
          <Text style={styles.text}>{t('privacy.section7Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.section8Title')}</Text>
          <Text style={styles.text}>
            {t('privacy.section8Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.section9Title')}</Text>
          <Text style={styles.text}>
            {t('privacy.section9Text')}
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroCard: {
    marginTop: 6,
    marginBottom: 14,
    backgroundColor: '#171717',
    borderRadius: 14,
    padding: 14,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  heroText: {
    color: '#999',
    fontSize: 12,
  },
  section: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  text: {
    color: '#c8c8c8',
    fontSize: 13,
    lineHeight: 19,
  },
  bullet: {
    color: '#c8c8c8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  bottomSpacer: {
    height: 30,
  },
});
