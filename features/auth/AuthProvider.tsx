import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { db, openedFromRecoveryLink } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** True until the stored session has been read on app start. */
  loading: boolean;
  /** True after arriving from a password-reset email, until a new password is chosen. */
  recovering: boolean;
};

type AuthContextValue = AuthState & { finishRecovery: () => void };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: true,
    recovering: openedFromRecoveryLink,
  });

  useEffect(() => {
    let active = true;

    db()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setState((current) => ({ ...current, session: data.session, loading: false }));
      })
      .catch(() => {
        if (active) setState((current) => ({ ...current, session: null, loading: false }));
      });

    const { data } = db().auth.onAuthStateChange((event, session) => {
      setState((current) => ({
        session,
        loading: false,
        recovering:
          event === 'PASSWORD_RECOVERY'
            ? true
            : event === 'SIGNED_OUT'
              ? false
              : current.recovering,
      }));
      // Never show one account's cached data to the next account on the same phone.
      if (event === 'SIGNED_OUT') queryClient.clear();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo(
    () => ({
      ...state,
      finishRecovery: () => setState((current) => ({ ...current, recovering: false })),
    }),
    [state],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}

/** The signed-in user's id. Only call from screens behind the auth guard. */
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('No signed-in user.');
  return session.user.id;
}
