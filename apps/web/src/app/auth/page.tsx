'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../auth/auth-context';

export default function AuthPage() {
  const { state, login, register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace('/app');
  }, [state.status, router]);

  if (state.status !== 'anonymous') {
    return (
      <main className="auth-layout">
        <p role="status">Checking your session…</p>
      </main>
    );
  }

  return (
    <AuthForm
      onLogin={async (email, password) => {
        await login(email, password);
        router.replace('/app');
      }}
      onRegister={register}
    />
  );
}

export function AuthForm({
  onLogin,
  onRegister,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (
      email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(email.trim()) ||
      password.length < 8 ||
      password.length > 128
    ) {
      setError('Use a valid email and a password of 8–128 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await onRegister(email, password);
        setMode('login');
        setPassword('');
        setNotice('Account created. Sign in to continue.');
      } else {
        await onLogin(email, password);
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Unable to continue. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="brand-link" href="/">
          EKMS
        </Link>
        <p className="eyebrow">Your English workspace</p>
        <h1 id="auth-title">
          {mode === 'login' ? 'Sign in' : 'Create an account'}
        </h1>
        <p className="muted">
          {mode === 'login'
            ? 'Use your email and password.'
            : 'Start with a secure account.'}
        </p>
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-notice" role="status">
              {notice}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
        <p className="switch-line">
          {mode === 'login' ? 'New here?' : 'Already registered?'}{' '}
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setNotice('');
              setPassword('');
            }}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>
    </main>
  );
}
