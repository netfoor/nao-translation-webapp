'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { getDataClient } from '@/amplify/client';
import { configureAmplify } from '@/amplify/config';
import type { TranslationSession } from '@/types/translation';

type AuthUser = { userId: string } | null;

interface AppContextValue {
  user: AuthUser;
  loadingUser: boolean;
  listSessions: () => Promise<TranslationSession[]>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    configureAmplify();
    (async () => {
      try {
        const u = await getCurrentUser();
        setUser({ userId: u.userId });
      } catch {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    })();
  }, []);

  const listSessions = useCallback(async () => {
    const client = getDataClient();
    const { data } = await client.models.TranslationSession.list({});
    return data as unknown as TranslationSession[];
  }, []);

  const value = useMemo<AppContextValue>(() => ({ user, loadingUser, listSessions }), [user, loadingUser, listSessions]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
