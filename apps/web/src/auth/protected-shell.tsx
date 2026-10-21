'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status === 'anonymous') router.replace('/auth');
  }, [state.status, router]);
  if (state.status === 'loading')
    return (
      <main className="page-shell">
        <p role="status">Checking your session…</p>
      </main>
    );
  if (state.status === 'anonymous') return null;
  return <>{children}</>;
}
