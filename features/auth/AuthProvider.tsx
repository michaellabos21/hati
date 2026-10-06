import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { db } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** True until the stored session has been read on app start. */
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;

    db()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setState({ session: data.session, loading: false });
      })
      .catch(() => {
        if (active) setState({ session: null, loading: false });
      });

    const { data } = db().auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      // Never show one account's cached data to the next account on the same phone.
      if (event === 'SIGNED_OUT') queryClient.clear();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
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
