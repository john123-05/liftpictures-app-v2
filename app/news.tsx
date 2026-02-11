import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, Star, Gift, Music, Utensils } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface NewsItem {
  id: string;
  title: string;
  date: string;
  category: 'attraction' | 'event' | 'food' | 'general';
  content: string;
  isNew?: boolean;
}

const getNewsItems = (t: any): NewsItem[] => [
  {
    id: '1',
    title: t('news.items.thunderMountain.title'),
    date: t('news.items.thunderMountain.date'),
    category: 'attraction',
    content: t('news.items.thunderMountain.content'),
    isNew: true,
  },
  {
    id: '2',
    title: t('news.items.summerFest.title'),
    date: t('news.items.summerFest.date'),
    category: 'event',
    content: t('news.items.summerFest.content'),
  },
  {
    id: '3',
    title: t('news.items.pizzaStation.title'),
    date: t('news.items.pizzaStation.date'),
    category: 'food',
    content: t('news.items.pizzaStation.content'),
  },
  {
    id: '4',
    title: t('news.items.familyDiscount.title'),
    date: t('news.items.familyDiscount.date'),
    category: 'general',
    content: t('news.items.familyDiscount.content'),
  },
  {
    id: '5',
    title: t('news.items.circus.title'),
    date: t('news.items.circus.date'),
    category: 'event',
    content: t('news.items.circus.content'),
  },
  {
    id: '6',
    title: t('news.items.newParking.title'),
    date: t('news.items.newParking.date'),
    category: 'general',
    content: t('news.items.newParking.content'),
  },
];


export default function NewsScreen() {
  const { t } = useTranslation();
  const newsItems = getNewsItems(t);

  const categoryNames = {
    attraction: t('news.categories.attraction'),
    event: t('news.categories.event'),
    food: t('news.categories.food'),
    general: t('news.categories.general'),
  };

  const categoryIcons = {
    attraction: <Star size={16} color="#ff6b35" />,
    event: <Calendar size={16} color="#00c851" />,
    food: <Utensils size={16} color="#2196f3" />,
    general: <Gift size={16} color="#ffc107" />,
  };

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('news.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {newsItems.map((item) => (
          <View key={item.id} style={styles.newsCard}>
            {item.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{t('news.badges.new')}</Text>
              </View>
            )}
            
            <View style={styles.newsHeader}>
              <View style={styles.categoryContainer}>
                {categoryIcons[item.category]}
                <Text style={styles.categoryText}>
                  {categoryNames[item.category]}
                </Text>
              </View>
              <Text style={styles.newsDate}>{item.date}</Text>
            </View>
            
            <Text style={styles.newsTitle}>{item.title}</Text>
            <Text style={styles.newsContent}>{item.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('news.footer')}
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
  newsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 6,
    fontWeight: '600',
  },
  newsDate: {
    fontSize: 12,
    color: '#666',
  },
  newsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  newsContent: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
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