import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, ShoppingCart, Plus, AlertCircle, X, ChevronRight, Calendar, Clock, Package, Download } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { router, useFocusEffect } from 'expo-router';
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

export default function GalleryScreen() {
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
  const [loadingPurchased, setLoadingPurchased] = useState(false);
  const { user } = useAuthContext();
  const { addToCart } = useCart();

  useEffect(() => {
    if (user) {
      fetchRides();
    } else {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchRides();
        if (showPurchasedImages) {
          fetchPurchasedPhotos();
        }
      }
    }, [user, showPurchasedImages])
  );

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
                isFavorite: false,
                isPurchased: true,
                price: 4.99,
                track: 'Strecke A',
                speed: photo.speed_kmh ? parseFloat(photo.speed_kmh) : 0,
                storage_bucket: photo.storage_bucket,
                storage_path: photo.storage_path,
                captured_at: photo.captured_at,
              };
            })
        );

        setPurchasedPhotos(formattedPhotos);
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
          const speed = dbPhoto.speed_kmh ? parseFloat(dbPhoto.speed_kmh) : 0;

          return {
            id: dbPhoto.id,
            timestamp: capturedTime.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            url: urlData.publicUrl,
            isFavorite: false,
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
      }
    } catch (error: any) {
      console.error('Error fetching photos:', error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (id: string) => {
    setPhotos(photos.map(photo =>
      photo.id === id ? { ...photo, isFavorite: !photo.isFavorite } : photo
    ));
    setAllPhotos(allPhotos.map(photo =>
      photo.id === id ? { ...photo, isFavorite: !photo.isFavorite } : photo
    ));
  };

  const handleAddToCart = (photo: Photo) => {
    addToCart(photo);
  };

  const handleDownload = async (photo: Photo) => {
    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = photo.url;
        link.download = `liftpictures-${photo.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Erfolg', 'Bild wird heruntergeladen');
      } else {
        Linking.openURL(photo.url);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Fehler', 'Bild konnte nicht heruntergeladen werden');
    }
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
            onPress={() => setShowPurchasedImages(false)}
          >
            <Text style={styles.backButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Meine gekauften Bilder</Text>
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
                <View key={photo.id} style={styles.gridItem}>
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: photo.url }}
                      style={styles.gridImage}
                      resizeMode="cover"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={() => handleDownload(photo)}
                  >
                    <Download size={16} color="#000" />
                  </TouchableOpacity>
                  <View style={styles.gridInfo}>
                    <Text style={styles.gridTime}>{photo.timestamp}</Text>
                    <Text style={styles.gridSpeed}>{photo.speed.toFixed(1)} km/h</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
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
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: photo.url }} style={styles.gridImage} />
                    {!photo.isPurchased && (
                      <View style={styles.watermarkOverlay}>
                        <Text style={styles.watermarkText}>LIFTPICTURES</Text>
                        <Text style={styles.watermarkSubtext}>VORSCHAU</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.favoriteButton, styles.favoriteActive]}
                    onPress={() => toggleFavorite(photo.id)}
                  >
                    <Heart size={16} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.gridInfo}>
                    <Text style={styles.gridTime}>{photo.timestamp}</Text>
                    <Text style={styles.gridSpeed}>{photo.speed} km/h</Text>
                  </View>
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
                      <TouchableOpacity
                        style={styles.addToCartButton}
                        onPress={() => handleAddToCart(photo)}
                      >
                        <Plus size={14} color="#000" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.gridBuyButton}
                        onPress={() => {
                          handleAddToCart(photo);
                          router.push('/cart');
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
          onPress={() => setSelectedRide(null)}
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
          onPress={() => setShowPurchasedImages(true)}
        >
          <Package size={20} color="#ff6b35" />
          <Text style={styles.purchasedButtonText}>Meine gekauften Bilder</Text>
        </TouchableOpacity>
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
              <View key={photo.id} style={styles.gridItem}>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: photo.url }} style={styles.gridImage} />
                  {!photo.isPurchased && (
                    <View style={styles.watermarkOverlay}>
                      <Text style={styles.watermarkText}>LIFTPICTURES</Text>
                      <Text style={styles.watermarkSubtext}>VORSCHAU</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.favoriteButton, photo.isFavorite && styles.favoriteActive]}
                  onPress={() => toggleFavorite(photo.id)}
                >
                  <Heart size={16} color={photo.isFavorite ? '#fff' : '#ff6b35'} />
                </TouchableOpacity>
                <View style={styles.gridInfo}>
                  <Text style={styles.gridTime}>{photo.timestamp}</Text>
                  <Text style={styles.gridSpeed}>{photo.speed.toFixed(1)} km/h</Text>
                </View>
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
                    <TouchableOpacity
                      style={styles.addToCartButton}
                      onPress={() => handleAddToCart(photo)}
                    >
                      <Plus size={14} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.gridBuyButton}
                      onPress={() => {
                        handleAddToCart(photo);
                        router.push('/cart');
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
});
