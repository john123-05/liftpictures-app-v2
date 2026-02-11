import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AccessContextType {
  hasAccess: boolean;
  isLoading: boolean;
  checkPassword: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AccessContext = createContext<AccessContextType | undefined>(undefined);

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkExistingAccess = async () => {
      try {
        const granted = await AsyncStorage.getItem('site_access_granted');
        if (granted === 'true') {
          setHasAccess(true);
        }
      } catch (error) {
        console.error('Error checking access:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingAccess();
  }, []);

  const checkPassword = async (password: string): Promise<boolean> => {
    const correctPassword = 'liftpictures-demo123';
    const isCorrect = password === correctPassword;

    if (isCorrect) {
      try {
        await AsyncStorage.setItem('site_access_granted', 'true');
        setHasAccess(true);
      } catch (error) {
        console.error('Error saving access:', error);
        return false;
      }
    }

    return isCorrect;
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('site_access_granted');
      setHasAccess(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <AccessContext.Provider value={{ hasAccess, isLoading, checkPassword, logout }}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = () => {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
};
