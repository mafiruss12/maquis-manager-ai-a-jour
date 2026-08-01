import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Member, AccessRequest } from './types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  member: Member | null;
  accessRequest: AccessRequest | null;
  loading: boolean;
  needsAccess: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAccess, setNeedsAccess] = useState(false);

  async function loadMemberData(currentUser: User) {
    const { data: existingMember } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (existingMember) {
      setMember(existingMember as Member);
      setAccessRequest(null);
      setNeedsAccess(false);
      return;
    }

    setMember(null);

    const { data: req } = await supabase
      .from('access_requests')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (req && req.status === 'pending') {
      setAccessRequest(req as AccessRequest);
      setNeedsAccess(true);
    } else {
      setAccessRequest(null);
      setNeedsAccess(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadMemberData(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        (async () => {
          await loadMemberData(newSession.user);
          setLoading(false);
        })();
      } else {
        setMember(null);
        setAccessRequest(null);
        setNeedsAccess(false);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin');

      if ((count ?? 0) === 0) {
        await supabase.from('members').insert({
          user_id: data.user.id,
          email,
          full_name: fullName,
          role: 'super_admin',
          status: 'active',
        });
      } else {
        await supabase.from('access_requests').insert({
          email,
          full_name: fullName,
          auth_provider: 'email',
          user_id: data.user.id,
          status: 'pending',
        });
      }
    }
    return { error: null };
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMember(null);
    setAccessRequest(null);
    setNeedsAccess(false);
  }

  async function refresh() {
    if (user) {
      setLoading(true);
      await loadMemberData(user);
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, user, member, accessRequest, loading, needsAccess, signIn, signUp, signInWithGoogle, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
