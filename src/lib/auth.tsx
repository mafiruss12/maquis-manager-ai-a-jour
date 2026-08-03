import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { toAuthEmail } from './login';
import type { Member, AccessRequest, Establishment } from './types';

export interface MyEstablishment extends Establishment {
  member_role?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  member: Member | null;
  accessRequest: AccessRequest | null;
  loading: boolean;
  needsAccess: boolean;
  /** Établissements auxquels l'utilisateur est rattaché (phase 2) */
  myEstablishments: MyEstablishment[];
  activeEstablishment: MyEstablishment | null;
  switchEstablishment: (establishmentId: string) => Promise<void>;
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
  const [myEstablishments, setMyEstablishments] = useState<MyEstablishment[]>([]);
  const [activeEstablishment, setActiveEstablishment] = useState<MyEstablishment | null>(null);

  async function loadMyEstablishments(currentUser: User, currentMember: Member | null) {
    const { data: links } = await supabase
      .from('member_establishments')
      .select('establishment_id, role, status')
      .eq('user_id', currentUser.id)
      .eq('status', 'active');

    let estIds = (links ?? []).map((l) => l.establishment_id);
    if (currentMember?.establishment_id && !estIds.includes(currentMember.establishment_id)) {
      estIds = [...estIds, currentMember.establishment_id];
    }

    // Propriétaire / admin / super_admin : aussi les établissements créés
    if (currentMember && ['super_admin', 'admin', 'owner'].includes(currentMember.role)) {
      const { data: owned } = await supabase
        .from('establishments')
        .select('id')
        .eq('created_by', currentUser.id);
      for (const o of owned ?? []) {
        if (!estIds.includes(o.id)) estIds.push(o.id);
      }
    }

    if (estIds.length === 0) {
      setMyEstablishments([]);
      setActiveEstablishment(null);
      return;
    }

    const { data: ests } = await supabase.from('establishments').select('*').in('id', estIds);
    const roleMap = new Map((links ?? []).map((l) => [l.establishment_id, l.role]));
    const list: MyEstablishment[] = (ests ?? []).map((e) => ({
      ...(e as Establishment),
      member_role: roleMap.get(e.id) ?? currentMember?.role,
    }));
    setMyEstablishments(list);

    const active =
      list.find((e) => e.id === currentMember?.establishment_id) ?? list[0] ?? null;
    setActiveEstablishment(active);
  }

  async function switchEstablishment(establishmentId: string) {
    if (!user || !member) return;
    const target = myEstablishments.find((e) => e.id === establishmentId);
    const role = (target?.member_role as Member['role']) || member.role;

    await supabase
      .from('members')
      .update({ establishment_id: establishmentId, role })
      .eq('user_id', user.id);

    await supabase.from('member_establishments').upsert(
      {
        user_id: user.id,
        establishment_id: establishmentId,
        role,
        status: 'active',
      },
      { onConflict: 'user_id,establishment_id' }
    );

    await loadMemberData(user);
  }

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
      await loadMyEstablishments(currentUser, existingMember as Member);
      return;
    }

    // Aucun membre → création automatique (plus de validation / attente)
    const email = currentUser.email ?? '';
    const fullName =
      (currentUser.user_metadata?.full_name as string) ||
      (currentUser.user_metadata?.name as string) ||
      email.split('@')[0] ||
      'Utilisateur';

    // Premier utilisateur = super_admin, les suivants = employee
    const { count } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'super_admin');

    const role = (count ?? 0) === 0 ? 'super_admin' : 'employee';

    const { data: newMember, error } = await supabase
      .from('members')
      .insert({
        user_id: currentUser.id,
        email,
        full_name: fullName,
        role,
        status: 'active',
      })
      .select()
      .single();

    if (!error && newMember) {
      setMember(newMember as Member);
      await loadMyEstablishments(currentUser, newMember as Member);
    } else {
      setMember(null);
      setMyEstablishments([]);
      setActiveEstablishment(null);
    }
    setAccessRequest(null);
    setNeedsAccess(false);
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

  async function signIn(login: string, password: string) {
    const email = toAuthEmail(login);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(login: string, password: string, fullName: string) {
    const email = toAuthEmail(login);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      // Premier utilisateur = super_admin, les suivants = employee
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin');

      const role = (count ?? 0) === 0 ? 'super_admin' : 'employee';

      await supabase.from('members').insert({
        user_id: data.user.id,
        email,
        full_name: fullName,
        role,
        status: 'active',
      });
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
    setMyEstablishments([]);
    setActiveEstablishment(null);
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
      value={{
        session,
        user,
        member,
        accessRequest,
        loading,
        needsAccess,
        myEstablishments,
        activeEstablishment,
        switchEstablishment,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refresh,
      }}
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
