import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const DEFAULT_PARK_ID = '11111111-1111-1111-1111-111111111111';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UserProfile {
  id: string;
  email: string;
  vorname: string;
  nachname: string;
  created_at: string;
  park_id?: string | null;
  avatar_url?: string | null;
  display_name?: string | null;
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
            park_id: userData.park_id ?? DEFAULT_PARK_ID,
            avatar_url: userData.avatar_url ?? session.user.user_metadata?.avatar_url ?? null,
            display_name: userData.display_name ?? session.user.user_metadata?.display_name ?? null,
          },
          session,
          loading: false,
        });
      } else {
        const metadataParkId = typeof session.user.user_metadata?.park_id === 'string'
          && UUID_REGEX.test(session.user.user_metadata.park_id)
          ? session.user.user_metadata.park_id
          : DEFAULT_PARK_ID;

        // Fallback: if trigger-based profile creation failed, create/update profile from auth metadata.
        const profilePayload = {
          id: session.user.id,
          email: session.user.email || '',
          vorname: session.user.user_metadata?.first_name || '',
          nachname: session.user.user_metadata?.last_name || '',
          park_id: metadataParkId,
        } as any;

        const { data: upsertedProfile, error: upsertError } = await supabase
          .from('users')
          .upsert(profilePayload, { onConflict: 'id' })
          .select('*')
          .maybeSingle();

        if (upsertError) {
          console.error('Error creating fallback user profile:', upsertError);
        }

        const resolvedProfile = upsertedProfile || profilePayload;
        setAuthState({
          user: {
            id: resolvedProfile.id,
            email: resolvedProfile.email || session.user.email || '',
            vorname: resolvedProfile.vorname || '',
            nachname: resolvedProfile.nachname || '',
            created_at: resolvedProfile.created_at || session.user.created_at || new Date().toISOString(),
            park_id: resolvedProfile.park_id ?? metadataParkId,
            avatar_url: resolvedProfile.avatar_url ?? session.user.user_metadata?.avatar_url ?? null,
            display_name: resolvedProfile.display_name ?? session.user.user_metadata?.display_name ?? null,
          },
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

  const signUp = async (email: string, password: string, firstName: string, lastName: string, parkId?: string) => {
    try {
      const redirectUrl =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/auth`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            park_id: parkId ?? null,
          },
          ...(redirectUrl ? { emailRedirectTo: redirectUrl } : {}),
        },
      });

      if (error) {
        console.error('Supabase signUp error:', error);
        return { data: null, error, success: false };
      }

      const identities = (data?.user as any)?.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        return {
          data: null,
          error: { message: 'User already registered' },
          success: false,
        };
      }

      if (!data?.user) {
        return {
          data: null,
          error: { message: 'Signup did not return a user object.' },
          success: false,
        };
      }

      return { data, error: null, success: true };
    } catch (error: any) {
      console.error('Unexpected signUp error:', error);
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
