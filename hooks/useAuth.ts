import { useCallback, useEffect, useState } from 'react';
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

export interface ParkMembership {
  park_id: string;
  name: string;
  slug: string;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  const fetchUserParksByUserId = useCallback(async (userId: string): Promise<{ data: ParkMembership[]; error: any }> => {
    try {
      const { data: membershipRows, error: membershipError } = await supabase
        .from('user_parks')
        .select('park_id')
        .eq('user_id', userId);

      if (membershipError) {
        return { data: [], error: membershipError };
      }

      const parkIds = Array.from(new Set((membershipRows || []).map((row: any) => row.park_id).filter(Boolean)));
      if (parkIds.length === 0) return { data: [], error: null };

      const { data: parks, error: parksError } = await supabase
        .from('parks')
        .select('id, name, slug, is_active')
        .in('id', parkIds)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (parksError) {
        return { data: [], error: parksError };
      }

      const mapped: ParkMembership[] = (parks || []).map((park: any) => ({
        park_id: park.id,
        name: park.name,
        slug: park.slug,
      }));

      return { data: mapped, error: null };
    } catch (error: any) {
      return { data: [], error };
    }
  }, []);

  const ensureParkMembership = useCallback(async (userId: string, parkId: string) => {
    const { error } = await supabase
      .from('user_parks')
      .upsert(
        {
          user_id: userId,
          park_id: parkId,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'user_id,park_id' }
      );

    if (error) throw error;
  }, []);

  const applyActivePark = useCallback(async (userId: string, parkId: string, updateLocalState: boolean = true) => {
    const { error: updateProfileError } = await supabase
      .from('users')
      .update({ park_id: parkId } as any)
      .eq('id', userId);

    if (updateProfileError) throw updateProfileError;

    await supabase.auth.updateUser({
      data: {
        park_id: parkId,
      },
    });

    if (updateLocalState) {
      setAuthState((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, park_id: parkId } : prev.user,
      }));
    }
  }, []);

  const loadUserProfile = useCallback(async (session: Session) => {
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
        const resolvedParkId = userData.park_id ?? DEFAULT_PARK_ID;
        await ensureParkMembership(userData.id, resolvedParkId);

        setAuthState({
          user: {
            id: userData.id,
            email: session.user.email || '',
            vorname: userData.vorname,
            nachname: userData.nachname,
            created_at: userData.created_at,
            park_id: resolvedParkId,
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
        await ensureParkMembership(resolvedProfile.id, resolvedProfile.park_id ?? metadataParkId);

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
  }, [ensureParkMembership]);

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
  }, [loadUserProfile]);

  const signIn = async (email: string, password: string, preferredParkId?: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { data: null, error, success: false };
      }

      const userId = data.user?.id;
      if (!userId) {
        return { data: null, error: { message: 'Login did not return a user.' }, success: false };
      }

      let { data: parks, error: parksError } = await fetchUserParksByUserId(userId);
      if (parksError) {
        return { data: null, error: parksError, success: false };
      }

      // Safety: if legacy users are missing membership rows, rebuild from users.park_id.
      if (parks.length === 0) {
        const { data: profileRow, error: profileError } = await supabase
          .from('users')
          .select('park_id')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) {
          return { data: null, error: profileError, success: false };
        }

        const fallbackParkId = profileRow?.park_id ?? DEFAULT_PARK_ID;
        await ensureParkMembership(userId, fallbackParkId);

        const refreshed = await fetchUserParksByUserId(userId);
        if (refreshed.error) {
          return { data: null, error: refreshed.error, success: false };
        }
        parks = refreshed.data;
      }

      if (preferredParkId) {
        const hasPark = parks.some((park) => park.park_id === preferredParkId);
        if (!hasPark) {
          return {
            data: null,
            error: { message: 'Selected park is not linked to this account.' },
            success: false,
          };
        }

        await applyActivePark(userId, preferredParkId, false);

        // Ensure local auth state is refreshed immediately after explicit park selection.
        const activeSession = data.session ?? (await supabase.auth.getSession()).data.session;
        if (activeSession?.user) {
          await loadUserProfile(activeSession);
        }
      } else if (parks.length === 1) {
        await applyActivePark(userId, parks[0].park_id, false);

        const activeSession = data.session ?? (await supabase.auth.getSession()).data.session;
        if (activeSession?.user) {
          await loadUserProfile(activeSession);
        }
      }

      if (!preferredParkId && parks.length > 1) {
        return {
          data,
          error: null,
          success: true,
          requiresParkSelection: true,
          parks,
        };
      }

      return { data, error: null, success: true, parks };
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
        const isAlreadyRegistered = error.message?.includes('User already registered');
        if (!isAlreadyRegistered) {
          console.error('Supabase signUp error:', error);
          return { data: null, error, success: false };
        }
      }

      const identities = (data?.user as any)?.identities;
      const existingUser = Boolean(error?.message?.includes('User already registered')) || (Array.isArray(identities) && identities.length === 0);

      if (existingUser) {
        if (!parkId) {
          return {
            data: null,
            error: { message: 'Select a park to link this existing account.' },
            success: false,
          };
        }

        const signInResult = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInResult.error || !signInResult.data.user) {
          return {
            data: null,
            error: signInResult.error || { message: 'Invalid credentials for existing account.' },
            success: false,
          };
        }

        const existingUserId = signInResult.data.user.id;

        await ensureParkMembership(existingUserId, parkId);
        await applyActivePark(existingUserId, parkId, false);

        return {
          data: signInResult.data,
          error: null,
          success: true,
          existingUserLinkedPark: true,
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

  const getUserParks = async (userId?: string) => {
    const resolvedUserId = userId || authState.user?.id;
    if (!resolvedUserId) {
      return { data: [] as ParkMembership[], error: { message: 'No user' }, success: false };
    }

    const result = await fetchUserParksByUserId(resolvedUserId);
    return { data: result.data, error: result.error, success: !result.error };
  };

  const resolveCurrentUserId = async (): Promise<string | null> => {
    if (authState.user?.id) return authState.user.id;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;

    return null;
  };

  const switchPark = async (parkId: string) => {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return { success: false, error: { message: 'Not authenticated' } };
    }

    try {
      const { data: parks, error: parksError } = await fetchUserParksByUserId(userId);
      if (parksError) return { success: false, error: parksError };

      if (!parks.some((park) => park.park_id === parkId)) {
        return { success: false, error: { message: 'Park membership not found.' } };
      }

      await applyActivePark(userId, parkId);

      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error };
    }
  };

  const addCurrentUserToPark = async (parkId: string) => {
    const userId = await resolveCurrentUserId();
    if (!userId) return { success: false, error: { message: 'Not authenticated' } };

    try {
      await ensureParkMembership(userId, parkId);
      await applyActivePark(userId, parkId);
      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error };
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
    getUserParks,
    switchPark,
    addCurrentUserToPark,
  };
}
