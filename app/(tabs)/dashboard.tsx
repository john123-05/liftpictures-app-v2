import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Clock, Zap, Target, Medal, TrendingUp, Trash2 } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  speed: number;
  time: string;
  isCurrentUser?: boolean;
}

interface Ride {
  id: string;
  user_id: string;
  ride_at: string;
  source: string;
  note: string | null;
  created_at: string;
}

const parseSpeedFromStoragePath = (storagePath?: string | null): number => {
  if (!storagePath) return 0;
  const fileName = storagePath.split('/').pop() || storagePath;
  const stem = fileName.replace(/\.[^.]+$/, '');
  const digits = stem.replace(/\D/g, '');
  if (digits.length < 4) return 0;
  const parsed = Number.parseInt(digits.slice(-4), 10);
  if (Number.isNaN(parsed)) return 0;
  return parsed / 100;
};

const resolveSpeed = (speedFromDb?: number | null, storagePath?: string | null): number => {
  if (typeof speedFromDb === 'number' && Number.isFinite(speedFromDb) && speedFromDb > 0) {
    return speedFromDb;
  }
  return parseSpeedFromStoragePath(storagePath);
};

const pickJoinedRecord = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
};

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveAvatarUrl = async (avatarRef?: string | null): Promise<string | null> => {
  if (!avatarRef) return null;
  if (avatarRef.startsWith('http')) return avatarRef;

  const { data: signedData } = await supabase.storage
    .from('avatars')
    .createSignedUrl(avatarRef, 60 * 60 * 24 * 365);

  if (signedData?.signedUrl) return signedData.signedUrl;

  const { data: publicData } = supabase.storage
    .from('avatars')
    .getPublicUrl(avatarRef);
  return publicData.publicUrl || null;
};

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const [ridesToday, setRidesToday] = useState(0);
  const [todayRides, setTodayRides] = useState<Ride[]>([]);
  const [topSpeed, setTopSpeed] = useState<number | null>(null);
  const [hasPurchasedPhotos, setHasPurchasedPhotos] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [dailyRank, setDailyRank] = useState<number | null>(null);
  const [rankingUserCount, setRankingUserCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchRidesToday();
      fetchTopSpeed();
      fetchLeaderboard();
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchRidesToday();
        fetchTopSpeed();
        fetchLeaderboard();
      }
    }, [user])
  );

  const fetchRidesToday = async () => {
    if (!user) return;

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('user_id', user.id)
        .gte('ride_at', startOfDay.toISOString())
        .lte('ride_at', endOfDay.toISOString())
        .order('ride_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      setRidesToday(data?.length || 0);
      setTodayRides(data || []);
    } catch (error) {
      console.error('Error fetching rides:', error);
    }
  };

  const fetchTopSpeed = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('unlocked_photos')
        .select(`
          photos!inner(speed_kmh, storage_path)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const speeds = (data || [])
        .map((entry: any) => {
          const photo = pickJoinedRecord<any>(entry.photos);
          return resolveSpeed(photo?.speed_kmh ?? null, photo?.storage_path ?? null);
        })
        .filter((speed: number) => speed > 0);

      if (speeds.length > 0) {
        const best = Math.max(...speeds);
        setTopSpeed(best);
        setHasPurchasedPhotos(true);
      } else {
        setTopSpeed(null);
        setHasPurchasedPhotos(false);
      }
    } catch (error) {
      console.error('Error fetching top speed:', error);
      setTopSpeed(null);
      setHasPurchasedPhotos(false);
    }
  };

  const fetchLeaderboard = async () => {
    if (!user) return;

    try {
      const today = new Date();
      const localDate = toLocalDateString(today);
      const utcDate = today.toISOString().slice(0, 10);
      const dateFilter = Array.from(new Set([localDate, utcDate]));

      const { data, error } = await supabase
        .from('leaderboard_entries')
        .select(`
          speed_kmh,
          user_id,
          photos!inner(captured_at, storage_path)
        `)
        .in('ride_date', dateFilter)
        .order('speed_kmh', { ascending: false })
        .limit(500);

      if (error) throw error;

      if (data && data.length > 0) {
        const topByUser = new Map<string, any>();

        for (const entry of data as any[]) {
          const userId = entry.user_id as string;
          if (!userId) continue;
          const photo = pickJoinedRecord<any>(entry.photos);
          const resolvedSpeed = resolveSpeed(entry.speed_kmh, photo?.storage_path);
          if (resolvedSpeed <= 0) continue;

          const existing = topByUser.get(userId);
          if (!existing || resolvedSpeed > existing.speed) {
            topByUser.set(userId, {
              userId,
              speed: resolvedSpeed,
              capturedAt: photo?.captured_at,
            });
          }
        }

        const userIds = Array.from(topByUser.keys());
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, vorname, nachname, avatar_url')
          .in('id', userIds);

        if (usersError) {
          console.error('Error fetching user profiles for leaderboard:', usersError);
        }

        const profileByUserId = new Map<string, { vorname: string | null; nachname: string | null; avatar_url: string | null }>();
        (usersData || []).forEach((row: any) => {
          profileByUserId.set(row.id, {
            vorname: row.vorname ?? null,
            nachname: row.nachname ?? null,
            avatar_url: row.avatar_url ?? null,
          });
        });

        const allRanked = Array.from(topByUser.values())
          .sort((a, b) => b.speed - a.speed)
          .map((entry, index) => {
            const capturedTime = entry.capturedAt ? new Date(entry.capturedAt) : null;
            const timeStr = capturedTime
              ? capturedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
              : '--:--';
            const profile = profileByUserId.get(entry.userId);
            const isCurrentUser = entry.userId === user.id;
            const displayName = isCurrentUser
              ? (user.display_name?.trim()
                || `${user.vorname || ''} ${user.nachname || ''}`.trim()
                || 'Du')
              : (profile?.vorname || profile?.nachname
                ? `${profile?.vorname || ''} ${profile?.nachname || ''}`.trim()
                : 'Anonymer Fahrer');
            const renderedName = isCurrentUser ? `${displayName} (${t('dashboard.you')})` : displayName;

            return {
              rank: index + 1,
              userId: entry.userId,
              name: renderedName,
              avatarUrl: isCurrentUser ? (user.avatar_url ?? profile?.avatar_url ?? null) : (profile?.avatar_url ?? null),
              speed: entry.speed,
              time: timeStr,
              isCurrentUser,
            } as LeaderboardEntry;
          });

        if (!allRanked.some((entry) => entry.userId === user.id)) {
          const startOfDay = new Date(today);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(today);
          endOfDay.setHours(23, 59, 59, 999);

          const { data: myTodayPhotos, error: myTodayPhotosError } = await supabase
            .from('unlocked_photos')
            .select(`
              photos!inner(speed_kmh, storage_path, captured_at)
            `)
            .eq('user_id', user.id);

          if (myTodayPhotosError) {
            console.error('Error fetching fallback user ranking:', myTodayPhotosError);
          } else {
            const bestMyEntry = (myTodayPhotos || [])
              .map((row: any) => pickJoinedRecord<any>(row.photos))
              .filter((photo: any) => {
                if (!photo?.captured_at) return false;
                const captured = new Date(photo.captured_at);
                return captured >= startOfDay && captured <= endOfDay;
              })
              .map((photo: any) => ({
                speed: resolveSpeed(photo?.speed_kmh ?? null, photo?.storage_path ?? null),
                capturedAt: photo?.captured_at,
              }))
              .filter((entry: any) => entry.speed > 0)
              .sort((a: any, b: any) => b.speed - a.speed)[0];

            if (bestMyEntry) {
              const profile = profileByUserId.get(user.id);
              const displayName = user.display_name?.trim()
                || `${user.vorname || ''} ${user.nachname || ''}`.trim()
                || (profile?.vorname || profile?.nachname
                  ? `${profile?.vorname || ''} ${profile?.nachname || ''}`.trim()
                  : 'Du');

              allRanked.push({
                rank: allRanked.length + 1,
                userId: user.id,
                name: `${displayName} (${t('dashboard.you')})`,
                avatarUrl: profile?.avatar_url ?? user.avatar_url ?? null,
                speed: bestMyEntry.speed,
                time: bestMyEntry.capturedAt
                  ? new Date(bestMyEntry.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                  : '--:--',
                isCurrentUser: true,
              });

              allRanked.sort((a, b) => b.speed - a.speed);
              allRanked.forEach((entry, index) => {
                entry.rank = index + 1;
              });
            }
          }
        }

        const rankedRaw = allRanked.slice(0, 10);
        const ranked = await Promise.all(
          rankedRaw.map(async (entry) => ({
            ...entry,
            avatarUrl: await resolveAvatarUrl(entry.avatarUrl),
          })),
        );
        setLeaderboardData(ranked);
        setRankingUserCount(allRanked.length);
        const me = allRanked.find((entry) => entry.userId === user.id);
        setDailyRank(me ? me.rank : null);
      } else {
        setLeaderboardData([]);
        setDailyRank(null);
        setRankingUserCount(0);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboardData([]);
      setDailyRank(null);
      setRankingUserCount(0);
    }
  };

  const formatRideTime = (rideAt: string) => {
    const date = new Date(rideAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'now':
        return t('rides.now');
      case 'manual':
        return t('rides.manual');
      default:
        return source;
    }
  };

  const deleteRide = async (rideId: string) => {
    if (!user) {
      console.error('No user found');
      return;
    }

    console.log('Attempting to delete ride:', rideId);

    if (Platform.OS === 'web') {
      if (!window.confirm('Fahrt wirklich löschen?')) {
        console.log('User cancelled delete');
        return;
      }
    }

    try {
      console.log('Deleting ride from Supabase...');
      const { error } = await supabase
        .from('rides')
        .delete()
        .eq('id', rideId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Supabase delete error:', error);
        alert(`Error: ${error.message}`);
        return;
      }

      console.log('Delete successful, refreshing...');
      await fetchRidesToday();
      console.log('Refresh complete');
    } catch (error: any) {
      console.error('Catch error:', error);
      alert(`Failed to delete: ${error.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <Text style={styles.title}>{t('dashboard.title')}</Text>
        <Text style={styles.subtitle}>{t('dashboard.subtitle')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Target size={24} color="#ff6b35" />
              <Text style={styles.statTitle}>{t('dashboard.ridesToday')}</Text>
            </View>
            <Text style={styles.statValue}>{ridesToday}</Text>
            <Text style={[styles.statSubtitle, { color: '#ff6b35' }]}>
              {ridesToday > 0 ? t('dashboard.personalRecord') : ''}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Clock size={24} color="#00c851" />
              <Text style={styles.statTitle}>{t('dashboard.bestTime')}</Text>
            </View>
            <Text style={styles.statValue}>--:--</Text>
            <Text style={[styles.statSubtitle, { color: '#00c851' }]}>
              {t('dashboard.newBestTime')}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Zap size={24} color="#2196f3" />
              <Text style={styles.statTitle}>{t('dashboard.topSpeed')}</Text>
            </View>
            {hasPurchasedPhotos && topSpeed !== null ? (
              <>
                <Text style={styles.statValue}>{topSpeed.toFixed(1)} km/h</Text>
                <Text style={[styles.statSubtitle, { color: '#2196f3' }]}>
                  {t('dashboard.achievedToday')}
                </Text>
              </>
            ) : (
              <Text style={styles.purchasePrompt}>
                Kaufe dein Foto, um hier zu erscheinen
              </Text>
            )}
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Trophy size={24} color="#ffc107" />
              <Text style={styles.statTitle}>{t('dashboard.dailyRanking')}</Text>
            </View>
            <Text style={styles.statValue}>{dailyRank ? `#${dailyRank}` : '-'}</Text>
            <Text style={[styles.statSubtitle, { color: '#ffc107' }]}>
              {t('dashboard.ofRiders', { count: rankingUserCount })}
            </Text>
          </View>
        </View>

        <View style={styles.todayRidesSection}>
          <View style={styles.sectionHeader}>
            <Clock size={24} color="#ff6b35" />
            <Text style={styles.sectionTitle}>{t('dashboard.myRidesToday')}</Text>
          </View>

          {todayRides.length > 0 ? (
            <View style={styles.todayRidesList}>
              {todayRides.map((ride) => (
                <View key={ride.id} style={styles.rideItem}>
                  <View style={styles.rideContent}>
                    <View style={styles.rideInfo}>
                      <View style={styles.rideTimeContainer}>
                        <Text style={styles.rideTime}>{formatRideTime(ride.ride_at)}</Text>
                        <Text style={styles.rideSource}>{getSourceLabel(ride.source)}</Text>
                      </View>
                      {ride.note && (
                        <Text style={styles.rideNote}>{ride.note}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => {
                        console.log('Delete button clicked for ride:', ride.id);
                        deleteRide(ride.id);
                      }}
                    >
                      <Trash2 size={18} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={styles.allRidesButton}
                onPress={() => router.push('/rides')}
              >
                <Text style={styles.allRidesButtonText}>{t('dashboard.allRides')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noRidesContainer}>
              <Text style={styles.noRidesText}>{t('dashboard.noRidesToday')}</Text>
            </View>
          )}
        </View>

        <View style={styles.achievementBanner}>
          <LinearGradient
            colors={['#ff6b35', '#ff8c42']}
            style={styles.achievementGradient}
          >
            <Medal size={32} color="#fff" />
            <View style={styles.achievementText}>
              <Text style={styles.achievementTitle}>{t('dashboard.newBestTimeAchievement')}</Text>
              <Text style={styles.achievementSubtitle}>
                {t('dashboard.improvedBestTime')}
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.leaderboardSection}>
          <View style={styles.sectionHeader}>
            <Trophy size={24} color="#ff6b35" />
            <Text style={styles.sectionTitle}>{t('dashboard.leaderboard')}</Text>
          </View>

          {leaderboardData.length > 0 ? (
            <View style={styles.leaderboard}>
              {leaderboardData.map((entry) => (
                <View
                  key={`${entry.userId}-${entry.rank}`}
                  style={[
                    styles.leaderboardEntry,
                    entry.isCurrentUser && styles.currentUserEntry
                  ]}
                >
                  <View style={styles.rankContainer}>
                    <Text style={[
                      styles.rank,
                      entry.rank <= 3 && styles.topRank,
                      entry.isCurrentUser && styles.currentUserRank
                    ]}>
                      {entry.rank}
                    </Text>
                    {entry.rank <= 3 && (
                      <Medal size={16} color={
                        entry.rank === 1 ? '#ffd700' :
                        entry.rank === 2 ? '#c0c0c0' :
                        '#cd7f32'
                      } />
                    )}
                  </View>

                  <View style={styles.entryInfo}>
                    <View style={styles.entryMainRow}>
                      {entry.avatarUrl ? (
                        <Image source={{ uri: entry.avatarUrl }} style={styles.entryAvatar} />
                      ) : (
                        <View style={styles.entryAvatarFallback}>
                          <Text style={styles.entryAvatarFallbackText}>
                            {(entry.name || '?').trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.entryTextBlock}>
                        <Text style={[
                          styles.entryName,
                          entry.isCurrentUser && styles.currentUserName
                        ]}>
                          {entry.name}
                        </Text>
                        <Text style={[
                          styles.entryStats,
                          entry.isCurrentUser && styles.currentUserName
                        ]}>
                          {entry.speed.toFixed(2)} km/h • {entry.time}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {entry.isCurrentUser && (
                    <View style={styles.currentUserIndicator}>
                      <TrendingUp size={16} color="#ff6b35" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.leaderboardPlaceholder}>
              <Trophy size={48} color="#666" />
              <Text style={styles.leaderboardPlaceholderText}>
                Schließe den Kauf deines Fotos ab, um im Ranking zu erscheinen
              </Text>
            </View>
          )}
        </View>

        <View style={styles.motivationSection}>
          <Text style={styles.motivationTitle}>{t('dashboard.nextGoal')}</Text>
          <Text style={styles.motivationText}>
            {t('dashboard.nextGoalDescription')}
          </Text>
          <TouchableOpacity
            style={styles.motivationButton}
            onPress={() => router.push('/(tabs)?captureRide=1')}
          >
            <Text style={styles.motivationButtonText}>{t('dashboard.startNewRide')}</Text>
          </TouchableOpacity>
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statTitle: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  achievementBanner: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  achievementGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  achievementText: {
    marginLeft: 16,
    flex: 1,
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  achievementSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  leaderboardSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  leaderboard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  currentUserEntry: {
    backgroundColor: '#2a2a2a',
    borderColor: '#ff6b35',
    borderWidth: 1,
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#999',
    marginRight: 8,
  },
  topRank: {
    color: '#ff6b35',
  },
  currentUserRank: {
    color: '#ff6b35',
  },
  entryInfo: {
    flex: 1,
  },
  entryMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    marginRight: 10,
  },
  entryAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  entryAvatarFallbackText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  entryTextBlock: {
    flex: 1,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  currentUserName: {
    color: '#ff6b35',
  },
  entryStats: {
    fontSize: 14,
    color: '#999',
  },
  currentUserIndicator: {
    padding: 4,
  },
  motivationSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 100,
    alignItems: 'center',
  },
  motivationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  motivationText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  motivationButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  motivationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  todayRidesSection: {
    marginBottom: 24,
  },
  todayRidesList: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  rideItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  rideContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rideInfo: {
    flex: 1,
  },
  rideTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rideTime: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  rideSource: {
    fontSize: 14,
    color: '#999',
  },
  rideNote: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  allRidesButton: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    alignItems: 'center',
  },
  allRidesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b35',
  },
  noRidesContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  noRidesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  purchasePrompt: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },
  leaderboardPlaceholder: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardPlaceholderText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
});
