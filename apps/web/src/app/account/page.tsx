'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedShell } from '../../auth/protected-shell';
import { useAuth } from '../../auth/auth-context';
import type { SessionSummary } from '../../lib/auth-client';

function AccountContent() {
  const { state, sessions, revokeSession, logout, logoutAll } = useAuth();
  const [items, setItems] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void sessions()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((failure) => {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Sessions unavailable.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status !== 'authenticated') return null;

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Action failed. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="content">
        <Link href="/app">← Workspace</Link>
        <h1>Account and security</h1>
        <p className="intro">{state.user.email}</p>
        <section className="notice" aria-labelledby="sessions-heading">
          <h2 id="sessions-heading">Active sessions</h2>
          {loading && <p role="status">Loading sessions…</p>}
          {!loading && items.length === 0 && <p>No active sessions.</p>}
          {!loading && (
            <ul className="session-list">
              {items.map((session) => (
                <li key={session.id}>
                  <span>
                    {session.current ? 'This session' : 'Other session'} ·
                    Started {new Date(session.createdAt).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void perform(async () => {
                        await revokeSession(session.id, session.current);
                        setItems((current) =>
                          current.filter((item) => item.id !== session.id),
                        );
                      });
                    }}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="account-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void perform(logout);
            }}
          >
            Sign out
          </button>
          <button
            type="button"
            disabled={busy}
            className="secondary-button"
            onClick={() => {
              void perform(logoutAll);
            }}
          >
            Sign out everywhere
          </button>
        </div>
      </div>
    </main>
  );
}

export default function AccountPage() {
  return (
    <ProtectedShell>
      <AccountContent />
    </ProtectedShell>
  );
}
