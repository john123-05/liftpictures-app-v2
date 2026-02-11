import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Zap, Users, TreePine, Utensils, ShoppingBag, Heart, Camera, Car } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface MapArea {
  id: string;
  title: string;
  color: string;
  icon: React.ReactNode;
  description: string;
  attractions: string[];
}

interface Service {
  name: string;
  location: string;
  icon: React.ReactNode;
}

const getMapAreas = (t: any): MapArea[] => [
  {
    id: 'thrill',
    title: t('map.areas.thrill.title'),
    color: '#ff6b35',
    icon: <Zap size={24} color="#ff6b35" />,
    description: t('map.areas.thrill.description'),
    attractions: [
      t('map.areas.thrill.attractions.thunderMountain'),
      t('map.areas.thrill.attractions.wildEagle'),
      t('map.areas.thrill.attractions.speedRacer'),
      t('map.areas.thrill.attractions.tornado'),
      t('map.areas.thrill.attractions.skyShot'),
      t('map.areas.thrill.attractions.ghost')
    ],
  },
  {
    id: 'family',
    title: t('map.areas.family.title'),
    color: '#00c851',
    icon: <Users size={24} color="#00c851" />,
    description: t('map.areas.family.description'),
    attractions: [
      t('map.areas.family.attractions.carousel'),
      t('map.areas.family.attractions.bumperCars'),
      t('map.areas.family.attractions.miniCoaster'),
      t('map.areas.family.attractions.ferrisWheel'),
      t('map.areas.family.attractions.waterBattle'),
      t('map.areas.family.attractions.train'),
      t('map.areas.family.attractions.amphitheater')
    ],
  },
  {
    id: 'adventure',
    title: t('map.areas.adventure.title'),
    color: '#2196f3',
    icon: <TreePine size={24} color="#2196f3" />,
    description: t('map.areas.adventure.description'),
    attractions: [
      t('map.areas.adventure.attractions.climbingPark'),
      t('map.areas.adventure.attractions.summerToboggan'),
      t('map.areas.adventure.attractions.playground'),
      t('map.areas.adventure.attractions.pettingZoo'),
      t('map.areas.adventure.attractions.naturePath'),
      t('map.areas.adventure.attractions.archery'),
      t('map.areas.adventure.attractions.fishing')
    ],
  },
];

const getRestaurants = (t: any): Service[] => [
  { name: t('map.restaurants.mamaMia'), location: t('map.locations.thrillZone'), icon: <Utensils size={16} color="#ff6b35" /> },
  { name: t('map.restaurants.bigBite'), location: t('map.locations.familyArea'), icon: <Utensils size={16} color="#ff6b35" /> },
  { name: t('map.restaurants.bratwurst'), location: t('map.locations.adventureLand'), icon: <Utensils size={16} color="#ff6b35" /> },
  { name: t('map.restaurants.healthy'), location: t('map.locations.familyArea'), icon: <Utensils size={16} color="#ff6b35" /> },
  { name: t('map.restaurants.cafe'), location: t('map.locations.mainEntrance'), icon: <Utensils size={16} color="#ff6b35" /> },
  { name: t('map.restaurants.biergarten'), location: t('map.locations.adventureLand'), icon: <Utensils size={16} color="#ff6b35" /> },
];

const getServices = (t: any): Service[] => [
  { name: t('map.services.firstAidMain'), location: t('map.locations.familyArea'), icon: <Heart size={16} color="#ff4757" /> },
  { name: t('map.services.firstAidThrill'), location: t('map.locations.thrillZone'), icon: <Heart size={16} color="#ff4757" /> },
  { name: t('map.services.babyChanging'), location: t('map.locations.allAreas'), icon: <Heart size={16} color="#ff4757" /> },
  { name: t('map.services.souvenirShop'), location: t('map.locations.mainEntrance'), icon: <ShoppingBag size={16} color="#ffc107" /> },
  { name: t('map.services.photoShop'), location: t('map.locations.familyArea'), icon: <Camera size={16} color="#ffc107" /> },
  { name: t('map.services.wheelchairRental'), location: t('map.locations.mainEntrance'), icon: <Car size={16} color="#ffc107" /> },
  { name: t('map.services.strollerRental'), location: t('map.locations.mainEntrance'), icon: <Car size={16} color="#ffc107" /> },
  { name: t('map.services.lostAndFound'), location: t('map.locations.mainEntrance'), icon: <ShoppingBag size={16} color="#ffc107" /> },
];

const getShowTimes = (t: any) => [
  { name: t('map.shows.circus.name'), times: ['14:00', '16:30'], location: t('map.shows.circus.location') },
  { name: t('map.shows.fairytale.name'), times: ['11:00', '15:00'], location: t('map.shows.fairytale.location') },
  { name: t('map.shows.magic.name'), times: ['13:00', '17:00'], location: t('map.shows.magic.location') },
  { name: t('map.shows.safari.name'), times: ['12:00', '16:00'], location: t('map.shows.safari.location') },
];

export default function MapScreen() {
  const { t } = useTranslation();
  const mapAreas = getMapAreas(t);
  const restaurants = getRestaurants(t);
  const services = getServices(t);
  const showTimes = getShowTimes(t);

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('map.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>{t('map.overview.title')}</Text>
          <Text style={styles.overviewText}>
            {t('map.overview.text')}
          </Text>
          <View style={styles.parkStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>32</Text>
              <Text style={styles.statLabel}>{t('map.overview.attractions')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>6</Text>
              <Text style={styles.statLabel}>{t('map.overview.restaurants')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>85</Text>
              <Text style={styles.statLabel}>{t('map.overview.hectares')}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('map.sections.parkAreas')}</Text>

        {mapAreas.map((area) => (
          <View key={area.id} style={[styles.areaCard, { borderLeftColor: area.color }]}>
            <View style={styles.areaHeader}>
              {area.icon && area.icon}
              <Text style={styles.areaTitle}>{area.title}</Text>
            </View>
            <Text style={styles.areaDescription}>{area.description}</Text>
            
            <View style={styles.attractionsList}>
              {area.attractions.map((attraction, index) => (
                <Text key={index} style={styles.attractionItem}>
                  {attraction}
                </Text>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>{t('map.sections.gastronomy')}</Text>
        <View style={styles.serviceCard}>
          {restaurants.map((restaurant, index) => (
            <View key={index} style={styles.serviceItem}>
              {restaurant.icon}
              <Text style={styles.serviceName}>{restaurant.name}</Text>
              <Text style={styles.serviceLocation}>📍 {restaurant.location}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('map.sections.services')}</Text>
        <View style={styles.serviceCard}>
          {services.map((service, index) => (
            <View key={index} style={styles.serviceItem}>
              {service.icon}
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceLocation}>📍 {service.location}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('map.sections.shows')}</Text>
        <View style={styles.showCard}>
          {showTimes.map((show, index) => (
            <View key={index} style={styles.showItem}>
              <Text style={styles.showName}>{show.name}</Text>
              <Text style={styles.showLocation}>📍 {show.location}</Text>
              <View style={styles.showTimes}>
                {show.times.map((time, timeIndex) => (
                  <View key={timeIndex} style={styles.timeChip}>
                    <Text style={styles.timeText}>{time}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>{t('map.tips.title')}</Text>
          <Text style={styles.tipText}>
            {t('map.tips.tip1')}{'\n'}
            {t('map.tips.tip2')}{'\n'}
            {t('map.tips.tip3')}{'\n'}
            {t('map.tips.tip4')}{'\n'}
            {t('map.tips.tip5')}{'\n'}
            {t('map.tips.tip6')}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('map.footer')}
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
  overviewCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b35',
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  overviewText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 16,
  },
  parkStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  areaCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  areaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  areaDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  attractionsList: {
    paddingLeft: 8,
  },
  attractionItem: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
    marginBottom: 4,
  },
  serviceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  serviceName: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  serviceLocation: {
    fontSize: 12,
    color: '#999',
  },
  showCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  showItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  showName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  showLocation: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  showTimes: {
    flexDirection: 'row',
  },
  timeChip: {
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  tipCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00c851',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00c851',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 100,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});