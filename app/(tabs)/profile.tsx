import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator, Platform, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Shield, CircleHelp as HelpCircle, LogOut, Trash2, Bell, Download, Share2, ChevronRight, Clock, Camera, Check } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccess } from '@/contexts/AccessContext';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '@/components/LanguageSelector';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuthContext } from '@/contexts/AuthContext';

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
  const { user, getUserParks, switchPark } = useAuthContext();
  const { logout } = useAccess();
  const { t, i18n } = useTranslation();
  const [ridesCount, setRidesCount] = useState<number>(0);
  const [photosCount, setPhotosCount] = useState<number>(0);
  const [memberSince, setMemberSince] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
  const [deleteCodeModalVisible, setDeleteCodeModalVisible] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteCodeType, setDeleteCodeType] = useState<'reauthentication' | 'email'>('reauthentication');
  const [userParks, setUserParks] = useState<{ park_id: string; name: string; slug: string }[]>([]);
  const [parkSwitchModalVisible, setParkSwitchModalVisible] = useState(false);
  const [switchingPark, setSwitchingPark] = useState(false);

  const resolveAndSetAvatarUrl = useCallback(async (avatarRef: string | null | undefined) => {
    if (!avatarRef) {
      setAvatarUrl(null);
      return;
    }

    if (avatarRef.startsWith('http')) {
      setAvatarUrl(`${avatarRef}${avatarRef.includes('?') ? '&' : '?'}t=${Date.now()}`);
      return;
    }

    const { data: signedData } = await supabase.storage
      .from('avatars')
      .createSignedUrl(avatarRef, 60 * 60 * 24 * 365);

    if (signedData?.signedUrl) {
      setAvatarUrl(`${signedData.signedUrl}&t=${Date.now()}`);
      return;
    }

    const { data: publicData } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatarRef);
    setAvatarUrl(`${publicData.publicUrl}?t=${Date.now()}`);
  }, []);

  useEffect(() => {
    resolveAndSetAvatarUrl(user?.avatar_url ?? null);
  }, [user?.avatar_url, resolveAndSetAvatarUrl]);

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
        const monthNames: { [key: string]: string[] } = {
          de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
          en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
          es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        };

        const currentLang = i18n.language || 'de';
        const months = monthNames[currentLang] || monthNames.de;
        const month = months[createdDate.getMonth()];
        const year = createdDate.getFullYear();
        setMemberSince(`${month} ${year}`);
      }

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching avatar:', profileError);
      } else {
        await resolveAndSetAvatarUrl(profileData?.avatar_url ?? null);
      }
    } catch (error) {
      console.error('Error fetching profile stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.created_at, i18n.language, resolveAndSetAvatarUrl]);

  const fetchUserParkMemberships = useCallback(async () => {
    if (!user?.id) {
      setUserParks([]);
      return;
    }

    try {
      const { data, success, error } = await getUserParks(user.id);
      if (!success) {
        console.error('Error fetching user park memberships:', error);
        return;
      }
      setUserParks(data || []);
    } catch (error) {
      console.error('Error fetching user park memberships:', error);
    }
  }, [getUserParks, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchProfileStats();
        fetchUserParkMemberships();
      }
    }, [user?.id, fetchProfileStats, fetchUserParkMemberships])
  );

  const activeParkName = userParks.find((park) => park.park_id === user?.park_id)?.name;

  const performLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await logout();
      router.replace('/auth');
    } catch (error: any) {
      console.error('Error during logout:', error);
      Alert.alert(t('common.error'), error?.message || t('auth.errors.authFailed'));
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${t('profile.logoutTitle')}\n\n${t('profile.logoutDescription')}`);
      if (!confirmed) return;
      await performLogout();
      return;
    }

    Alert.alert(
      t('profile.logoutTitle'),
      t('profile.logoutDescription'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('profile.logoutButton'),
          onPress: () => {
            void performLogout();
          },
          style: 'destructive',
        },
      ]
    );
  };

  const sendDeleteVerificationEmail = async () => {
    if (!user?.email) {
      throw new Error(t('profile.delete.noEmailOnAccount'));
    }

    const authApi = supabase.auth as any;
    const hasReauthenticate = typeof authApi.reauthenticate === 'function';

    if (hasReauthenticate) {
      const { error } = await authApi.reauthenticate();
      if (error) throw error;
      setDeleteCodeType('reauthentication');
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) throw error;
    setDeleteCodeType('email');
  };

  const handleRequestDeleteAccount = () => {
    if (!user?.id || deletingAccount) {
      Alert.alert(t('common.error'), t('profile.delete.loginRequired'));
      return;
    }
    setDeleteConfirmModalVisible(true);
  };

  const handleStartDeleteAccountFlow = async () => {
    if (!user?.id || deletingAccount) return;

    try {
      setDeletingAccount(true);
      setDeleteConfirmModalVisible(false);
      await sendDeleteVerificationEmail();
      setDeleteCode('');
      setDeleteCodeModalVisible(true);
      Alert.alert(
        t('profile.delete.requestConfirmedTitle'),
        t('profile.delete.requestConfirmedDescription', { email: user.email })
      );
    } catch (error: any) {
      console.error('Error requesting account deletion verification:', error);
      Alert.alert(t('common.error'), error?.message || t('profile.delete.sendVerificationFailed'));
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!user?.email || !deleteCode.trim() || deletingAccount) return;

    try {
      setDeletingAccount(true);

      const { error: otpError } = await supabase.auth.verifyOtp({
        email: user.email,
        token: deleteCode.trim(),
        type: deleteCodeType,
      } as any);

      if (otpError) throw otpError;

      const { error: deleteError } = await supabase.functions.invoke('delete-account', {
        body: {},
      });

      if (deleteError) throw deleteError;

      setDeleteCodeModalVisible(false);
      Alert.alert(t('profile.delete.deletedTitle'), t('profile.delete.deletedDescription'));
      await supabase.auth.signOut();
      await logout();
      router.replace('/auth');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert(t('common.error'), error?.message || t('profile.delete.deleteFailed'));
    } finally {
      setDeletingAccount(false);
    }
  };

  const handlePickProfileImage = async () => {
    if (!user?.id || uploadingAvatar) return;

    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t('common.error'), t('profile.avatar.permissionRequired'));
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const asset = result.assets[0];
      const fileExt = (asset.fileName?.split('.').pop() || asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      const mimeType = asset.mimeType || 'image/jpeg';

      // Immediate UI preview so users always see the selected image right away.
      setAvatarUrl(asset.uri);
      setUploadingAvatar(true);

      let uploadPayload: Blob | ArrayBuffer;

      if (Platform.OS === 'web' && (asset as any).file) {
        uploadPayload = (asset as any).file as Blob;
      } else {
        try {
          const fileResponse = await fetch(asset.uri);
          uploadPayload = await fileResponse.blob();
        } catch {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const binary = globalThis.atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          uploadPayload = bytes.buffer;
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, uploadPayload, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('users')
        .upsert(
          {
            id: user.id,
            email: user.email,
            avatar_url: filePath,
          } as any,
          { onConflict: 'id' },
        );

      if (updateError) throw updateError;

      await supabase.auth.updateUser({
        data: {
          avatar_url: filePath,
        },
      });

      const { data: refreshedProfile, error: refreshedProfileError } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (refreshedProfileError) throw refreshedProfileError;

      await resolveAndSetAvatarUrl(refreshedProfile?.avatar_url ?? filePath);
      Alert.alert(t('profile.avatar.savedTitle'));
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      Alert.alert(t('common.error'), error?.message || t('profile.avatar.saveFailed'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSwitchPark = async (parkId: string) => {
    if (!parkId || switchingPark) return;

    try {
      setSwitchingPark(true);
      const result = await switchPark(parkId);
      if (!result.success) {
        throw result.error || new Error('Parkwechsel fehlgeschlagen');
      }

      await fetchUserParkMemberships();
      setParkSwitchModalVisible(false);
      Alert.alert('Park gewechselt', 'Dein Konto ist jetzt auf den ausgewählten Park umgestellt.');
    } catch (error: any) {
      console.error('Error switching park:', error);
      Alert.alert(t('common.error'), error?.message || 'Parkwechsel fehlgeschlagen.');
    } finally {
      setSwitchingPark(false);
    }
  };

  const accountItems: MenuItem[] = [
    {
      icon: <User size={18} color="#ff6b35" />,
      title: t('profile.editProfile'),
      subtitle: t('profile.editProfileDescription'),
      onPress: () => router.push('/edit-profile'),
    },
    ...(userParks.length > 1
      ? [{
          icon: <User size={18} color="#ff6b35" />,
          title: 'Park wechseln',
          subtitle: activeParkName ? `Aktueller Park: ${activeParkName}` : 'Zwischen registrierten Parks wechseln',
          onPress: () => setParkSwitchModalVisible(true),
        } as MenuItem]
      : []),
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
      onPress: () => router.push('/notifications'),
    },
  ];

  const menuSections: MenuSection[] = [
    {
      title: t('profile.account'),
      items: accountItems,
    },
    {
      title: t('profile.data'),
      items: [
        {
          icon: <Download size={18} color="#ff6b35" />,
          title: t('profile.downloadAllPhotos'),
          subtitle: t('profile.downloadAllPhotosDescription'),
          onPress: () => router.push('/download-all'),
        },
        {
          icon: <Share2 size={18} color="#ff6b35" />,
          title: t('profile.sharePhotos'),
          subtitle: t('profile.sharePhotosDescription'),
          onPress: () => router.push('/(tabs)/gallery?openPurchased=1'),
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
          onPress: () => router.push('/privacy'),
        },
        {
          icon: <HelpCircle size={18} color="#ff6b35" />,
          title: t('profile.helpAndSupport'),
          subtitle: t('profile.helpAndSupportDescription'),
          onPress: () => router.push('/support'),
        },
      ],
    },
    {
      title: t('profile.demoAccess'),
      items: [
        {
          icon: <LogOut size={18} color="#ff4444" />,
          title: t('profile.logoutButton'),
          subtitle: t('profile.logoutSubtitle'),
          onPress: handleLogout,
          destructive: true,
        },
        {
          icon: <Trash2 size={18} color="#ff4444" />,
          title: deletingAccount ? t('profile.delete.deletingLabel') : t('profile.delete.menuTitle'),
          subtitle: t('profile.delete.menuSubtitle'),
          onPress: handleRequestDeleteAccount,
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
            <TouchableOpacity style={styles.avatar} activeOpacity={0.85} onPress={handlePickProfileImage}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <User size={40} color="#fff" />
              )}
              {uploadingAvatar && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Camera size={12} color="#fff" />
              </View>
            </TouchableOpacity>
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

      <Modal
        visible={parkSwitchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setParkSwitchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Park wechseln</Text>
            <Text style={styles.modalSubtitle}>
              Wähle den Park, für den du dich jetzt anmelden möchtest.
            </Text>

            {userParks.map((park) => (
              <TouchableOpacity
                key={park.park_id}
                style={styles.parkSwitchOption}
                disabled={switchingPark}
                onPress={() => handleSwitchPark(park.park_id)}
              >
                <Text style={styles.parkSwitchOptionText}>{park.name}</Text>
                {user?.park_id === park.park_id ? <Check size={18} color="#ff6b35" /> : null}
              </TouchableOpacity>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                disabled={switchingPark}
                onPress={() => setParkSwitchModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile.delete.confirmTitle')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('profile.delete.confirmDescription')}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalKeepButton}
                disabled={deletingAccount}
                onPress={() => setDeleteConfirmModalVisible(false)}
              >
                <Text style={styles.modalKeepButtonText}>{t('profile.delete.keepAccessButton')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteButton, deletingAccount && styles.disabledButton]}
                disabled={deletingAccount}
                onPress={handleStartDeleteAccountFlow}
              >
                <Text style={styles.modalDeleteButtonText}>{t('profile.delete.confirmDeleteButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteCodeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteCodeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile.delete.emailVerificationTitle')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('profile.delete.emailVerificationDescription')}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteCode}
              onChangeText={setDeleteCode}
              placeholder={t('profile.delete.codePlaceholder')}
              placeholderTextColor="#777"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              editable={!deletingAccount}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                disabled={deletingAccount}
                onPress={() => setDeleteCodeModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteButton, (!deleteCode.trim() || deletingAccount) && styles.disabledButton]}
                disabled={!deleteCode.trim() || deletingAccount}
                onPress={handleConfirmDeleteAccount}
              >
                <Text style={styles.modalDeleteButtonText}>
                  {deletingAccount ? t('profile.delete.deletingLabel') : t('profile.delete.finalDeleteButton')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -11,
    marginTop: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#b5b5b5',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#1b1b1b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#303030',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  parkSwitchOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  parkSwitchOptionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: '#cc2f2f',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalDeleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalKeepButton: {
    flex: 1,
    backgroundColor: '#3a1212',
    borderWidth: 1,
    borderColor: '#ff4757',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalKeepButtonText: {
    color: '#ff5a67',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
