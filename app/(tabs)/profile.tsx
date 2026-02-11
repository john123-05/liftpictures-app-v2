import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Settings, Shield, CircleHelp as HelpCircle, LogOut, Trash2, Bell, Download, Share2, ChevronRight, Clock } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { useAccess } from '@/contexts/AccessContext';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '@/components/LanguageSelector';
import { supabase } from '@/lib/supabase';

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { logout } = useAccess();
  const { t, i18n } = useTranslation();
  const [ridesCount, setRidesCount] = useState<number>(0);
  const [photosCount, setPhotosCount] = useState<number>(0);
  const [memberSince, setMemberSince] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchProfileStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { count: ridesTotal, error: ridesError } = await supabase
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (ridesError) {
        console.error('Error fetching rides count:', ridesError);
      } else {
        setRidesCount(ridesTotal ?? 0);
      }

      const { count: photosTotal, error: photosError } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id);

      if (photosError) {
        console.error('Error fetching photos count:', photosError);
      } else {
        setPhotosCount(photosTotal ?? 0);
      }

      if (user.created_at) {
        const createdDate = new Date(user.created_at);
        const formattedDate = formatMemberSince(createdDate);
        setMemberSince(formattedDate);
      }
    } catch (error) {
      console.error('Error fetching profile stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.created_at, i18n.language]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchProfileStats();
      }
    }, [user?.id, fetchProfileStats])
  );

  const formatMemberSince = (date: Date): string => {
    const monthNames: { [key: string]: string[] } = {
      de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
      en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    };

    const currentLang = i18n.language || 'de';
    const months = monthNames[currentLang] || monthNames.de;
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${month} ${year}`;
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout from Demo',
      'Are you sure you want to exit? You will need to enter the password again.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            await logout();
          },
          style: 'destructive',
        },
      ]
    );
  };

  const menuSections: MenuSection[] = [
    {
      title: t('profile.account'),
      items: [
        {
          icon: <User size={18} color="#ff6b35" />,
          title: t('profile.editProfile'),
          subtitle: t('profile.editProfileDescription'),
          onPress: () => Alert.alert(t('common.info'), t('profile.comingSoon')),
        },
        {
          icon: <Clock size={18} color="#ff6b35" />,
          title: t('rides.myRides'),
          subtitle: t('dashboard.myRidesToday'),
          onPress: () => router.push('/rides'),
        },
        {
          icon: <Bell size={18} color="#ff6b35" />,
          title: t('profile.notifications'),
          subtitle: t('profile.notificationsDescription'),
          onPress: () => Alert.alert(t('common.info'), t('profile.comingSoon')),
        },
      ],
    },
    {
      title: t('profile.data'),
      items: [
        {
          icon: <Download size={18} color="#ff6b35" />,
          title: t('profile.downloadAllPhotos'),
          subtitle: t('profile.downloadAllPhotosDescription'),
          onPress: () => Alert.alert(t('common.info'), t('profile.downloadStarted')),
        },
        {
          icon: <Share2 size={18} color="#ff6b35" />,
          title: t('profile.sharePhotos'),
          subtitle: t('profile.sharePhotosDescription'),
          onPress: () => Alert.alert(t('common.info'), t('profile.comingSoon')),
        },
      ],
    },
    {
      title: t('profile.legal'),
      items: [
        {
          icon: <Shield size={18} color="#ff6b35" />,
          title: t('profile.privacy'),
          subtitle: t('profile.privacyDescription'),
          onPress: () => Alert.alert(t('common.info'), t('profile.comingSoon')),
        },
        {
          icon: <HelpCircle size={18} color="#ff6b35" />,
          title: t('profile.helpAndSupport'),
          subtitle: t('profile.helpAndSupportDescription'),
          onPress: () => Alert.alert(t('common.info'), t('profile.comingSoon')),
        },
      ],
    },
    {
      title: 'Demo Access',
      items: [
        {
          icon: <LogOut size={18} color="#ff4444" />,
          title: 'Logout',
          subtitle: 'Exit the demo site',
          onPress: handleLogout,
          destructive: true,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <Text style={styles.title}>{t('profile.title')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <LinearGradient
            colors={['#ff6b35', '#ff8c42']}
            style={styles.profileGradient}
          >
            <View style={styles.avatar}>
              <User size={40} color="#fff" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.vorname} {user?.nachname}
              </Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </LinearGradient>

          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{loading ? '...' : ridesCount}</Text>
              <Text style={styles.statLabel}>{t('profile.rides')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{loading ? '...' : photosCount}</Text>
              <Text style={styles.statLabel}>{t('cart.photos')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{loading ? '...' : memberSince}</Text>
              <Text style={styles.statLabel}>{t('profile.memberSince')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuSection}>
          <LanguageSelector />
        </View>

        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.menuItem,
                    itemIndex === section.items.length - 1 && styles.lastMenuItem
                  ]}
                  onPress={item.onPress}
                >
                  <View style={styles.menuItemLeft}>
                    {item.icon}
                    <View style={styles.menuItemText}>
                      <Text style={[
                        styles.menuItemTitle,
                        item.destructive && styles.destructiveText
                      ]}>
                        {item.title}
                      </Text>
                      {item.subtitle && (
                        <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                      )}
                    </View>
                  </View>
                  <ChevronRight size={14} color="#666" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('profile.version')}
          </Text>
          <Text style={styles.footerText}>
            {t('profile.copyright')}
          </Text>
        </View>
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
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  notLoggedIn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  notLoggedInText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  profileCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 32,
    overflow: 'hidden',
  },
  profileGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  profileStats: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 16,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: 10,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  destructiveText: {
    color: '#ff4757',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 100,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
});