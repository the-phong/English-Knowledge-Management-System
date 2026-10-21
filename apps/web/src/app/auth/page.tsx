'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Brand } from '../../components/brand';
import { Button } from '../../components/ui/button';
import { Alert, LoadingState } from '../../components/ui/surfaces';
import { TextField } from '../../components/ui/text-field';
import { useAuth } from '../../auth/auth-context';

export default function AuthPage() {
  const { state, login, register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace('/app');
  }, [state.status, router]);

  if (state.status !== 'anonymous') {
    return (
      <main className="auth-status">
        <LoadingState label="Checking your session…" />
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
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const invalidEmail =
      email.length > 254 || !/^\S+@\S+\.\S+$/.test(email.trim());
    const invalidPassword = password.length < 8 || password.length > 128;
    setEmailError(invalidEmail ? 'Enter a valid email address.' : '');
    setPasswordError(invalidPassword ? 'Use 8–128 characters.' : '');
    if (invalidEmail || invalidPassword) {
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
      <aside className="auth-story" aria-label="About EKMS">
        <Brand />
        <div className="auth-story__copy">
          <p className="eyebrow">A place to keep growing</p>
          <h2>Learn with a little more intention.</h2>
          <p>
            A calm workspace for English learners. Your account is ready now;
            vocabulary, practice, and writing tools are planned for later
            phases.
          </p>
        </div>
        <p className="auth-story__foot">English Knowledge Management System</p>
      </aside>
      <div className="auth-main">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card__intro">
            <p className="eyebrow">Your workspace starts here</p>
            <h1 id="auth-title">
              {mode === 'login' ? 'Sign in' : 'Create an account'}
            </h1>
            <p>
              {mode === 'login'
                ? 'Welcome back. Use your email and password to continue.'
                : 'Create a secure account, then sign in to open your workspace.'}
            </p>
          </div>
          <form
            className="auth-form"
            onSubmit={(event) => {
              void submit(event);
            }}
            noValidate
          >
            <TextField
              id="email"
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError('');
              }}
              disabled={busy}
              error={emailError}
            />
            <TextField
              id="password"
              name="password"
              label="Password"
              type="password"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError('');
              }}
              disabled={busy}
              hint={
                mode === 'register'
                  ? 'Use 8–128 characters. Spaces are kept as entered.'
                  : undefined
              }
              error={passwordError}
            />
            {error && (
              <Alert tone="error">
                <p>{error}</p>
              </Alert>
            )}
            {notice && (
              <Alert tone="success">
                <p>{notice}</p>
              </Alert>
            )}
            <Button
              className="ui-button--wide auth-form__submit"
              type="submit"
              disabled={busy}
              loading={busy}
            >
              {busy
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
          </form>
          <div className="auth-switch">
            {mode === 'login' ? 'New here?' : 'Already registered?'}{' '}
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
                setNotice('');
                setEmailError('');
                setPasswordError('');
                setPassword('');
              }}
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
