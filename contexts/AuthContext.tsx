import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth, AuthState, ParkMembership } from '@/hooks/useAuth';

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string, preferredParkId?: string) => Promise<any>;
  signUp: (email: string, password: string, firstName: string, lastName: string, parkId?: string) => Promise<any>;
  signOut: () => Promise<any>;
  signInAsDemo: () => Promise<any>;
  getUserParks: (userId?: string) => Promise<{ data: ParkMembership[]; error: any; success: boolean }>;
  switchPark: (parkId: string) => Promise<{ success: boolean; error: any }>;
  addCurrentUserToPark: (parkId: string) => Promise<{ success: boolean; error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
