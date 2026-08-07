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

  function buildFallbackMember(currentUser: User): Member {
    const email = currentUser.email ?? '';
    return {
      id: currentUser.id,
      user_id: currentUser.id,
      email,
      full_name:
        (currentUser.user_metadata?.full_name as string) ||
        (currentUser.user_metadata?.name as string) ||
        email.split('@')[0] ||
        'Utilisateur',
      role: 'owner',
      status: 'active',
      establishment_id: null,
      created_at: new Date().toISOString(),
    } as Member;
  }

  async function loadMemberData(currentUser: User): Promise<Member> {
    const fallback = buildFallbackMember(currentUser);
    try {
      try {
        if (!isOnline()) {
          const cached = await getCachedAuthProfile(currentUser.id);
          if (cached?.member) {
            setMember(cached.member as Member);
            setAccessRequest(null);
            setNeedsAccess(false);
            return cached.member as Member;
          }
        }
      } catch {
        /* ignore */
      }

      let existingMember: Member | null = null;
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (error) console.error('members select error', error);
        existingMember = (data as Member) || null;
      } catch (e) {
        console.error('members select throw', e);
      }

      if (existingMember && !existingMember.establishment_id) {
        try {
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
            if (refreshed) existingMember = refreshed as Member;
          }
        } catch {
          /* ignore */
        }
      }

      if (existingMember) {
        setMember(existingMember);
        setAccessRequest(null);
        setNeedsAccess(false);
        try {
          await loadMyEstablishments(currentUser, existingMember);
        } catch {
          /* ignore */
        }
        try {
          await cacheAuthProfile({ userId: currentUser.id, member: existingMember });
        } catch {
          /* ignore */
        }
        return existingMember;
      }

      const payload = {
        user_id: currentUser.id,
        email: fallback.email,
        full_name: fallback.full_name,
        role: 'owner' as const,
        status: 'active' as const,
        establishment_id: null as string | null,
      };

      try {
        const { data, error } = await supabase
          .from('members')
          .upsert(payload, { onConflict: 'user_id' })
          .select()
          .maybeSingle();
        if (error) console.error('member upsert error', error);
        if (data) {
          const m = data as Member;
          setMember(m);
          setAccessRequest(null);
          setNeedsAccess(false);
          try {
            await loadMyEstablishments(currentUser, m);
          } catch {
            /* */
          }
          return m;
        }
      } catch (e) {
        console.error('member upsert throw', e);
      }

      setMember(fallback);
      setAccessRequest(null);
      setNeedsAccess(false);
      setMyEstablishments([]);
      setActiveEstablishment(null);
      return fallback;
    } catch (e) {
      console.error('loadMemberData', e);
      setMember(fallback);
      setNeedsAccess(false);
      return fallback;
    }
  }

  useEffect(() => {
    let mounted = true;
    let memberLoadSeq = 0;

    async function boot() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const seq = ++memberLoadSeq;
          const result = await Promise.race([
            loadMemberData(session.user).then((m) => m),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);
          if (mounted && seq === memberLoadSeq && result === null) {
            const fb = buildFallbackMember(session.user);
            setMember(fb);
            setNeedsAccess(false);
          }
        }
      } catch (e) {
        console.error('getSession', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    boot();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      // INITIAL_SESSION déjà géré par boot()
      if (event === 'INITIAL_SESSION') return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        const seq = ++memberLoadSeq;
        try {
          const result = await Promise.race([
            loadMemberData(newSession.user).then((m) => m),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);
          if (mounted && seq === memberLoadSeq && result === null) {
            setMember(buildFallbackMember(newSession.user));
            setNeedsAccess(false);
          }
        } finally {
          if (mounted && seq === memberLoadSeq) setLoading(false);
        }
      } else if (!newSession?.user && event === 'SIGNED_OUT') {
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
    try {
      localStorage.removeItem('mm_login_attempts'); // reset anti-bruteforce au nouvel essai volontaire
    } catch { /* */ }
    if (!login.trim()) {
      return { error: 'Saisissez votre identifiant ou e-mail.' };
    }
    if (!password) {
      return { error: 'Saisissez votre mot de passe.' };
    }
    if (!isSafeLogin(login)) {
      return { error: 'Identifiant invalide (e-mail ou login simple sans espaces).' };
    }
    const email = toAuthEmail(login);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        registerLoginFailure();
        setLoading(false);
        return { error: safeErrorMessage(error, 'Identifiant ou mot de passe incorrect') };
      }
      registerLoginSuccess();
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      if (data.user) {
        try {
          const result = await Promise.race([
            loadMemberData(data.user).then((m) => m),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);
          if (result === null) {
            setMember(buildFallbackMember(data.user));
            setNeedsAccess(false);
          }
        } catch (err) {
          console.error('loadMember after signIn', err);
          setMember(buildFallbackMember(data.user));
          setNeedsAccess(false);
        }
      }
      setLoading(false);
      return { error: null };
    } catch (e: any) {
      registerLoginFailure();
      setLoading(false);
      return { error: e?.message || 'Connexion impossible' };
    }
  }

  async function signUp(login: string, password: string, fullName: string) {
    if (!isSafeLogin(login)) {
      return { error: 'Identifiant invalide (2–40 caractères, lettres/chiffres, ou e-mail valide).' };
    }
    if (!password || password.length < 6) {
      return { error: 'Mot de passe trop court (minimum 6 caractères).' };
    }
    const email = toAuthEmail(login);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || login, name: fullName || login },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        return { error: safeErrorMessage(error, error.message) };
      }

      // Si pas de session (confirmation e-mail / cas edge) → connexion immédiate
      let session = data.session;
      let user = data.user;
      if (!session) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) {
          // Compte créé mais connexion bloquée (ex. e-mail à confirmer)
          return {
            error:
              signInErr.message.includes('Email not confirmed') || signInErr.message.includes('email')
                ? 'Compte créé. Confirmez votre e-mail puis connectez-vous.'
                : safeErrorMessage(signInErr, 'Compte créé. Connectez-vous avec le même identifiant.'),
          };
        }
        session = signInData.session;
        user = signInData.user;
      }

      if (session) {
        setSession(session);
        setUser(session.user);
      }
      if (user) {
        // Créer / mettre à jour le profil propriétaire
        await supabase.from('members').upsert(
          {
            user_id: user.id,
            email: user.email || email,
            full_name: fullName || user.user_metadata?.full_name || login,
            role: 'owner',
            status: 'active',
            establishment_id: null,
          },
          { onConflict: 'user_id' }
        );
        await loadMemberData(user);
      }
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'Inscription impossible' };
    } finally {
      setLoading(false);
    }
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
