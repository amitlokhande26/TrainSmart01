import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'manager' | 'employee' | 'supervisor';

export interface User {
  type: UserRole | null;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: any | null;
  loading: boolean;
  needsPasswordReset: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level refs to persist across remounts
const previousSessionRef = { current: null as any | null };
const derivingRef = { current: false };
const loadingSetRef = { current: false };
const lastProcessedTimeRef = { current: 0 };

// Helper function to compare sessions deeply
const sessionsAreEqual = (session1: any | null, session2: any | null): boolean => {
  if (session1 === session2) return true;
  if (!session1 && !session2) return true;
  if (!session1 || !session2) return false;
  const id1 = session1.user?.id || null;
  const id2 = session2.user?.id || null;
  const token1 = session1.access_token || null;
  const token2 = session2.access_token || null;
  return id1 === id2 && token1 === token2;
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  const deriveUserFromSession = async (session: any | null) => {
    // Prevent multiple simultaneous calls
    if (derivingRef.current) {
      return;
    }
    
    // Check if session has actually changed
    if (sessionsAreEqual(session, previousSessionRef.current)) {
      return;
    }
    
    previousSessionRef.current = session;
    derivingRef.current = true;

    try {
      if (!session?.user) {
        // Only update state if values have changed
        setUser((prevUser) => {
          if (prevUser?.type === null && prevUser?.name === '') {
            return prevUser; // No change needed
          }
          return { type: null, name: '' };
        });
        setNeedsPasswordReset((prev) => {
          if (prev === false) return prev;
          return false;
        });
        return;
      }
      
      // Check if user needs password reset
      const needsPasswordReset = (session.user.app_metadata as any)?.needs_password_reset;
      
      if (needsPasswordReset) {
        setNeedsPasswordReset((prev) => {
          if (prev === true) return prev;
          return true;
        });
        setUser((prevUser) => {
          if (prevUser?.type === null && prevUser?.name === '') {
            return prevUser; // No change needed
          }
          return { type: null, name: '' }; // Keep user as null so LoginForm stays visible
        });
        return;
      }
      
      setNeedsPasswordReset((prev) => {
        if (prev === false) return prev;
        return false;
      });
      
      // Check if user is active; if this lookup fails (e.g., temporary RLS issue),
      // continue and rely on role metadata to avoid bouncing to login.
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('is_active')
          .eq('id', session.user.id)
          .single();

        if (!userError && userData && userData.is_active === false) {
          await supabase.auth.signOut();
          setUser({ type: null, name: '' });
          return;
        }
      } catch (_e) {
        // Ignore and continue; rely on metadata below
      }
      
      const role: string | undefined = (session.user.app_metadata as any)?.role || (session.user.user_metadata as any)?.role;
      const email = session.user.email || '';
      
      // Try to get first_name and last_name from the users table
      let displayName = 'User';
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', session.user.id)
          .single();
        
        if (userData && userData.first_name && userData.last_name) {
          displayName = `${userData.first_name} ${userData.last_name}`;
        } else {
          // Fallback to user metadata or email
          displayName = (session.user.user_metadata as any)?.full_name || email || 'User';
        }
      } catch (error) {
        // Fallback to user metadata or email
        displayName = (session.user.user_metadata as any)?.full_name || email || 'User';
      }
      
      // Map role to UserRole type - Manager is kept as distinct role
      let mappedRole: UserRole | null = null;
      if (role === 'admin') {
        mappedRole = 'admin';
      } else if (role === 'manager') {
        mappedRole = 'manager';
      } else if (role === 'supervisor') {
        mappedRole = 'supervisor';
      } else if (role) {
        mappedRole = 'employee';
      }
      
      setUser((prevUser) => {
        if (prevUser?.type === mappedRole && prevUser?.name === displayName) {
          return prevUser; // No change needed
        }
        return { type: mappedRole, name: displayName };
      });
    } finally {
      derivingRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) {
        return;
      }
      
      // Debounce: ignore if called within 100ms of last processing
      const now = Date.now();
      if (now - lastProcessedTimeRef.current < 100) {
        return;
      }
      
      // Only process if session actually changed
      if (!sessionsAreEqual(newSession, previousSessionRef.current)) {
        lastProcessedTimeRef.current = now;
        setSession(newSession);
        deriveUserFromSession(newSession);
      }
      
      // Only set loading to false once initially
      if (!loadingSetRef.current) {
        setLoading(false);
        loadingSetRef.current = true;
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) {
        return;
      }
      
      if (!sessionsAreEqual(session, previousSessionRef.current)) {
        setSession(session);
        deriveUserFromSession(session);
      }
      
      // Only set loading to false once initially
      if (!loadingSetRef.current) {
        setLoading(false);
        loadingSetRef.current = true;
      }
    }).catch((error) => {
      if (mounted && !loadingSetRef.current) {
        setLoading(false);
        loadingSetRef.current = true;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser({ type: null, name: '' });
    setSession(null);
    previousSessionRef.current = null;
  };

  const value = useMemo(() => ({
    user,
    session,
    loading,
    needsPasswordReset,
    signOut,
  }), [user, session, loading, needsPasswordReset]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useUser() {
  const { user } = useAuth();
  return user;
}

export function useSession() {
  const { session } = useAuth();
  return session;
}

