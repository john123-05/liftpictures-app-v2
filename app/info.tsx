import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, Euro, Car, Wheelchair } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface InfoSection {
  id: string;
  title: string;
  items: string[];
}

const getInfoSections = (t: any): InfoSection[] => [
  {
    id: 'contact',
    title: t('info.contact.title'),
    items: [
      t('info.contact.parkName'),
      t('info.contact.address1'),
      t('info.contact.address2'),
      '',
      t('info.contact.hotline'),
      t('info.contact.email'),
      t('info.contact.website'),
      '',
      t('info.contact.emergency')
    ],
  },
  {
    id: 'hours',
    title: t('info.hours.title'),
    items: [
      t('info.hours.regular'),
      t('info.hours.weekdays'),
      t('info.hours.weekends'),
      t('info.hours.holidays'),
      '',
      t('info.hours.highSeason'),
      t('info.hours.highSeasonHours'),
      '',
      t('info.hours.winter'),
      t('info.hours.winterHours'),
      '',
      t('info.hours.lastEntry')
    ],
  },
  {
    id: 'prices',
    title: t('info.prices.title'),
    items: [
      t('info.prices.adults'),
      t('info.prices.children'),
      t('info.prices.seniors'),
      t('info.prices.toddlers'),
      '',
      t('info.prices.familyTickets'),
      t('info.prices.familyStandard'),
      t('info.prices.familyLarge'),
      t('info.prices.familyXXL'),
      '',
      t('info.prices.seasonPasses'),
      t('info.prices.seasonAdult'),
      t('info.prices.seasonChild')
    ],
  },
  {
    id: 'transport',
    title: t('info.transport.title'),
    items: [
      t('info.transport.car'),
      t('info.transport.highway'),
      t('info.transport.directions'),
      t('info.transport.gps'),
      '',
      t('info.transport.parking'),
      t('info.transport.parkingSpots'),
      t('info.transport.disabledParking'),
      t('info.transport.familyParking'),
      '',
      t('info.transport.publicTransport'),
      t('info.transport.bus'),
      t('info.transport.train'),
      t('info.transport.shuttle')
    ],
  },
  {
    id: 'accessibility',
    title: t('info.accessibility.title'),
    items: [
      t('info.accessibility.wheelchair'),
      t('info.accessibility.wheelchairPaths'),
      t('info.accessibility.wheelchairAttractions'),
      t('info.accessibility.wheelchairToilets'),
      t('info.accessibility.wheelchairRental'),
      '',
      t('info.accessibility.visuallyImpaired'),
      t('info.accessibility.guideDogs'),
      t('info.accessibility.tactileSystems'),
      t('info.accessibility.audioGuides'),
      '',
      t('info.accessibility.hearingImpaired'),
      t('info.accessibility.inductionLoops'),
      t('info.accessibility.signLanguage')
    ],
  },
  {
    id: 'rules',
    title: t('info.rules.title'),
    items: [
      t('info.rules.notAllowed'),
      t('info.rules.noFood'),
      t('info.rules.noGlass'),
      t('info.rules.noPets'),
      t('info.rules.noWeapons'),
      t('info.rules.noAlcohol'),
      t('info.rules.noDrones'),
      '',
      t('info.rules.photography'),
      t('info.rules.privateAllowed'),
      t('info.rules.commercialNo'),
      t('info.rules.noFlash'),
      '',
      t('info.rules.health'),
      t('info.rules.pacemaker'),
      t('info.rules.pregnancy'),
      t('info.rules.heightRequirement')
    ],
  },
];

export default function InfoScreen() {
  const { t } = useTranslation();
  const infoSections = getInfoSections(t);

  const handlePhonePress = () => {
    Linking.openURL('tel:+4980012345678');
  };

  const handleEmailPress = () => {
    Linking.openURL('mailto:info@adventureland-park.de');
  };

  const handleWebsitePress = () => {
    Linking.openURL('https://adventureland-park.de');
  };

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('info.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>{t('info.welcomeTitle')}</Text>
          <Text style={styles.welcomeSubtitle}>{t('info.welcomeSubtitle')}</Text>
          <Text style={styles.welcomeText}>
            {t('info.welcomeText')}
          </Text>
        </View>

        {infoSections.map((section) => (
          <View key={section.id} style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            
            <View style={styles.sectionContent}>
              {section.items.map((line, index) => (
                <Text 
                  key={index} 
                  style={[
                    styles.contentLine,
                    line.startsWith('REGULÄRE') || line.startsWith('HOCHSAISON') || line.startsWith('WINTERSAISON') ? styles.seasonHeader : null,
                    line.startsWith('FAMILIENTICKETS') || line.startsWith('SAISONKARTEN') || line.startsWith('PKW') || line.startsWith('PARKEN') || line.startsWith('ÖFFENTLICHE') ? styles.subSectionHeader : null,
                    line.startsWith('ROLLSTUHLGERECHTE') || line.startsWith('FÜR SEHBEHINDERTE') || line.startsWith('FÜR HÖRBEHINDERTE') || line.startsWith('NICHT GESTATTET') || line.startsWith('FOTOGRAFIEREN') || line.startsWith('GESUNDHEIT') ? styles.subSectionHeader : null,
                    line.includes('Hotline:') && styles.clickableText,
                    line.includes('E-Mail:') && styles.clickableText,
                    line.includes('Web:') && styles.clickableText
                  ]}
                  onPress={
                    line.includes('Hotline:') ? handlePhonePress :
                    line.includes('E-Mail:') ? handleEmailPress :
                    line.includes('Web:') ? handleWebsitePress : undefined
                  }
                >
                  {line}
                </Text>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.emergencyCard}>
          <Text style={styles.emergencyTitle}>{t('info.emergency.title')}</Text>
          <Text style={styles.emergencyText}>
            {t('info.emergency.description')}
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('tel:+4980012345911')}>
            <Text style={styles.emergencyNumber}>{t('info.emergency.number')}</Text>
          </TouchableOpacity>
          <Text style={styles.emergencyLocation}>
            {t('info.emergency.location')}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('info.footer')}
          </Text>
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#000',
    ...(Platform.OS === 'web' ? {
      maxWidth: 428,
      marginHorizontal: 'auto',
      width: '100%',
    } : {}),
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  welcomeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b35',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b35',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6b35',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionContent: {
    paddingLeft: 4,
  },
  contentLine: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 4,
  },
  seasonHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ff6b35',
    marginTop: 8,
    marginBottom: 8,
  },
  subSectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  clickableText: {
    color: '#ff6b35',
    textDecorationLine: 'underline',
  },
  emergencyCard: {
    backgroundColor: '#2a1a1a',
    borderColor: '#ff4757',
    borderWidth: 2,
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    alignItems: 'center',
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff4757',
    marginBottom: 8,
  },
  emergencyText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 12,
  },
  emergencyNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff4757',
    marginBottom: 12,
    textDecorationLine: 'underline',
  },
  emergencyLocation: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 100,
  },
  footerText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});