import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_STORAGE_KEY = 'qr_session_id';

export interface QRSession {
  sessionId: string;
  timestamp: string;
  expiresAt: string;
}

export function useQRSession() {
  const [currentSession, setCurrentSession] = useState<QRSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const sessionData = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionData) {
        const session: QRSession = JSON.parse(sessionData);
        
        // Check if session is still valid (24 hours)
        const now = new Date();
        const expiresAt = new Date(session.expiresAt);
        
        if (now < expiresAt) {
          setCurrentSession(session);
        } else {
          // Session expired, remove it
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading QR session:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async (sessionId: string) => {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      const session: QRSession = {
        sessionId,
        timestamp: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      setCurrentSession(session);
    } catch (error) {
      console.error('Error saving QR session:', error);
    }
  };

  const clearSession = async () => {
    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      setCurrentSession(null);
    } catch (error) {
      console.error('Error clearing QR session:', error);
    }
  };

  const isSessionValid = () => {
    if (!currentSession) return false;
    
    const now = new Date();
    const expiresAt = new Date(currentSession.expiresAt);
    
    return now < expiresAt;
  };

  return {
    currentSession,
    loading,
    saveSession,
    clearSession,
    isSessionValid,
  };
}