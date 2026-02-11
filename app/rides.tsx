import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, Clock, ArrowLeft } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

interface Ride {
  id: string;
  user_id: string;
  ride_at: string;
  source: string;
  note: string | null;
  created_at: string;
}

interface GroupedRides {
  [key: string]: Ride[];
}

export default function RidesScreen() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAllRides();
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchAllRides();
      }
    }, [user])
  );

  const fetchAllRides = async () => {
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
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setLoading(false);
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

      console.log('Delete successful, updating local state...');
      setRides(prev => prev.filter(r => r.id !== rideId));
      console.log('Local state updated');
    } catch (error: any) {
      console.error('Catch error:', error);
      alert(`Failed to delete: ${error.message}`);
    }
  };

  const formatRideDateTime = (rideAt: string) => {
    const date = new Date(rideAt);
    return {
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      date: date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' }),
    };
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

  const groupRidesByDay = (): GroupedRides => {
    const grouped: GroupedRides = {};

    rides.forEach(ride => {
      const date = new Date(ride.ride_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dayLabel = '';
      if (date.toDateString() === today.toDateString()) {
        dayLabel = t('rides.today');
      } else if (date.toDateString() === yesterday.toDateString()) {
        dayLabel = t('rides.yesterday');
      } else {
        dayLabel = date.toLocaleDateString([], {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }

      if (!grouped[dayLabel]) {
        grouped[dayLabel] = [];
      }
      grouped[dayLabel].push(ride);
    });

    return grouped;
  };

  const groupedRides = groupRidesByDay();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('rides.myRides')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {rides.length > 0 ? (
          Object.entries(groupedRides).map(([day, dayRides]) => (
            <View key={day} style={styles.daySection}>
              <Text style={styles.dayTitle}>{day}</Text>
              <View style={styles.dayRidesList}>
                {dayRides.map((ride) => {
                  const { time, date } = formatRideDateTime(ride.ride_at);
                  return (
                    <View key={ride.id} style={styles.rideCard}>
                      <View style={styles.rideContent}>
                        <View style={styles.rideInfo}>
                          <View style={styles.rideTimeRow}>
                            <Clock size={20} color="#ff6b35" />
                            <Text style={styles.rideTime}>{time}</Text>
                          </View>
                          <View style={styles.rideDetails}>
                            <Text style={styles.rideSource}>{getSourceLabel(ride.source)}</Text>
                            {ride.note && (
                              <Text style={styles.rideNote}>{ride.note}</Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => {
                            console.log('Delete button clicked for ride:', ride.id);
                            deleteRide(ride.id);
                          }}
                        >
                          <Trash2 size={20} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Clock size={48} color="#666" />
            <Text style={styles.emptyTitle}>{t('rides.noRides')}</Text>
            <Text style={styles.emptyText}>{t('rides.noRidesDescription')}</Text>
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  daySection: {
    marginBottom: 24,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  dayRidesList: {
    gap: 12,
  },
  rideCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  rideContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rideInfo: {
    flex: 1,
  },
  rideTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rideTime: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  rideDetails: {
    marginLeft: 28,
  },
  rideSource: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  rideNote: {
    fontSize: 14,
    color: '#ccc',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
