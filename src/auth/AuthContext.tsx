import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type ProfileError = { message: string; code: 'not_found' | 'rls' | 'network' | 'unknown' } | null;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: ProfileError;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role?: string) =>
    Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  retryProfile: () => Promise<void>;
};

const PROFILE_TIMEOUT_MS = 8000;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<ProfileError>(null);

  // Guards against overlapping loadProfile calls and stale async results.
  const inflightUid = useRef<string | null>(null);

  const loadProfile = async (uid: string): Promise<void> => {
    if (inflightUid.current === uid) return; // dedupe concurrent calls for same user
    inflightUid.current = uid;

    try {
      // Race the query against a timeout so a hung network/RLS error can never
      // leave the UI in an infinite loading state.
      const result = await Promise.race([
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(
            () => resolve({ data: null, error: { message: 'Profile lookup timed out.' } }),
            PROFILE_TIMEOUT_MS
          )
        ),
      ]);

      // If a newer loadProfile call started, drop this result.
      if (inflightUid.current !== uid) return;

      const { data, error } = result as { data: Profile | null; error: { message: string; code?: string } | null };

      if (error) {
        const msg = error.message || '';
        const code: 'rls' | 'network' | 'unknown' = /permission denied|rls|policy/i.test(msg)
          ? 'rls'
          : /timeout|network|fetch|failed|aborted/i.test(msg)
          ? 'network'
          : 'unknown';
        console.error('Failed to load profile:', msg);
        setProfile(null);
        setProfileError({ message: msg, code });
        return;
      }

      if (!data) {
        // Profile row missing despite a valid session. The handle_new_user
        // trigger normally creates it on signup, but a race, an older account,
        // or a failed trigger can leave it absent. Attempt a self-heal insert
        // (profiles_insert_self policy permits id = auth.uid()). No duplicate
        // because the id PK + on-conflict-do-nothing.
        const user = (await supabase.auth.getUser()).data.user;
        if (inflightUid.current !== uid) return;
        const meta = user?.user_metadata ?? {};
        const { error: insertErr } = await supabase
          .from('profiles')
          .upsert(
            {
              id: uid,
              email: user?.email ?? '',
              full_name: meta.full_name || (user?.email ? user.email.split('@')[0] : 'User'),
              role: 'employee',
            },
            { onConflict: 'id' }
          );
        if (inflightUid.current !== uid) return;
        if (insertErr) {
          console.error('Profile self-heal insert failed:', insertErr.message);
          setProfile(null);
          setProfileError({ message: insertErr.message, code: 'not_found' });
          return;
        }
        // Re-read to get the full row with server defaults.
        const { data: healed, error: healReadErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .maybeSingle();
        if (inflightUid.current !== uid) return;
        if (healReadErr || !healed) {
          setProfile(null);
          setProfileError({ message: healReadErr?.message ?? 'Profile could not be read after creation.', code: 'not_found' });
          return;
        }
        setProfile(healed as Profile);
        setProfileError(null);
        return;
      }

      setProfile(data as Profile);
      setProfileError(null);
    } catch (err) {
      if (inflightUid.current !== uid) return;
      const msg = err instanceof Error ? err.message : 'Unexpected error loading profile.';
      console.error('Profile load threw:', msg);
      setProfile(null);
      setProfileError({ message: msg, code: 'unknown' });
    } finally {
      if (inflightUid.current === uid) inflightUid.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Initial session fetch. onAuthStateChange will also fire for SIGNED_IN,
    // so we only set loading=false here for the no-session branch; the
    // session branch lets the auth listener (and its profile load) own the
    // loading transition to avoid a flash of "no session".
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('getSession error:', error.message);
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setSession(data.session);
      const uid = data.session?.user?.id;
      if (uid) {
        loadProfile(uid).finally(() => mounted && setLoading(false));
      } else {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      (async () => {
        setSession(newSession);
        const uid = newSession?.user?.id;
        if (uid) {
          // On a fresh sign-in, ensure we don't reuse a stale profile.
          if (event === 'SIGNED_IN') setProfile(null);
          setProfileError(null);
          await loadProfile(uid);
        } else {
          setProfile(null);
          setProfileError(null);
        }
        if (mounted) setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileError,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signUp: async (email, password, fullName, role = 'employee') => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } },
        });
        if (error) return { error: error.message };
        const needsConfirmation = !data.session;
        return { error: null, needsConfirmation };
      },
      signOut: async () => {
        await supabase.auth.signOut();
        inflightUid.current = null;
        setProfile(null);
        setProfileError(null);
        setSession(null);
      },
      resetPassword: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        return { error: error?.message ?? null };
      },
      refreshProfile: async () => {
        const uid = session?.user?.id;
        if (uid) await loadProfile(uid);
      },
      retryProfile: async () => {
        const uid = session?.user?.id;
        if (uid) {
          inflightUid.current = null;
          await loadProfile(uid);
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, profile, loading, profileError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
