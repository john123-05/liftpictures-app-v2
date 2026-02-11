import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CircleHelp, Mail, MessageCircle } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function SupportScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('support.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <CircleHelp size={24} color="#ff8c42" />
          <Text style={styles.heroTitle}>{t('support.heroTitle')}</Text>
          <Text style={styles.heroText}>
            {t('support.heroText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('support.faqTitle')}</Text>

          <View style={styles.faqItem}>
            <Text style={styles.question}>{t('support.faq1Question')}</Text>
            <Text style={styles.answer}>
              {t('support.faq1Answer')}
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>{t('support.faq2Question')}</Text>
            <Text style={styles.answer}>
              {t('support.faq2Answer')}
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>{t('support.faq3Question')}</Text>
            <Text style={styles.answer}>
              {t('support.faq3Answer')}
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>{t('support.faq4Question')}</Text>
            <Text style={styles.answer}>
              {t('support.faq4Answer')}
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.question}>{t('support.faq5Question')}</Text>
            <Text style={styles.answer}>
              {t('support.faq5Answer')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('support.contactTitle')}</Text>
          <View style={styles.contactRow}>
            <Mail size={16} color="#ff8c42" />
            <Text style={styles.contactText}>support@liftpictures.app</Text>
          </View>
          <View style={styles.contactRow}>
            <MessageCircle size={16} color="#ff8c42" />
            <Text style={styles.contactText}>{t('support.responseTime')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('support.reportProblemTitle')}</Text>
          <Text style={styles.answer}>
            {t('support.reportProblemText')}
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
    marginBottom: 6,
  },
  heroText: {
    color: '#c8c8c8',
    fontSize: 13,
    lineHeight: 19,
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
    marginBottom: 10,
  },
  faqItem: {
    marginBottom: 12,
  },
  question: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  answer: {
    color: '#c8c8c8',
    fontSize: 13,
    lineHeight: 19,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  contactText: {
    color: '#c8c8c8',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  bottomSpacer: {
    height: 30,
  },
});
