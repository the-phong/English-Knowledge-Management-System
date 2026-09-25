'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { AuthSession } from '@ekms/contracts';
import { ApiError, authClient, type AuthSnapshot } from './auth-client';

const initialSnapshot: AuthSnapshot = { status: 'loading', user: null };

export function AuthPanel(): React.ReactNode {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(initialSnapshot);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<AuthSession[]>([]);

  useEffect(() => {
    const unsubscribe = authClient.subscribe(setSnapshot);
    void authClient.initialize();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (snapshot.status !== 'authenticated') { setSessions([]); return; }
    void authClient.listSessions().then(setSessions).catch(() => setSessions([]));
  }, [snapshot]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const input = { email: String(data.get('email')), password: String(data.get('password')) };
    try {
      if (mode === 'login') await authClient.login(input);
      else {
        const displayName = String(data.get('displayName') || '');
        await authClient.register(displayName ? { ...input, displayName } : input);
      }
      event.currentTarget.reset();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Không thể kết nối đến máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  if (snapshot.status === 'loading') return <section className="card" aria-busy="true">Đang kiểm tra phiên đăng nhập…</section>;

  if (snapshot.status === 'anonymous') {
    return (
      <section className="card auth-card">
        <div className="tabs" role="tablist" aria-label="Tài khoản">
          <button type="button" aria-selected={mode === 'login'} onClick={() => setMode('login')}>Đăng nhập</button>
          <button type="button" aria-selected={mode === 'register'} onClick={() => setMode('register')}>Tạo tài khoản</button>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          {mode === 'register' && <label>Tên hiển thị<input name="displayName" maxLength={100} autoComplete="name" /></label>}
          <label>Email<input name="email" type="email" maxLength={254} required autoComplete="email" /></label>
          <label>Mật khẩu<input name="password" type="password" minLength={8} maxLength={128} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
        </form>
      </section>
    );
  }

  return (
    <section className="card">
      <p className="eyebrow">Đã đăng nhập</p>
      <h2>{snapshot.user.displayName ?? snapshot.user.email}</h2>
      <p>{snapshot.user.email}</p>
      <div className="actions">
        <button className="primary" onClick={() => void authClient.logout()}>Đăng xuất phiên này</button>
        <button onClick={() => void authClient.logoutAll()}>Đăng xuất tất cả</button>
      </div>
      <h3>Phiên đang hoạt động</h3>
      <ul className="sessions">
        {sessions.map((session) => (
          <li key={session.id}>
            <span>{session.current ? 'Phiên hiện tại' : `Tạo ${new Date(session.createdAt).toLocaleString('vi-VN')}`}</span>
            {!session.current && <button onClick={() => void authClient.revokeSession(session.id).then(() => authClient.listSessions()).then(setSessions)}>Thu hồi</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
