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
  const [hasAccess, setHasAccess] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Access gate disabled: app is always directly accessible.
    setHasAccess(true);
    setIsLoading(false);
  }, []);

  const checkPassword = async (password: string): Promise<boolean> => {
    void password;
    setHasAccess(true);
    return true;
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('site_access_granted');
      setHasAccess(true);
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
