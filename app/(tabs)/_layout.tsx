import { Tabs } from 'expo-router';
import { QrCode, Image, Trophy, User, ShoppingCart } from 'lucide-react-native';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useCart } from '@/contexts/CartContext';
import { useTranslation } from 'react-i18next';

function CartTabIcon({ size, color }: { size: number; color: string }) {
  const { itemCount } = useCart();

  return (
    <View style={{ position: 'relative' }}>
      <ShoppingCart size={20} color={color} />
      {itemCount > 0 && (
        <View style={{
          position: 'absolute',
          top: -8,
          right: -8,
          backgroundColor: '#ff6b35',
          borderRadius: 10,
          minWidth: 20,
          height: 20,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text style={{
            color: '#000',
            fontSize: 12,
            fontWeight: 'bold',
          }}>
            {itemCount > 99 ? '99+' : itemCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <View style={styles.mobileContainer}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#ff6b35',
          tabBarInactiveTintColor: '#666',
          tabBarStyle: {
            backgroundColor: '#000',
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 95 : 85,
            paddingBottom: Platform.OS === 'ios' ? 30 : 20,
            paddingTop: 15,
            paddingHorizontal: 4,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
            marginBottom: 0,
            textAlign: 'center',
          },
          tabBarIconStyle: {
            marginTop: 2,
            marginBottom: 2,
          },
          tabBarItemStyle: {
            paddingHorizontal: 2,
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
            minHeight: 60,
          },
          tabBarLabelPosition: 'below-icon',
          tabBarAllowFontScaling: false,
          tabBarHideOnKeyboard: true,
        }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ size, color }) => (
            <QrCode size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: t('tabs.gallery'),
          tabBarIcon: ({ size, color }) => (
            <Image size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabs.cart'),
          tabBarIcon: ({ size, color }) => (
            <CartTabIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ size, color }) => (
            <Trophy size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ size, color }) => (
            <User size={20} color={color} />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileContainer: {
    flex: 1,
    backgroundColor: '#000',
    ...(Platform.OS === 'web' ? {
      maxWidth: 428,
      marginHorizontal: 'auto',
      width: '100%',
    } : {}),
  },
});