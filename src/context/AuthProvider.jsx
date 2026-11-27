import { useEffect, useState, useCallback, useMemo } from 'react';
import supabase from '../SupabaseClient';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch or create user profile in public.users
  const fetchUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setRole(null);
      setProfile(null);
      return null;
    }

    try {
      // 1. Try finding by auth user ID
      const { data: userById, error: idError } = await supabase
        .from('users')
        .select('id, email, role, user_name, user_avatar')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!idError && userById) {
        const resolvedRole = userById.role || 'student';
        setRole(resolvedRole);
        setProfile(userById);
        return userById;
      }

      // 2. Fallback: try finding by email
      if (authUser.email) {
        const { data: userByEmail } = await supabase
          .from('users')
          .select('id, email, role, user_name, user_avatar')
          .eq('email', authUser.email)
          .maybeSingle();

        if (userByEmail) {
          const resolvedRole = userByEmail.role || 'student';
          setRole(resolvedRole);
          setProfile(userByEmail);
          return userByEmail;
        }
      }

      // 3. New user registration: insert default student record
      const defaultName = authUser.user_metadata?.full_name || 
                          authUser.user_metadata?.name || 
                          (authUser.email ? authUser.email.split('@')[0] : 'Student');
      const defaultAvatar = authUser.user_metadata?.avatar_url || null;

      const newRecord = {
        id: authUser.id,
        email: authUser.email,
        role: 'student',
        user_name: defaultName,
        user_avatar: defaultAvatar,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .upsert(newRecord, { onConflict: 'email' })
        .select('id, email, role, user_name, user_avatar')
        .maybeSingle();

      if (insertError) {
        console.warn('[AuthContext] User auto-provision notice (non-fatal):', insertError.message);
      }

      const finalProfile = inserted || newRecord;
      setRole(finalProfile.role || 'student');
      setProfile(finalProfile);
      return finalProfile;
    } catch (err) {
      console.error('[AuthContext] Error in fetchUserProfile:', err);
      // Graceful fallback: treat as student on transient DB error
      setRole('student');
      return null;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user || null);

      if (currentSession?.user) {
        await fetchUserProfile(currentSession.user);
      } else {
        setRole(null);
        setProfile(null);
      }
    } catch (err) {
      console.error('[AuthContext] Error in refreshSession:', err);
    }
  }, [fetchUserProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] SignOut notice:', err);
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setProfile(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Fast-path: read cached session from localStorage immediately
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('[AuthContext] Error reading initial session:', sessionError);
        }

        if (isMounted) {
          if (initialSession?.user) {
            setSession(initialSession);
            setUser(initialSession.user);
            await fetchUserProfile(initialSession.user);
          } else {
            setSession(null);
            setUser(null);
            setRole(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('[AuthContext] Error during auth initialization:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for all auth state changes (sign-in, token refresh, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setRole(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await fetchUserProfile(currentSession.user);
        } else {
          setUser(null);
          setSession(null);
          setRole(null);
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [fetchUserProfile]);

  const value = useMemo(() => ({
    user,
    session,
    role,
    profile,
    loading,
    signOut,
    refreshSession,
  }), [user, session, role, profile, loading, signOut, refreshSession]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

