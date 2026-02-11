import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, X } from 'lucide-react-native';
import { useQRSession } from '@/hooks/useQRSession';

interface SessionBannerProps {
  onDismiss?: () => void;
}

export default function SessionBanner({ onDismiss }: SessionBannerProps) {
  const { currentSession, clearSession, isSessionValid } = useQRSession();

  if (!currentSession || !isSessionValid()) {
    return null;
  }

  const handleDismiss = () => {
    clearSession();
    onDismiss?.();
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const expiresAt = new Date(currentSession.expiresAt);
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <Clock size={16} color="#ff6b35" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Aktive Session</Text>
          <Text style={styles.subtitle}>
            Läuft ab in {getTimeRemaining()}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
        <X size={16} color="#666" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b35',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
  },
  dismissButton: {
    padding: 4,
  },
});