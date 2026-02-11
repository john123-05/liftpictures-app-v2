import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  email: string;
  vorname: string;
  nachname: string;
  created_at: string;
}

export interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          await loadUserProfile(session);
        } else {
          setAuthState({
            user: null,
            session: null,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setAuthState({
            user: null,
            session: null,
            loading: false,
          });
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!mounted) return;

        if (session?.user) {
          await loadUserProfile(session);
        } else {
          setAuthState({
            user: null,
            session: null,
            loading: false,
          });
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (session: Session) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading user profile:', error);
        setAuthState({
          user: null,
          session,
          loading: false,
        });
        return;
      }

      if (userData) {
        setAuthState({
          user: {
            id: userData.id,
            email: session.user.email || '',
            vorname: userData.vorname,
            nachname: userData.nachname,
            created_at: userData.created_at,
          },
          session,
          loading: false,
        });
      } else {
        setAuthState({
          user: null,
          session,
          loading: false,
        });
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      setAuthState({
        user: null,
        session,
        loading: false,
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { data: null, error, success: false };
      }

      return { data, error: null, success: true };
    } catch (error: any) {
      return { data: null, error, success: false };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        return { data: null, error, success: false };
      }

      return { data, error: null, success: true };
    } catch (error: any) {
      return { data: null, error, success: false };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error, success: false };
      }

      setAuthState({
        user: null,
        session: null,
        loading: false,
      });

      return { error: null, success: true };
    } catch (error: any) {
      return { error, success: false };
    }
  };

  const signInAsDemo = async () => {
    return { data: null, error: { message: 'Demo login is no longer available. Please create an account.' }, success: false };
  };

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
    signInAsDemo,
  };
}