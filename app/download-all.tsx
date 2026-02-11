import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Download } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

type PurchasedPhoto = {
  id: string;
  url: string;
  capturedAt: string;
};

export default function DownloadAllScreen() {
  const { user } = useAuthContext();
  const { t, i18n } = useTranslation();
  const [photos, setPhotos] = useState<PurchasedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadedCount, setDownloadedCount] = useState(0);

  const fetchPurchasedPhotos = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('unlocked_photos')
        .select(`
          photo_id,
          photos (
            id,
            storage_bucket,
            storage_path,
            captured_at
          )
        `)
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;

      const mapped: PurchasedPhoto[] = await Promise.all(
        (data || [])
          .filter((item: any) => item.photos)
          .map(async (item: any) => {
            const photo = Array.isArray(item.photos) ? item.photos[0] : item.photos;
            const { data: signedData, error: signedError } = await supabase.storage
              .from(photo.storage_bucket)
              .createSignedUrl(photo.storage_path, 3600);

            const fallback = supabase.storage
              .from(photo.storage_bucket)
              .getPublicUrl(photo.storage_path)
              .data.publicUrl;

            return {
              id: photo.id,
              url: signedError || !signedData ? fallback : signedData.signedUrl,
              capturedAt: photo.captured_at,
            };
          }),
      );

      setPhotos(mapped);
    } catch (error: any) {
      console.error('Error loading purchased photos:', error);
      Alert.alert(t('common.error'), error?.message || t('downloadAll.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    fetchPurchasedPhotos();
  }, [fetchPurchasedPhotos]);

  useFocusEffect(
    useCallback(() => {
      fetchPurchasedPhotos();
    }, [fetchPurchasedPhotos]),
  );

  const downloadSingle = async (photo: PurchasedPhoto, index: number) => {
    if (Platform.OS === 'web') {
      const response = await fetch(photo.url);
      if (!response.ok) {
        throw new Error(t('downloadAll.errors.downloadFailedStatus', { status: response.status }));
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `liftpictures-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      return;
    }

    const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!directory) {
      throw new Error(t('downloadAll.errors.noStorageDirectory'));
    }

    const fileUri = `${directory}liftpictures-${photo.id}.jpg`;
    await FileSystem.downloadAsync(photo.url, fileUri);
    await MediaLibrary.saveToLibraryAsync(fileUri);
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  };

  const handleDownloadAll = async () => {
    if (photos.length === 0) {
      Alert.alert(t('common.info'), t('downloadAll.noPurchasedPhotos'));
      return;
    }

    setDownloadingAll(true);
    setDownloadedCount(0);

    try {
      if (Platform.OS !== 'web') {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t('downloadAll.permissionRequiredTitle'), t('downloadAll.permissionRequiredDescription'));
          setDownloadingAll(false);
          return;
        }
      }

      for (let i = 0; i < photos.length; i++) {
        await downloadSingle(photos[i], i);
        setDownloadedCount(i + 1);
      }

      Alert.alert(t('common.success'), t('downloadAll.downloadedCount', { count: photos.length }));
    } catch (error: any) {
      console.error('Download all error:', error);
      Alert.alert(t('common.error'), error?.message || t('downloadAll.errors.downloadAllFailed'));
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('downloadAll.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.downloadAllButton}
          onPress={handleDownloadAll}
          disabled={downloadingAll || loading || photos.length === 0}
        >
          <Download size={18} color="#000" />
          <Text style={styles.downloadAllText}>
            {downloadingAll
              ? t('downloadAll.downloadingProgress', { downloaded: downloadedCount, total: photos.length })
              : t('downloadAll.downloadAllButton', { count: photos.length })}
          </Text>
        </TouchableOpacity>

        <ScrollView style={styles.gallery} showsVerticalScrollIndicator={false}>
          {photos.length === 0 ? (
            <Text style={styles.emptyText}>{loading ? t('downloadAll.loadingPhotos') : t('downloadAll.noPurchasedPhotosYet')}</Text>
          ) : (
            photos.map((photo, idx) => (
              <View key={photo.id} style={styles.card}>
                <Image source={{ uri: photo.url }} style={styles.cardImage} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{t('downloadAll.imageNumber', { number: idx + 1 })}</Text>
                  <Text style={styles.cardMeta}>
                    {new Date(photo.capturedAt).toLocaleString(
                      i18n.language === 'es' ? 'es-ES' : i18n.language === 'en' ? 'en-US' : 'de-DE',
                      { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }
                    )}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
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
  downloadAllButton: {
    marginTop: 8,
    marginBottom: 14,
    backgroundColor: '#ff8c42',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadAllText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  gallery: {
    flex: 1,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 30,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  cardImage: {
    width: 74,
    height: 74,
    borderRadius: 10,
    backgroundColor: '#222',
  },
  cardInfo: {
    marginLeft: 10,
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardMeta: {
    color: '#aaa',
    fontSize: 12,
  },
});
