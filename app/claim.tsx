import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type ClaimPhoto = {
  id: string;
  external_code: string | null;
};

const PURCHASED_REDIRECT_ROUTE = '/(tabs)/gallery?openPurchased=1';

const readParam = (value?: string | string[]) => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

export default function ClaimScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const { user, loading: authLoading } = useAuthContext();
  const code = useMemo(() => readParam(params.code).trim(), [params.code]);
  const [photo, setPhoto] = useState<ClaimPhoto | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const unlockStartedRef = useRef(false);

  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }

    let active = true;

    const loadPhotoByCode = async () => {
      setLoadingPhoto(true);
      setPhotoError(null);

      try {
        const { data, error } = await supabase
          .rpc('find_claim_photo', { p_code: code })
          .single();

        if (error || !data) {
          throw error || new Error('Photo not found');
        }

        if (!active) return;
        setPhoto(data as ClaimPhoto);
      } catch (error: any) {
        if (!active) return;
        setPhoto(null);
        setPreviewUrl(null);
        setPhotoError(error?.message || 'not_found');
      } finally {
        if (active) {
          setLoadingPhoto(false);
        }
      }
    };

    loadPhotoByCode();

    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    if (!photo?.id) {
      setPreviewUrl(null);
      return;
    }

    let active = true;

    const loadPreview = async () => {
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('storage_bucket, storage_path')
          .eq('id', photo.id)
          .maybeSingle();

        if (error || !data?.storage_bucket || !data?.storage_path) {
          if (active) setPreviewUrl(null);
          return;
        }

        const publicUrl = supabase
          .storage
          .from(data.storage_bucket)
          .getPublicUrl(data.storage_path).data.publicUrl;

        if (active) {
          setPreviewUrl(publicUrl || null);
        }
      } catch {
        if (active) setPreviewUrl(null);
      }
    };

    void loadPreview();

    return () => {
      active = false;
    };
  }, [photo?.id]);

  const unlockAndRedirect = useCallback(async () => {
    if (!user?.id || !photo?.id) return;

    setIsUnlocking(true);
    setUnlockError(null);

    try {
      const { error } = await supabase
        .from('unlocked_photos')
        .upsert(
          [
            {
              user_id: user.id,
              photo_id: photo.id,
            },
          ] as any,
          {
            onConflict: 'user_id,photo_id',
            ignoreDuplicates: true,
          }
        );

      if (error) {
        throw error;
      }

      router.replace(PURCHASED_REDIRECT_ROUTE);
    } catch (error: any) {
      console.error('Claim unlock failed:', error);
      unlockStartedRef.current = false;
      setUnlockError(error?.message || 'unlock_failed');
      setIsUnlocking(false);
    }
  }, [photo?.id, user?.id]);

  useEffect(() => {
    if (authLoading || !photo?.id || !user?.id) return;
    if (unlockStartedRef.current) return;

    unlockStartedRef.current = true;
    void unlockAndRedirect();
  }, [authLoading, photo?.id, unlockAndRedirect, user?.id]);

  const openAuth = () => {
    router.push({
      pathname: '/auth',
      params: {
        mode: 'signin',
        redirectTo: `/claim?code=${encodeURIComponent(code)}`,
      },
    });
  };

  if (loadingPhoto || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#ff6b35" />
          <Text style={styles.subtitle}>{t('claim.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!photo || photoError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.title}>{t('claim.notFoundTitle')}</Text>
          <Text style={styles.subtitle}>{t('claim.notFoundDescription')}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/')}>
            <Text style={styles.primaryButtonText}>{t('claim.toHome')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#ff6b35" />
          <Text style={styles.title}>{isUnlocking ? t('claim.unlockingTitle') : t('claim.redirectingTitle')}</Text>
          <Text style={styles.subtitle}>{t('claim.unlockingDescription')}</Text>

          {unlockError ? (
            <>
              <Text style={styles.errorText}>{t('claim.unlockError')}</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  unlockStartedRef.current = false;
                  void unlockAndRedirect();
                }}
              >
                <Text style={styles.primaryButtonText}>{t('claim.retry')}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const steps = [t('claim.stepFound'), t('claim.stepAccount'), t('claim.stepDownload')];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('claim.headline')}</Text>
        <Text style={styles.subtitle}>{t('claim.subline')}</Text>

        {previewUrl ? (
          <View style={styles.previewCard}>
            <Image source={{ uri: previewUrl }} style={styles.previewImage} />
            <BlurView intensity={40} tint="dark" style={styles.previewBlur} />
            <View style={styles.previewOverlay}>
              <Text style={styles.previewBadge}>{t('claim.previewBadge')}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.bulletList}>
          <View style={styles.bulletRow}>
            <Check size={16} color="#00c851" />
            <Text style={styles.bulletText}>{t('claim.valueSpeed')}</Text>
          </View>
          <View style={styles.bulletRow}>
            <Check size={16} color="#00c851" />
            <Text style={styles.bulletText}>{t('claim.valueHd')}</Text>
          </View>
          <View style={styles.bulletRow}>
            <Check size={16} color="#00c851" />
            <Text style={styles.bulletText}>{t('claim.valueShare')}</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          {steps.map((step, index) => {
            const isCompleted = index === 0;
            const isCurrent = index === 1;
            return (
              <View key={step} style={styles.stepWrapper}>
                <View style={styles.stepLineWrap}>
                  {index > 0 ? (
                    <View style={[styles.stepLine, isCompleted || isCurrent ? styles.stepLineActive : null]} />
                  ) : null}
                  <View
                    style={[
                      styles.stepDot,
                      isCompleted ? styles.stepDotDone : null,
                      isCurrent ? styles.stepDotCurrent : null,
                    ]}
                  >
                    {isCompleted ? <Check size={12} color="#000" /> : null}
                  </View>
                </View>
                <Text style={styles.stepLabel}>{step}</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={openAuth}>
          <Text style={styles.primaryButtonText}>{t('claim.cta')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    ...(Platform.OS === 'web'
      ? {
          maxWidth: 428,
          marginHorizontal: 'auto',
          width: '100%',
        }
      : {}),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 18,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    gap: 14,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#bbb',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  bulletList: {
    backgroundColor: '#151515',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2b2b2b',
    padding: 14,
    gap: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  previewCard: {
    height: 165,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2b2b2b',
    backgroundColor: '#121212',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  previewBadge: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 6,
    marginBottom: 8,
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  stepLineWrap: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  stepLine: {
    position: 'absolute',
    left: -2,
    right: '50%',
    top: 8,
    height: 2,
    backgroundColor: '#333',
  },
  stepLineActive: {
    backgroundColor: '#ff6b35',
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    borderColor: '#00c851',
    backgroundColor: '#00c851',
  },
  stepDotCurrent: {
    borderColor: '#ff6b35',
  },
  stepLabel: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    fontSize: 14,
  },
});
