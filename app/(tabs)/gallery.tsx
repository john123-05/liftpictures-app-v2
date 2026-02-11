import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Platform, Alert, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, ShoppingCart, Plus, AlertCircle, X, ChevronRight, Calendar, Clock, Package, Download, Share2, Check } from 'lucide-react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { StatusBar } from 'expo-status-bar';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import RideCaptureModal from '@/components/RideCaptureModal';

interface Photo {
  id: string;
  timestamp: string;
  url: string;
  isFavorite: boolean;
  isPurchased: boolean;
  price: number;
  track: string;
  speed: number;
  storage_bucket: string;
  storage_path: string;
  captured_at: string;
}

interface Ride {
  id: string;
  ride_at: string;
  source: string;
}

interface DBPhoto {
  id: string;
  storage_bucket: string;
  storage_path: string;
  captured_at: string;
  created_at: string;
  speed_kmh: number | null;
  purchases: Array<{ status: string }>;
}

type SocialPlatform = 'instagram' | 'facebook' | 'x' | 'tiktok';

const parseSpeedFromStoragePath = (storagePath: string): number => {
  if (!storagePath) return 0;

  const fileName = storagePath.split('/').pop() || storagePath;
  const fileStem = fileName.replace(/\.[^.]+$/, '');
  const digits = fileStem.replace(/\D/g, '');

  if (digits.length < 4) return 0;

  const lastFourDigits = digits.slice(-4);
  const parsed = Number.parseInt(lastFourDigits, 10);

  if (Number.isNaN(parsed)) return 0;

  return parsed / 100;
};

const resolvePhotoSpeed = (speedFromDb: number | string | null | undefined, storagePath: string): number => {
  const numericDbSpeed = typeof speedFromDb === 'string' ? Number.parseFloat(speedFromDb) : (speedFromDb ?? 0);
  if (Number.isFinite(numericDbSpeed) && numericDbSpeed > 0) {
    return numericDbSpeed;
  }

  return parseSpeedFromStoragePath(storagePath);
};

export default function GalleryScreen() {
  const params = useLocalSearchParams<{ openPurchased?: string }>();
  const { t } = useTranslation();
  const [rides, setRides] = useState<Ride[]>([]);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRideCaptureModal, setShowRideCaptureModal] = useState(false);
  const [showPurchasedImages, setShowPurchasedImages] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [purchasedPhotos, setPurchasedPhotos] = useState<Photo[]>([]);
  const [selectedPurchasedPhoto, setSelectedPurchasedPhoto] = useState<Photo | null>(null);
  const [showSocialShareOptions, setShowSocialShareOptions] = useState(false);
  const [favoritePhotoIds, setFavoritePhotoIds] = useState<string[]>([]);
  const [shareSelectionMode, setShareSelectionMode] = useState(false);
  const [selectedSharePhotoIds, setSelectedSharePhotoIds] = useState<string[]>([]);
  const [sharePhotoIds, setSharePhotoIds] = useState<string[]>([]);
  const [loadingPurchased, setLoadingPurchased] = useState(false);
  const { user } = useAuthContext();
  const { addToCart, items: cartItems } = useCart();
  const cartPhotoIds = useMemo(() => new Set(cartItems.map((item) => item.photoId)), [cartItems]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
      fetchRides();
    } else {
      setFavoritePhotoIds([]);
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchFavorites();
        fetchRides();
        if (showPurchasedImages) {
          fetchPurchasedPhotos();
        }
      }
    }, [user, showPurchasedImages])
  );

  useEffect(() => {
    const favoriteSet = new Set(favoritePhotoIds);

    setPhotos((prevPhotos) => prevPhotos.map((photo) => ({
      ...photo,
      isFavorite: favoriteSet.has(photo.id),
    })));
    setAllPhotos((prevAllPhotos) => prevAllPhotos.map((photo) => ({
      ...photo,
      isFavorite: favoriteSet.has(photo.id),
    })));
    setPurchasedPhotos((prevPurchasedPhotos) => prevPurchasedPhotos.map((photo) => ({
      ...photo,
      isFavorite: favoriteSet.has(photo.id),
    })));
  }, [favoritePhotoIds]);

  const fetchFavorites = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('photo_id')
        .eq('user_id', user.id);

      if (error) throw error;

      setFavoritePhotoIds((data || []).map((row: { photo_id: string }) => row.photo_id));
    } catch (error: any) {
      console.error('Error fetching favorites:', error);
    }
  };

  const fetchPurchasedPhotos = async () => {
    if (!user) return;

    setLoadingPurchased(true);
    try {
      const { data, error } = await supabase
        .from('unlocked_photos')
        .select(`
          photo_id,
          unlocked_at,
          photos (
            id,
            storage_bucket,
            storage_path,
            captured_at,
            speed_kmh
          )
        `)
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const favoriteSet = new Set(favoritePhotoIds);
        const formattedPhotos: Photo[] = await Promise.all(
          data
            .filter((item: any) => item.photos)
            .map(async (item: any) => {
              const photo = item.photos;
              const capturedTime = new Date(photo.captured_at);

              const { data: signedUrlData, error: urlError } = await supabase.storage
                .from(photo.storage_bucket)
                .createSignedUrl(photo.storage_path, 3600);

              const photoUrl = urlError || !signedUrlData
                ? supabase.storage.from(photo.storage_bucket).getPublicUrl(photo.storage_path).data.publicUrl
                : signedUrlData.signedUrl;

              return {
                id: photo.id,
                timestamp: capturedTime.toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }),
                url: photoUrl,
                isFavorite: favoriteSet.has(photo.id),
                isPurchased: true,
                price: 4.99,
                track: 'Strecke A',
                speed: resolvePhotoSpeed(photo.speed_kmh, photo.storage_path),
                storage_bucket: photo.storage_bucket,
                storage_path: photo.storage_path,
                captured_at: photo.captured_at,
              };
            })
        );

        setPurchasedPhotos((prevPurchasedPhotos) => {
          const existingFavorites = new Map(
            prevPurchasedPhotos.map((photo) => [photo.id, photo.isFavorite])
          );

          return formattedPhotos.map((photo) => ({
            ...photo,
            isFavorite: existingFavorites.get(photo.id) ?? photo.isFavorite,
          }));
        });
        setAllPhotos((prevAllPhotos) => {
          const existingFavorites = new Map(
            prevAllPhotos.map((photo) => [photo.id, photo.isFavorite])
          );
          const loadedPhotoIds = new Set(formattedPhotos.map((photo) => photo.id));

          const mergedLoadedPhotos = formattedPhotos.map((photo) => ({
            ...photo,
            isFavorite: existingFavorites.get(photo.id) ?? photo.isFavorite,
          }));

          const photosFromOtherRides = prevAllPhotos.filter(
            (photo) => !loadedPhotoIds.has(photo.id)
          );

          return [...photosFromOtherRides, ...mergedLoadedPhotos];
        });
      } else {
        setPurchasedPhotos([]);
      }
    } catch (error: any) {
      console.error('Error fetching purchased photos:', error);
      setPurchasedPhotos([]);
    } finally {
      setLoadingPurchased(false);
    }
  };

  useEffect(() => {
    if (showPurchasedImages && user) {
      fetchPurchasedPhotos();
    }
  }, [showPurchasedImages, user]);

  useEffect(() => {
    if (params.openPurchased === '1') {
      setShowPurchasedImages(true);
      setShowFavorites(false);
      setSelectedRide(null);
      router.replace('/(tabs)/gallery');
    }
  }, [params.openPurchased]);

  const fetchRides = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('user_id', user.id)
        .order('ride_at', { ascending: false });

      if (error) throw error;

      setRides(data || []);
    } catch (error: any) {
      console.error('Error fetching rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRideSelect = async (ride: Ride) => {
    setShareSelectionMode(false);
    setSelectedSharePhotoIds([]);
    setSelectedRide(ride);
    setLoading(true);

    try {
      const rideTime = new Date(ride.ride_at);
      const fromTime = new Date(rideTime.getTime() - 7 * 60 * 1000);
      const toTime = new Date(rideTime.getTime() + 7 * 60 * 1000);

      const { data, error } = await supabase
        .from('photos')
        .select(`
          *,
          purchases!left(status),
          unlocked_photos!left(user_id)
        `)
        .gte('captured_at', fromTime.toISOString())
        .lte('captured_at', toTime.toISOString())
        .order('captured_at', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setPhotos([]);
      } else {
        const formattedPhotos: Photo[] = data.map((dbPhoto: any) => {
          const capturedTime = new Date(dbPhoto.captured_at);
          const { data: urlData } = supabase.storage
            .from(dbPhoto.storage_bucket)
            .getPublicUrl(dbPhoto.storage_path);

          const isPurchased = dbPhoto.unlocked_photos?.some((u: any) => u.user_id === user?.id) || false;
          const speed = resolvePhotoSpeed(dbPhoto.speed_kmh, dbPhoto.storage_path);

          return {
            id: dbPhoto.id,
            timestamp: capturedTime.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            url: urlData.publicUrl,
            isFavorite: favoritePhotoIds.includes(dbPhoto.id),
            isPurchased,
            price: 4.99,
            track: 'Strecke A',
            speed,
            storage_bucket: dbPhoto.storage_bucket,
            storage_path: dbPhoto.storage_path,
            captured_at: dbPhoto.captured_at,
          };
        });

        setPhotos(formattedPhotos);
        setAllPhotos((prevAllPhotos) => {
          const existingFavorites = new Map(
            prevAllPhotos.map((photo) => [photo.id, photo.isFavorite])
          );
          const loadedPhotoIds = new Set(formattedPhotos.map((photo) => photo.id));

          const mergedLoadedPhotos = formattedPhotos.map((photo) => ({
            ...photo,
            isFavorite: existingFavorites.get(photo.id) ?? photo.isFavorite,
          }));

          const photosFromOtherRides = prevAllPhotos.filter(
            (photo) => !loadedPhotoIds.has(photo.id)
          );

          return [...photosFromOtherRides, ...mergedLoadedPhotos];
        });
      }
    } catch (error: any) {
      console.error('Error fetching photos:', error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (id: string) => {
    if (!user) {
      Alert.alert(t('common.info'), t('gallery.loginFirst'));
      return;
    }

    const isCurrentlyFavorite = favoritePhotoIds.includes(id);
    const shouldFavorite = !isCurrentlyFavorite;

    setFavoritePhotoIds((prevIds) => {
      if (shouldFavorite) {
        return prevIds.includes(id) ? prevIds : [...prevIds, id];
      }
      return prevIds.filter((photoId) => photoId !== id);
    });

    try {
      if (shouldFavorite) {
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            photo_id: id,
          } as any);

        if (error && !error.message?.includes('duplicate key')) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('photo_id', id);

        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error saving favorite:', error);
      setFavoritePhotoIds((prevIds) => {
        if (isCurrentlyFavorite) {
          return prevIds.includes(id) ? prevIds : [...prevIds, id];
        }
        return prevIds.filter((photoId) => photoId !== id);
      });
      Alert.alert(t('common.error'), t('gallery.favoriteSaveFailed'));
    }
  };

  const handleAddToCart = (photo: Photo, openCartAfterAdd: boolean = false) => {
    const result = addToCart(photo);
    if (result.added) {
      if (openCartAfterAdd) {
        Alert.alert(t('gallery.addedToCartTitle'), undefined, [
          { text: t('common.ok'), onPress: () => router.push('/cart') },
        ]);
      } else {
        Alert.alert(t('gallery.addedToCartTitle'));
      }
    } else {
      if (openCartAfterAdd) {
        Alert.alert(t('gallery.alreadyInCartTitle'), undefined, [
          { text: t('gallery.toCartButton'), onPress: () => router.push('/cart') },
          { text: t('common.ok'), style: 'cancel' },
        ]);
      } else {
        Alert.alert(t('gallery.alreadyInCartTitle'));
      }
    }
  };

  const handleDownload = async (photo: Photo) => {
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(photo.url);
        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `liftpictures-${photo.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        Alert.alert(t('common.success'), t('gallery.downloadStarting'));
      } else {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t('gallery.permissionRequiredTitle'), t('gallery.permissionRequiredDescription'));
          return;
        }

        const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (!directory) {
          throw new Error('No writable directory available');
        }

        const fileUri = `${directory}liftpictures-${photo.id}.jpg`;
        await FileSystem.downloadAsync(photo.url, fileUri);
        await MediaLibrary.saveToLibraryAsync(fileUri);
        await FileSystem.deleteAsync(fileUri, { idempotent: true });

        Alert.alert(t('common.success'), t('gallery.savedToGallery'));
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(t('common.error'), t('gallery.downloadFailed'));
    }
  };

  const getPlatformUrls = (platform: SocialPlatform, sharePhotos: Photo[]) => {
    const firstPhoto = sharePhotos[0];
    if (!firstPhoto) return { appUrls: [] as string[], webUrl: '' };

    const combinedUrls = sharePhotos.map((photo) => photo.url).join(' ');
    const encodedPhotoUrl = encodeURIComponent(firstPhoto.url);
    const encodedText = encodeURIComponent(t('gallery.shareMessageSingle'));
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedPhotoUrl}`;

    if (platform === 'instagram') {
      return {
        appUrls: ['instagram://app'],
        webUrl: 'https://www.instagram.com/',
      };
    }

    if (platform === 'facebook') {
      return {
        appUrls: [`fb://facewebmodal/f?href=${encodeURIComponent(facebookShareUrl)}`, 'fb://'],
        webUrl: facebookShareUrl,
      };
    }

    if (platform === 'x') {
      return {
        appUrls: [`twitter://post?message=${encodeURIComponent(`${t('gallery.shareMessageMultiple')} ${combinedUrls}`)}`, 'x://'],
        webUrl: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodeURIComponent(combinedUrls)}`,
      };
    }

    return {
      appUrls: ['snssdk1233://', 'tiktok://'],
      webUrl: 'https://www.tiktok.com/',
    };
  };

  const handleShareToPlatform = async (platform: SocialPlatform) => {
    const photoMap = new Map<string, Photo>();
    [...allPhotos, ...photos, ...purchasedPhotos].forEach((photo) => {
      photoMap.set(photo.id, photo);
    });

    const sharePhotos = sharePhotoIds
      .map((id) => photoMap.get(id))
      .filter((photo): photo is Photo => !!photo);

    if (sharePhotos.length === 0) {
      Alert.alert(t('common.info'), t('gallery.selectAtLeastOneImage'));
      return;
    }

    try {
      const { appUrls, webUrl } = getPlatformUrls(platform, sharePhotos);

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(webUrl, '_blank', 'noopener,noreferrer');
        }
        setShowSocialShareOptions(false);
        return;
      }

      let openedApp = false;
      for (const appUrl of appUrls) {
        const canOpen = await Linking.canOpenURL(appUrl);
        if (canOpen) {
          await Linking.openURL(appUrl);
          openedApp = true;
          break;
        }
      }

      if (!openedApp) {
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Share error:', error);
      await Share.share({
        title: 'Liftpictures',
        message: `${t('gallery.shareMessageMultiple')}\n${sharePhotos.map((photo) => photo.url).join('\n')}`,
        url: sharePhotos[0].url,
      });
    } finally {
      setShowSocialShareOptions(false);
      setShareSelectionMode(false);
      setSelectedSharePhotoIds([]);
      setSharePhotoIds([]);
    }
  };

  const openSocialShareOptions = (photoIds: string[]) => {
    if (photoIds.length === 0) {
      Alert.alert(t('common.info'), t('gallery.selectAtLeastOneImage'));
      return;
    }

    setSharePhotoIds(photoIds);
    setShowSocialShareOptions(true);
  };

  const toggleShareSelection = (photoId: string) => {
    setSelectedSharePhotoIds((prevIds) => (
      prevIds.includes(photoId)
        ? prevIds.filter((id) => id !== photoId)
        : [...prevIds, photoId]
    ));
  };

  const getPurchasedPhotoIds = (items: Photo[]) => (
    items.filter((photo) => photo.isPurchased).map((photo) => photo.id)
  );

  const handleTopSharePress = () => {
    if (!shareSelectionMode) {
      setShareSelectionMode(true);
      setSelectedSharePhotoIds([]);
      return;
    }

    openSocialShareOptions(selectedSharePhotoIds);
  };

  const handleRideTopSharePress = () => {
    const ridePurchasedIds = getPurchasedPhotoIds(photos);

    if (!shareSelectionMode) {
      setShareSelectionMode(true);
      setSelectedSharePhotoIds([]);
      return;
    }

    const validSelectedIds = selectedSharePhotoIds.filter((id) => ridePurchasedIds.includes(id));
    openSocialShareOptions(validSelectedIds);
  };

  const renderSocialSharePicker = () => {
    if (!showSocialShareOptions) return null;

    const content = (
      <View style={styles.socialShareOverlay}>
        <TouchableOpacity
          style={styles.socialShareBackdrop}
          activeOpacity={1}
          onPress={() => setShowSocialShareOptions(false)}
        />
        <View style={styles.socialShareCard}>
          <Text style={styles.socialShareTitle}>Plattform waehlen</Text>
          <View style={styles.socialShareRow}>
            {[
              { key: 'instagram' as SocialPlatform, label: 'Instagram', icon: 'instagram', color: '#E4405F' },
              { key: 'facebook' as SocialPlatform, label: 'Facebook', icon: 'facebook-f', color: '#1877F2' },
              { key: 'x' as SocialPlatform, label: 'X', icon: 'x-twitter', color: '#000000' },
              { key: 'tiktok' as SocialPlatform, label: 'TikTok', icon: 'tiktok', color: '#111111' },
            ].map((platform) => (
              <TouchableOpacity
                key={platform.key}
                style={styles.socialShareOption}
                onPress={() => handleShareToPlatform(platform.key)}
              >
                <View style={[styles.socialShareIconCircle, { backgroundColor: platform.color }]}>
                  <FontAwesome6 name={platform.icon as any} size={20} color="#fff" />
                </View>
                <Text style={styles.socialShareLabel}>{platform.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );

    if (Platform.OS === 'web') {
      return content;
    }

    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setShowSocialShareOptions(false)}
      >
        {content}
      </Modal>
    );
  };

  const renderPurchasedPhotoViewer = () => {
    if (!selectedPurchasedPhoto) return null;

    const viewerContent = (
      <SafeAreaView style={styles.photoModalContent}>
        <TouchableOpacity
          style={styles.photoModalCloseButton}
          onPress={() => {
            setShowSocialShareOptions(false);
            setSelectedPurchasedPhoto(null);
          }}
        >
          <X size={24} color="#fff" />
        </TouchableOpacity>

        <Image
          source={{ uri: selectedPurchasedPhoto.url }}
          style={styles.photoModalImage}
          resizeMode="contain"
        />

        <TouchableOpacity
          style={styles.photoModalShareButton}
          onPress={() => openSocialShareOptions([selectedPurchasedPhoto.id])}
        >
          <Text style={styles.photoModalShareText}>Teilen auf Social Media</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.photoModalDownloadButton}
          onPress={() => handleDownload(selectedPurchasedPhoto)}
        >
          <Download size={18} color="#000" />
          <Text style={styles.photoModalDownloadText}>Download</Text>
        </TouchableOpacity>

      </SafeAreaView>
    );

    if (Platform.OS === 'web') {
      return (
        <View style={styles.photoWebOverlay}>
          {viewerContent}
        </View>
      );
    }

    return (
      <Modal
        visible
        transparent={false}
        animationType="fade"
        onRequestClose={() => {
          setShowSocialShareOptions(false);
          setSelectedPurchasedPhoto(null);
        }}
      >
        <View style={styles.photoModalOverlay}>
          {viewerContent}
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />
        <View style={styles.loadingContainer}>
          <AlertCircle size={40} color="#ff6b35" />
          <Text style={styles.loadingText}>Lade...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />
        <View style={styles.emptyContainer}>
          <AlertCircle size={60} color="#666" />
          <Text style={styles.emptyTitle}>Bitte melde dich an</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/auth/')}
          >
            <Text style={styles.actionButtonText}>Anmelden</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showPurchasedImages) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShareSelectionMode(false);
              setSelectedSharePhotoIds([]);
              setShowPurchasedImages(false);
            }}
          >
            <Text style={styles.backButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Meine gekauften Bilder</Text>
        </View>
        <View style={styles.multiShareContainer}>
          <TouchableOpacity
            style={[styles.multiShareButton, shareSelectionMode && styles.multiShareButtonActive]}
            onPress={handleTopSharePress}
          >
            <Share2 size={16} color="#000" />
            <Text style={styles.multiShareButtonText}>
              {shareSelectionMode
                ? (selectedSharePhotoIds.length > 0
                  ? `Teilen (${selectedSharePhotoIds.length})`
                  : 'Bilder waehlen')
                : 'Teilen auf Social Media'}
            </Text>
          </TouchableOpacity>
          {shareSelectionMode && (
            <TouchableOpacity
              style={styles.multiShareCancelButton}
              onPress={() => {
                setShareSelectionMode(false);
                setSelectedSharePhotoIds([]);
              }}
            >
              <Text style={styles.multiShareCancelText}>Abbrechen</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingPurchased ? (
          <View style={styles.loadingContainer}>
            <AlertCircle size={40} color="#ff6b35" />
            <Text style={styles.loadingText}>Lade gekaufte Fotos...</Text>
          </View>
        ) : purchasedPhotos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Package size={60} color="#666" />
            <Text style={styles.emptyTitle}>Du hast noch keine Bilder gekauft</Text>
            <Text style={styles.emptySubtitle}>
              Füge jetzt welche zum Warenkorb hinzu
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowPurchasedImages(false)}
            >
              <Text style={styles.actionButtonText}>Zur Galerie</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.gallery} showsVerticalScrollIndicator={false}>
            <View style={styles.gridContainer}>
	              {purchasedPhotos.map((photo) => (
	                <View
	                  key={photo.id}
	                  style={[
	                    styles.gridItem,
	                    shareSelectionMode && selectedSharePhotoIds.includes(photo.id) && styles.selectedShareCard,
	                  ]}
	                >
	                  <TouchableOpacity
	                    style={styles.imageContainer}
	                    activeOpacity={0.9}
	                    onPress={() => {
	                      if (shareSelectionMode) {
                        toggleShareSelection(photo.id);
                      } else {
                        setSelectedPurchasedPhoto(photo);
                      }
                    }}
	                  >
	                    <Image
	                      source={{ uri: photo.url }}
	                      style={styles.gridImage}
	                      resizeMode="cover"
	                    />
	                    {shareSelectionMode && selectedSharePhotoIds.includes(photo.id) && (
	                      <View style={styles.shareSelectedBadge}>
	                        <Check size={14} color="#fff" />
	                      </View>
	                    )}
	                  </TouchableOpacity>
	                  <TouchableOpacity
	                    style={[styles.favoriteButton, photo.isFavorite && styles.favoriteActive]}
	                    onPress={() => toggleFavorite(photo.id)}
	                  >
	                    <Heart size={16} color={photo.isFavorite ? '#fff' : '#ff6b35'} />
	                  </TouchableOpacity>
	                  <TouchableOpacity
	                    style={styles.purchasedGridInfo}
	                    activeOpacity={0.85}
	                    onPress={() => {
	                      if (shareSelectionMode) {
	                        toggleShareSelection(photo.id);
	                      } else {
	                        setSelectedPurchasedPhoto(photo);
	                      }
	                    }}
	                  >
	                    <View>
	                      <Text style={styles.gridTime}>{photo.timestamp}</Text>
	                      <Text style={styles.gridSpeed}>{photo.speed.toFixed(1)} km/h</Text>
	                    </View>
	                    <TouchableOpacity
	                      style={styles.purchasedInfoShareButton}
	                      onPress={() => openSocialShareOptions([photo.id])}
	                    >
	                      <Share2 size={13} color="#fff" />
		                    </TouchableOpacity>
		                  </TouchableOpacity>
                  <View style={styles.gridActions}>
                    <TouchableOpacity
                      style={styles.downloadButtonSmall}
                      onPress={() => handleDownload(photo)}
                    >
                      <Download size={14} color="#000" />
                      <Text style={styles.downloadButtonText}>Download</Text>
                    </TouchableOpacity>
                  </View>
		                </View>
		              ))}
	            </View>
          </ScrollView>
        )}
        {renderPurchasedPhotoViewer()}
        {renderSocialSharePicker()}
      </SafeAreaView>
    );
  }

  if (showFavorites) {
    const favoritePhotos = allPhotos.filter(photo => photo.isFavorite);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowFavorites(false)}
          >
            <Text style={styles.backButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Meine Favoriten</Text>
          <Text style={styles.subtitle}>
            {favoritePhotos.length} {favoritePhotos.length === 1 ? 'Favorit' : 'Favoriten'}
          </Text>
        </View>

        {favoritePhotos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Heart size={60} color="#666" />
            <Text style={styles.emptyTitle}>Du hast noch keine Favoriten</Text>
            <Text style={styles.emptySubtitle}>
              Markiere Bilder als Favoriten, um sie hier zu sehen
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowFavorites(false)}
            >
              <Text style={styles.actionButtonText}>Zur Galerie</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.gallery} showsVerticalScrollIndicator={false}>
            <View style={styles.gridContainer}>
              {favoritePhotos.map((photo) => (
                <View key={photo.id} style={styles.gridItem}>
                  <TouchableOpacity
                    style={styles.imageContainer}
                    activeOpacity={0.9}
                    onPress={() => {
                      if (photo.isPurchased) {
                        setSelectedPurchasedPhoto(photo);
                      }
                    }}
                  >
                    <Image source={{ uri: photo.url }} style={styles.gridImage} />
                    {!photo.isPurchased && (
                      <View style={styles.watermarkOverlay}>
                        <Text style={styles.watermarkText}>LIFTPICTURES</Text>
                        <Text style={styles.watermarkSubtext}>VORSCHAU</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.favoriteButton, styles.favoriteActive]}
                    onPress={() => toggleFavorite(photo.id)}
                  >
                    <Heart size={16} color="#fff" />
                  </TouchableOpacity>
                  {photo.isPurchased ? (
                    <TouchableOpacity
                      style={styles.purchasedGridInfo}
                      activeOpacity={0.85}
                      onPress={() => setSelectedPurchasedPhoto(photo)}
                    >
                      <View>
                        <Text style={styles.gridTime}>{photo.timestamp}</Text>
                        <Text style={styles.gridSpeed}>{photo.speed} km/h</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.purchasedInfoShareButton}
                        onPress={() => openSocialShareOptions([photo.id])}
                      >
                        <Share2 size={13} color="#fff" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.gridInfo}>
                      <Text style={styles.gridTime}>{photo.timestamp}</Text>
                      <Text style={styles.gridSpeed}>{photo.speed} km/h</Text>
                    </View>
                  )}
                  {photo.isPurchased ? (
                    <View style={styles.gridActions}>
                      <TouchableOpacity
                        style={styles.downloadButtonSmall}
                        onPress={() => handleDownload(photo)}
                      >
                        <Download size={14} color="#000" />
                        <Text style={styles.downloadButtonText}>Download</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.gridActions}>
                      {cartPhotoIds.has(photo.id) ? (
                        <View style={styles.addedToCartBadge}>
                          <Text style={styles.addedToCartText}>Hinzugefügt</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addToCartButton}
                          onPress={() => handleAddToCart(photo)}
                        >
                          <Plus size={14} color="#000" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.gridBuyButton}
                        onPress={() => {
                          handleAddToCart(photo, true);
                        }}
                      >
                        <ShoppingCart size={14} color="#000" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
        {renderPurchasedPhotoViewer()}
        {renderSocialSharePicker()}
      </SafeAreaView>
    );
  }

  if (rides.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />
        <View style={styles.emptyContainer}>
          <Package size={60} color="#666" />
          <Text style={styles.emptyTitle}>Du hast noch keine Fahrt erfasst</Text>
          <Text style={styles.emptySubtitle}>
            Erfasse jetzt deine erste Fahrt, um deine Bilder zu sehen
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowRideCaptureModal(true)}
          >
            <Text style={styles.actionButtonText}>Fahrt erfassen</Text>
          </TouchableOpacity>
        </View>
        <RideCaptureModal
          visible={showRideCaptureModal}
          onClose={() => setShowRideCaptureModal(false)}
          onSuccess={fetchRides}
        />
      </SafeAreaView>
    );
  }

  if (!selectedRide) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />
        <View style={styles.header}>
          <Text style={styles.title}>Wähle deine Fahrt</Text>
          <Text style={styles.subtitle}>
            Wähle eine Fahrt aus, um deine Bilder zu sehen
          </Text>
        </View>

        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              setShareSelectionMode(false);
              setSelectedSharePhotoIds([]);
              setSelectedRide(null);
              setShowPurchasedImages(true);
            }}
            activeOpacity={0.7}
          >
            <Package size={20} color="#ff6b35" />
            <Text style={styles.quickActionText}>Gekaufte Bilder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              setSelectedRide(null);
              setShowFavorites(true);
            }}
            activeOpacity={0.7}
          >
            <Heart size={20} color="#ff6b35" />
            <Text style={styles.quickActionText}>Favoriten</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.ridesList} showsVerticalScrollIndicator={false}>
          {rides.map((ride) => {
            const rideDate = new Date(ride.ride_at);
            return (
              <TouchableOpacity
                key={ride.id}
                style={styles.rideCard}
                onPress={() => handleRideSelect(ride)}
              >
                <View style={styles.rideCardContent}>
                  <View style={styles.rideCardIcon}>
                    <Clock size={24} color="#ff6b35" />
                  </View>
                  <View style={styles.rideCardInfo}>
                    <Text style={styles.rideCardDate}>
                      {rideDate.toLocaleDateString('de-DE', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.rideCardTime}>
                      {rideDate.toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <ChevronRight size={24} color="#999" />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setShowRideCaptureModal(true)}
        >
          <Plus size={24} color="#000" />
          <Text style={styles.floatingButtonText}>Neue Fahrt</Text>
        </TouchableOpacity>

        <RideCaptureModal
          visible={showRideCaptureModal}
          onClose={() => setShowRideCaptureModal(false)}
          onSuccess={fetchRides}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setShareSelectionMode(false);
            setSelectedSharePhotoIds([]);
            setSelectedRide(null);
          }}
        >
          <Text style={styles.backButtonText}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Deine Bilder</Text>
        <Text style={styles.subtitle}>
          {new Date(selectedRide.ride_at).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.purchasedButtonContainer}>
        <TouchableOpacity
          style={styles.purchasedButton}
          onPress={() => {
            setShareSelectionMode(false);
            setSelectedSharePhotoIds([]);
            setShowPurchasedImages(true);
          }}
        >
          <Package size={20} color="#ff6b35" />
          <Text style={styles.purchasedButtonText}>Meine gekauften Bilder</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.multiShareContainer}>
        <TouchableOpacity
          style={[styles.multiShareButton, shareSelectionMode && styles.multiShareButtonActive]}
          onPress={handleRideTopSharePress}
        >
          <Share2 size={16} color="#000" />
          <Text style={styles.multiShareButtonText}>
            {shareSelectionMode
              ? (selectedSharePhotoIds.length > 0
                ? `Teilen (${selectedSharePhotoIds.length})`
                : 'Bilder waehlen')
              : 'Teilen auf Social Media'}
          </Text>
        </TouchableOpacity>
        {shareSelectionMode && (
          <TouchableOpacity
            style={styles.multiShareCancelButton}
            onPress={() => {
              setShareSelectionMode(false);
              setSelectedSharePhotoIds([]);
            }}
          >
            <Text style={styles.multiShareCancelText}>Abbrechen</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <AlertCircle size={40} color="#ff6b35" />
          <Text style={styles.loadingText}>Lade Fotos...</Text>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <AlertCircle size={60} color="#666" />
          <Text style={styles.emptyTitle}>Zu dieser Uhrzeit wurde keine Fahrt gefunden</Text>
          <Text style={styles.emptySubtitle}>
            Bitte eine andere Zeit probieren
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setSelectedRide(null)}
          >
            <Text style={styles.actionButtonText}>Zurück zur Fahrtauswahl</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.gallery} showsVerticalScrollIndicator={false}>
          <View style={styles.gridContainer}>
            {photos.map((photo) => (
              <View
                key={photo.id}
                style={[
                  styles.gridItem,
                  photo.isPurchased && shareSelectionMode && selectedSharePhotoIds.includes(photo.id) && styles.selectedShareCard,
                ]}
              >
                <TouchableOpacity
                  style={styles.imageContainer}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (!photo.isPurchased) return;
                    if (shareSelectionMode) {
                      toggleShareSelection(photo.id);
                    } else {
                      setSelectedPurchasedPhoto(photo);
                    }
                  }}
                >
                  <Image source={{ uri: photo.url }} style={styles.gridImage} />
                  {!photo.isPurchased && (
                    <View style={styles.watermarkOverlay}>
                      <Text style={styles.watermarkText}>LIFTPICTURES</Text>
                      <Text style={styles.watermarkSubtext}>VORSCHAU</Text>
                    </View>
                  )}
                  {photo.isPurchased && shareSelectionMode && selectedSharePhotoIds.includes(photo.id) && (
                    <View style={styles.shareSelectedBadge}>
                      <Check size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.favoriteButton, photo.isFavorite && styles.favoriteActive]}
                  onPress={() => toggleFavorite(photo.id)}
                >
                  <Heart size={16} color={photo.isFavorite ? '#fff' : '#ff6b35'} />
                </TouchableOpacity>
                {photo.isPurchased ? (
                  <TouchableOpacity
                    style={styles.purchasedGridInfo}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (shareSelectionMode) {
                        toggleShareSelection(photo.id);
                      } else {
                        setSelectedPurchasedPhoto(photo);
                      }
                    }}
                  >
                    <View>
                      <Text style={styles.gridTime}>{photo.timestamp}</Text>
                      <Text style={styles.gridSpeed}>{photo.speed.toFixed(1)} km/h</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.purchasedInfoShareButton}
                      onPress={() => openSocialShareOptions([photo.id])}
                    >
                      <Share2 size={13} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.gridInfo}>
                    <Text style={styles.gridTime}>{photo.timestamp}</Text>
                    <Text style={styles.gridSpeed}>{photo.speed.toFixed(1)} km/h</Text>
                  </View>
                )}
                {photo.isPurchased ? (
                  <View style={styles.gridActions}>
                    <TouchableOpacity
                      style={styles.downloadButtonSmall}
                      onPress={() => handleDownload(photo)}
                    >
                      <Download size={14} color="#000" />
                      <Text style={styles.downloadButtonText}>Download</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.gridActions}>
                    {cartPhotoIds.has(photo.id) ? (
                      <View style={styles.addedToCartBadge}>
                        <Text style={styles.addedToCartText}>Hinzugefügt</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addToCartButton}
                        onPress={() => handleAddToCart(photo)}
                      >
                        <Plus size={14} color="#000" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.gridBuyButton}
                      onPress={() => {
                        handleAddToCart(photo, true);
                      }}
                    >
                      <ShoppingCart size={14} color="#000" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      {renderPurchasedPhotoViewer()}
      {renderSocialSharePicker()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
  },
  actionButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#ff6b35',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderColor: '#ff6b35',
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b35',
    marginLeft: 8,
  },
  ridesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  rideCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  rideCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  rideCardIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rideCardInfo: {
    flex: 1,
  },
  rideCardDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  rideCardTime: {
    fontSize: 14,
    color: '#999',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#ff6b35',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  purchasedButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  purchasedButton: {
    backgroundColor: '#1a1a1a',
    borderColor: '#ff6b35',
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchasedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b35',
    marginLeft: 8,
  },
  multiShareContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  multiShareButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiShareButtonActive: {
    backgroundColor: '#00c851',
  },
  multiShareButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  multiShareCancelButton: {
    backgroundColor: '#1a1a1a',
    borderColor: '#444',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiShareCancelText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  gallery: {
    flex: 1,
    paddingHorizontal: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 100,
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
  },
  selectedShareCard: {
    borderWidth: 2,
    borderColor: '#00c851',
  },
  shareSelectedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00c851',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
  },
  purchasedGridInfo: {
    padding: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  purchasedInfoShareButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  watermarkText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  watermarkSubtext: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 107, 53, 0.9)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteActive: {
    backgroundColor: '#ff6b35',
  },
  purchasedFavoriteButton: {
    right: 48,
  },
  gridInfo: {
    padding: 12,
    paddingBottom: 8,
  },
  gridTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  gridSpeed: {
    fontSize: 12,
    color: '#999',
  },
  gridActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  addToCartButton: {
    backgroundColor: '#00c851',
    borderRadius: 16,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addedToCartBadge: {
    backgroundColor: '#00c851',
    borderRadius: 16,
    paddingHorizontal: 10,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addedToCartText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  gridBuyButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 16,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#00c851',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButtonSmall: {
    backgroundColor: '#00c851',
    borderRadius: 16,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  downloadButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginLeft: 4,
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoWebOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  photoModalContent: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  photoModalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  photoModalShareButton: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    zIndex: 9,
  },
  photoModalShareText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  photoModalImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  photoModalDownloadButton: {
    position: 'absolute',
    bottom: 34,
    alignSelf: 'center',
    backgroundColor: '#00c851',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9,
  },
  photoModalDownloadText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  socialShareOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    justifyContent: 'flex-end',
  },
  socialShareBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  socialShareCard: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderColor: '#333',
  },
  socialShareTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  socialShareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  socialShareOption: {
    alignItems: 'center',
    flex: 1,
  },
  socialShareIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  socialShareLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
