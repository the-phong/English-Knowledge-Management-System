'use client';

import { useEffect, useRef, useState } from 'react';
import { ProtectedShell } from '../../auth/protected-shell';
import { useAuth } from '../../auth/auth-context';
import { AppShell } from '../../components/app-shell';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/layout';
import {
  Alert,
  Card,
  EmptyState,
  LoadingState,
} from '../../components/ui/surfaces';
import type { SessionSummary } from '../../lib/auth-client';

function AccountContent() {
  const { state, sessions, revokeSession, logout, logoutAll } = useAuth();
  const [items, setItems] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const confirmationTrigger = useRef<HTMLButtonElement>(null);
  const hadConfirmation = useRef(false);

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

  useEffect(() => {
    if (confirmId || confirmAll) {
      hadConfirmation.current = true;
      confirmButton.current?.focus();
    } else if (hadConfirmation.current) {
      hadConfirmation.current = false;
      if (confirmationTrigger.current?.isConnected)
        confirmationTrigger.current.focus();
      else document.getElementById('sessions-heading')?.focus();
    }
  }, [confirmId, confirmAll]);

  if (state.status !== 'authenticated') return null;

  async function perform(action: () => Promise<void>, success?: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (success) setNotice(success);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Action failed. Try again.',
      );
    } finally {
      setBusy(false);
      setConfirmId(null);
      setConfirmAll(false);
    }
  }

  async function retrySessions() {
    setLoading(true);
    setError('');
    try {
      setItems(await sessions());
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Sessions unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell current="account" userEmail={state.user.email}>
      <PageHeader
        eyebrow="Account"
        title="Account and security"
        description="See where you are signed in and control your active sessions."
      />
      <div className="account-grid">
        <Card aria-labelledby="sessions-heading">
          <h2 id="sessions-heading" tabIndex={-1}>
            Active sessions
          </h2>
          <p className="section-intro">
            Sessions are managed by EKMS. Revoke one you no longer use.
          </p>
          {loading && <LoadingState label="Loading sessions…" />}
          {!loading && error && (
            <div>
              <Alert tone="error">
                <p>{error}</p>
              </Alert>
              <Button
                variant="secondary"
                onClick={() => {
                  void retrySessions();
                }}
              >
                Retry loading sessions
              </Button>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <EmptyState
              title="No active sessions"
              description="Your session list is empty. Sign in again if needed."
            />
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="session-list">
              {items.map((session) => (
                <li className="session-row" key={session.id}>
                  <div className="session-row__details">
                    <div className="session-row__name">
                      <span>
                        {session.current ? 'This session' : 'Other session'}
                      </span>
                      {session.current && (
                        <span className="status-badge">Current</span>
                      )}
                    </div>
                    <span className="session-row__meta">
                      Started {new Date(session.createdAt).toLocaleString()}
                    </span>
                    {confirmId === session.id && (
                      <div
                        className="confirm-panel"
                        role="group"
                        aria-label="Confirm session revocation"
                      >
                        <p>
                          Revoke this session? It will lose access immediately.
                        </p>
                        <div className="confirm-panel__actions">
                          <Button
                            ref={confirmButton}
                            variant="danger"
                            disabled={busy}
                            loading={busy}
                            onClick={() => {
                              void perform(async () => {
                                await revokeSession(
                                  session.id,
                                  session.current,
                                );
                                setItems((current) =>
                                  current.filter(
                                    (item) => item.id !== session.id,
                                  ),
                                );
                              }, 'Session revoked.');
                            }}
                          >
                            Confirm revoke
                          </Button>
                          <Button
                            variant="quiet"
                            disabled={busy}
                            onClick={() => setConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {confirmId !== session.id && (
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onClick={(event) => {
                        confirmationTrigger.current = event.currentTarget;
                        setConfirmAll(false);
                        setConfirmId(session.id);
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {notice && (
            <Alert tone="success">
              <p>{notice}</p>
            </Alert>
          )}
        </Card>
        <div>
          <Card aria-labelledby="profile-heading">
            <h2 id="profile-heading">Your account</h2>
            <div className="account-profile">
              <span className="avatar-mark" aria-hidden="true">
                {state.user.email.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{state.user.email}</strong>
                <p>Timezone: {state.user.timezone}</p>
              </div>
            </div>
          </Card>
          <Card className="workspace-account" aria-labelledby="actions-heading">
            <h2 id="actions-heading">Sign-in controls</h2>
            <p className="section-intro">
              Choose where to end access to your account.
            </p>
            <div className="account-actions">
              <Button
                variant="secondary"
                disabled={busy}
                loading={busy}
                onClick={() => {
                  void perform(logout);
                }}
              >
                Sign out
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={(event) => {
                  confirmationTrigger.current = event.currentTarget;
                  setConfirmId(null);
                  setConfirmAll(true);
                }}
              >
                Sign out everywhere
              </Button>
            </div>
            {confirmAll && (
              <div
                className="confirm-panel"
                role="group"
                aria-label="Confirm sign out everywhere"
              >
                <p>
                  End all active sessions? You will need to sign in again on
                  every device.
                </p>
                <div className="confirm-panel__actions">
                  <Button
                    ref={confirmButton}
                    variant="danger"
                    disabled={busy}
                    loading={busy}
                    onClick={() => {
                      void perform(logoutAll);
                    }}
                  >
                    Confirm sign out everywhere
                  </Button>
                  <Button
                    variant="quiet"
                    disabled={busy}
                    onClick={() => setConfirmAll(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default function AccountPage() {
  return (
    <ProtectedShell>
      <AccountContent />
    </ProtectedShell>
  );
}
