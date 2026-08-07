import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { toAuthEmail } from './login';
import { isOnline, cacheAuthProfile, getCachedAuthProfile, prefetchForOffline } from './offline';
import { getLoginLockRemaining, registerLoginFailure, registerLoginSuccess, isSafeLogin, safeErrorMessage } from './security';
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
    try {
      const { data: links } = await supabase
        .from('member_establishments')
        .select('establishment_id, role, status')
        .eq('user_id', currentUser.id)
        .eq('status', 'active');

      let estIds = (links ?? []).map((l) => l.establishment_id);
      if (currentMember?.establishment_id && !estIds.includes(currentMember.establishment_id)) {
        estIds = [...estIds, currentMember.establishment_id];
      }

      if (currentMember && ['super_admin', 'admin', 'owner'].includes(currentMember.role)) {
        const { data: owned } = await supabase
          .from('establishments')
          .select('id')
          .eq('created_by', currentUser.id);
        for (const o of owned ?? []) {
          if (!estIds.includes(o.id)) estIds.push(o.id);
        }
      }

      let list: MyEstablishment[] = [];
      const roleMap = new Map((links ?? []).map((l) => [l.establishment_id, l.role]));

      if (estIds.length > 0) {
        const { data: ests } = await supabase.from('establishments').select('*').in('id', estIds);
        list = (ests ?? []).map((e) => ({
          ...(e as Establishment),
          member_role: roleMap.get(e.id) ?? currentMember?.role,
        }));
      }

      // Filet de sécurité : si le membre a un establishment_id mais la liste est vide (RLS)
      if (list.length === 0 && currentMember?.establishment_id) {
        const { data: one } = await supabase
          .from('establishments')
          .select('*')
          .eq('id', currentMember.establishment_id)
          .maybeSingle();
        if (one) {
          list = [{ ...(one as Establishment), member_role: currentMember.role }];
        }
      }

      setMyEstablishments(list);
      const active =
        list.find((e) => e.id === currentMember?.establishment_id) ?? list[0] ?? null;
      setActiveEstablishment(active);
    } catch (e) {
      console.error('loadMyEstablishments', e);
      setMyEstablishments([]);
      setActiveEstablishment(null);
    }
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
    try {
    if (!isOnline()) {
      const cached = await getCachedAuthProfile(currentUser.id);
      if (cached?.member) {
        setMember(cached.member as Member);
        setAccessRequest(null);
        setNeedsAccess(false);
        return;
      }
    }
    let { data: existingMember } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    // Auto-lier un établissement créé par cet utilisateur s'il n'en a pas
    if (existingMember && !existingMember.establishment_id) {
      const { data: owned } = await supabase
        .from('establishments')
        .select('id')
        .eq('created_by', currentUser.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (owned?.id) {
        await supabase
          .from('members')
          .update({ establishment_id: owned.id })
          .eq('user_id', currentUser.id);
        const { data: refreshed } = await supabase
          .from('members')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (refreshed) existingMember = refreshed;
      }
    }

    if (existingMember) {
      setMember(existingMember as Member);
      setAccessRequest(null);
      setNeedsAccess(false);
      await loadMyEstablishments(currentUser, existingMember as Member);
      try {
        await cacheAuthProfile({
          userId: currentUser.id,
          member: existingMember,
        });
        if (existingMember.establishment_id) {
          await prefetchForOffline(existingMember.establishment_id, supabase);
        }
      } catch { /* offline cache optional */ }
      return;
    }

    // Nouveau compte → employé actif (accès app). Création d'établissement via TypePicker.
    const email = currentUser.email ?? '';
    const fullName =
      (currentUser.user_metadata?.full_name as string) ||
      (currentUser.user_metadata?.name as string) ||
      email.split('@')[0] ||
      'Utilisateur';

    const { data: newMember, error } = await supabase
      .from('members')
      .insert({
        user_id: currentUser.id,
        email,
        full_name: fullName,
        role: 'employee',
        status: 'active',
        establishment_id: null,
      })
      .select()
      .single();

    if (!error && newMember) {
      setMember(newMember as Member);
      setAccessRequest(null);
      setNeedsAccess(false);
      await loadMyEstablishments(currentUser, newMember as Member);
    } else {
      // Insert échoué (doublon / RLS) → recharger
      const { data: retry } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (retry) {
        setMember(retry as Member);
        setNeedsAccess(false);
        await loadMyEstablishments(currentUser, retry as Member);
      } else {
        console.error('member insert failed', error);
        setMember(null);
        setMyEstablishments([]);
        setActiveEstablishment(null);
      }
    }
    setAccessRequest(null);
    setNeedsAccess(false);
    } catch (e) {
      console.error('loadMemberData', e);
      setMember(null);
      setMyEstablishments([]);
      setActiveEstablishment(null);
      setNeedsAccess(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadMemberData(session.user);
        }
      } catch (e) {
        console.error('getSession', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Évite les doubles chargements inutiles au démarrage
      if (event === 'INITIAL_SESSION') return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          // TOKEN_REFRESHED : ne bloque pas l'UI
          const blockUi = event === 'SIGNED_IN';
          if (blockUi) setLoading(true);
          loadMemberData(newSession.user).finally(() => {
            if (mounted && blockUi) setLoading(false);
          });
        }
      } else {
        setMember(null);
        setAccessRequest(null);
        setNeedsAccess(false);
        setMyEstablishments([]);
        setActiveEstablishment(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(login: string, password: string) {
    const lockLeft = getLoginLockRemaining();
    if (lockLeft > 0) {
      return { error: `Trop de tentatives. Réessayez dans ${Math.ceil(lockLeft / 1000)} s.` };
    }
    if (!isSafeLogin(login)) {
      return { error: 'Identifiant invalide.' };
    }
    const email = toAuthEmail(login);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      registerLoginFailure();
      setLoading(false);
      return { error: safeErrorMessage(error, 'Identifiants incorrects') };
    }
    registerLoginSuccess();
    if (data.user) {
      try {
        await loadMemberData(data.user);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
    return { error: null };
  }

  async function signUp(login: string, password: string, fullName: string) {
    const email = toAuthEmail(login);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }

    if (data.user) {
      // Profil membre (ignore doublon si déjà créé)
      await supabase.from('members').upsert(
        {
          user_id: data.user.id,
          email,
          full_name: fullName,
          role: 'employee',
          status: 'active',
          establishment_id: null,
        },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );

      // Session immédiate (autoconfirm) → entrée dans l'app
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        try {
          await loadMemberData(data.user);
        } finally {
          setLoading(false);
        }
        return { error: null };
      }

      // Pas de session (confirmation email requise)
      setLoading(false);
      return {
        error: null,
        // message géré côté UI
      };
    }
    setLoading(false);
    return { error: null };
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { access_type: 'online', prompt: 'select_account' },
      },
    });
    if (error) {
      throw error;
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore network errors — on nettoie quand même l'état local */
      }
    }
    setSession(null);
    setUser(null);
    setMember(null);
    setAccessRequest(null);
    setNeedsAccess(false);
    setMyEstablishments([]);
    setActiveEstablishment(null);
    setLoading(false);
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
