'use client';

import Link from 'next/link';
import { ProtectedShell } from '../../auth/protected-shell';
import { useAuth } from '../../auth/auth-context';

function Workspace() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  return (
    <main className="page-shell">
      <div className="content">
        <p className="eyebrow">EKMS workspace</p>
        <h1>Welcome back</h1>
        <p className="intro">Signed in as {state.user.email}.</p>
        <div className="notice">
          <h2>Your account is ready</h2>
          <p>
            Learning tools will appear in later phases. You can review active
            sessions now.
          </p>
        </div>
        <p>
          <Link href="/account">Account and security</Link>
        </p>
      </div>
    </main>
  );
}

export default function AppPage() {
  return (
    <ProtectedShell>
      <Workspace />
    </ProtectedShell>
  );
}
