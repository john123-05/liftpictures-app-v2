import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Pizza, Beef, Coffee, IceCream } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface MenuItem {
  name: string;
  price: number;
  description?: string;
  isNew?: boolean;
  isPopular?: boolean;
}

interface MenuCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

const getMenuCategories = (t: any): MenuCategory[] => [
  {
    id: 'pizza',
    title: t('menu.categories.pizza'),
    icon: <Pizza size={24} color="#ff6b35" />,
    items: [
      { name: t('menu.items.pizzaMargherita.name'), price: 8.50, description: t('menu.items.pizzaMargherita.description') },
      { name: t('menu.items.pizzaSalami.name'), price: 9.90, description: t('menu.items.pizzaSalami.description') },
      { name: t('menu.items.pizzaQuattro.name'), price: 11.50, description: t('menu.items.pizzaQuattro.description') },
      { name: t('menu.items.pizzaThunder.name'), price: 12.90, description: t('menu.items.pizzaThunder.description'), isNew: true },
      { name: t('menu.items.pizzaVeggie.name'), price: 10.90, description: t('menu.items.pizzaVeggie.description') },
    ],
  },
  {
    id: 'burgers',
    title: t('menu.categories.burgers'),
    icon: <Beef size={24} color="#ff6b35" />,
    items: [
      { name: t('menu.items.classicBurger.name'), price: 12.90, description: t('menu.items.classicBurger.description'), isPopular: true },
      { name: t('menu.items.cheeseburger.name'), price: 14.50, description: t('menu.items.cheeseburger.description') },
      { name: t('menu.items.bbqBurger.name'), price: 15.90, description: t('menu.items.bbqBurger.description') },
      { name: t('menu.items.veggieBurger.name'), price: 11.90, description: t('menu.items.veggieBurger.description') },
      { name: t('menu.items.chickenBurger.name'), price: 13.50, description: t('menu.items.chickenBurger.description') },
    ],
  },
  {
    id: 'german',
    title: t('menu.categories.german'),
    icon: <Beef size={24} color="#ff6b35" />,
    items: [
      { name: t('menu.items.bratwurst.name'), price: 4.50, description: t('menu.items.bratwurst.description'), isPopular: true },
      { name: t('menu.items.currywurst.name'), price: 6.90, description: t('menu.items.currywurst.description') },
      { name: t('menu.items.thuringer.name'), price: 5.20, description: t('menu.items.thuringer.description') },
      { name: t('menu.items.weisswurst.name'), price: 5.80, description: t('menu.items.weisswurst.description') },
    ],
  },
  {
    id: 'healthy',
    title: t('menu.categories.healthy'),
    icon: <Coffee size={24} color="#ff6b35" />,
    items: [
      { name: t('menu.items.caesarSalad.name'), price: 9.90, description: t('menu.items.caesarSalad.description') },
      { name: t('menu.items.chickenWrap.name'), price: 7.50, description: t('menu.items.chickenWrap.description') },
      { name: t('menu.items.quinoaBowl.name'), price: 11.90, description: t('menu.items.quinoaBowl.description'), isNew: true },
      { name: t('menu.items.fruitSalad.name'), price: 4.90, description: t('menu.items.fruitSalad.description') },
      { name: t('menu.items.smoothieBowl.name'), price: 8.90, description: t('menu.items.smoothieBowl.description') },
    ],
  },
  {
    id: 'sweets',
    title: t('menu.categories.sweets'),
    icon: <IceCream size={24} color="#ff6b35" />,
    items: [
      { name: t('menu.items.softIceCream.name'), price: 2.80, description: t('menu.items.softIceCream.description') },
      { name: t('menu.items.churros.name'), price: 4.20, description: t('menu.items.churros.description'), isPopular: true },
      { name: t('menu.items.almonds.name'), price: 3.50, description: t('menu.items.almonds.description') },
      { name: t('menu.items.soda.name'), price: 2.50, description: t('menu.items.soda.description') },
      { name: t('menu.items.water.name'), price: 2.00, description: t('menu.items.water.description') },
      { name: t('menu.items.beer.name'), price: 3.80, description: t('menu.items.beer.description') },
      { name: t('menu.items.coffee.name'), price: 2.20, description: t('menu.items.coffee.description') },
      { name: t('menu.items.hotChocolate.name'), price: 3.20, description: t('menu.items.hotChocolate.description') },
    ],
  },
];

export default function MenuScreen() {
  const { t } = useTranslation();
  const menuCategories = getMenuCategories(t);

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('menu.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>{t('menu.intro.title')}</Text>
          <Text style={styles.introText}>
            {t('menu.intro.text')}
          </Text>
        </View>

        {menuCategories.map((category) => (
          <View key={category.id} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              {category.icon && category.icon}
              <Text style={styles.categoryTitle}>{category.title}</Text>
            </View>
            
            {category.items.map((item, index) => (
              <View key={index} style={styles.menuItem}>
                <View style={styles.itemInfo}>
                  <View style={styles.itemNameContainer}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.isNew && (
                      <View style={styles.newBadge}>
                        <Text style={styles.badgeText}>{t('menu.badges.new')}</Text>
                      </View>
                    )}
                    {item.isPopular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.badgeText}>{t('menu.badges.popular')}</Text>
                      </View>
                    )}
                  </View>
                  {item.description && (
                    <Text style={styles.itemDescription}>{item.description}</Text>
                  )}
                </View>
                <Text style={styles.itemPrice}>€{item.price.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>{t('menu.footer.title')}</Text>
          <Text style={styles.footerText}>{t('menu.footer.weekdays')}</Text>
          <Text style={styles.footerText}>{t('menu.footer.weekends')}</Text>
          <Text style={styles.footerText}>{t('menu.footer.summer')}</Text>
          <Text style={styles.footerNote}>
            {t('menu.footer.note')}
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
  introCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b35',
  },
  introTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  categoryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: '#ff6b35',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  popularBadge: {
    backgroundColor: '#00c851',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#000',
  },
  itemDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  footer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    marginBottom: 100,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  footerText: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 4,
  },
  footerNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});