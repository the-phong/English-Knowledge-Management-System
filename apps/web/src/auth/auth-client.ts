import type { AuthData, AuthSession, LoginInput, RegisterInput, User } from '@ekms/contracts';

type AuthSnapshot =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: User };

type ErrorEnvelope = { error?: { code?: string; message?: string } };

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

export class AuthClient {
  private readonly apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';
  private accessToken: string | null = null;
  private snapshot: AuthSnapshot = { status: 'loading', user: null };
  private refreshPromise: Promise<boolean> | null = null;
  private initialized = false;
  private otherTabRefreshing = false;
  private readonly listeners = new Set<(snapshot: AuthSnapshot) => void>();
  private readonly refreshWaiters = new Set<() => void>();
  private readonly channel = typeof window === 'undefined' || !('BroadcastChannel' in window)
    ? null
    : new BroadcastChannel('ekms-auth');

  constructor() {
    this.channel?.addEventListener('message', (event: MessageEvent<{ type?: string }>) => {
      if (event.data.type === 'refresh-started') this.otherTabRefreshing = true;
      if (event.data.type === 'refresh-finished') {
        this.otherTabRefreshing = false;
        this.refreshWaiters.forEach((resolve) => resolve());
        this.refreshWaiters.clear();
      }
      if (event.data.type === 'auth-cleared') this.clearSession(false);
    });
  }

  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.refresh();
  }

  async register(input: RegisterInput): Promise<void> {
    this.setSession(await this.request<AuthData>('/auth/register', { method: 'POST', body: JSON.stringify(input) }));
  }

  async login(input: LoginInput): Promise<void> {
    this.setSession(await this.request<AuthData>('/auth/login', { method: 'POST', body: JSON.stringify(input) }));
  }

  async refresh(): Promise<boolean> {
    if (this.refreshPromise !== null) return this.refreshPromise;
    this.refreshPromise = this.performRefresh().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    try { await this.request('/auth/logout', { method: 'POST' }); } finally { this.clearSession(true); }
  }

  async logoutAll(): Promise<void> {
    try { await this.authorizedRequest('/auth/logout-all', { method: 'POST' }); } finally { this.clearSession(true); }
  }

  listSessions(): Promise<AuthSession[]> {
    return this.authorizedRequest<AuthSession[]>('/auth/sessions');
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.authorizedRequest(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  }

  private async performRefresh(): Promise<boolean> {
    if (this.otherTabRefreshing) await this.waitForOtherTab();
    this.channel?.postMessage({ type: 'refresh-started' });
    try {
      const session = await this.request<AuthData>('/auth/refresh', { method: 'POST' });
      this.setSession(session);
      return true;
    } catch {
      this.clearSession(false);
      return false;
    } finally {
      this.channel?.postMessage({ type: 'refresh-finished' });
    }
  }

  private waitForOtherTab(): Promise<void> {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => { this.refreshWaiters.delete(done); resolve(); }, 2_000);
      const done = (): void => { window.clearTimeout(timer); resolve(); };
      this.refreshWaiters.add(done);
    });
  }

  private async authorizedRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    if (this.accessToken === null && !(await this.refresh())) throw new ApiError('AUTH_UNAUTHORIZED', 'Authentication is required.', 401);
    try {
      return await this.request<T>(path, {
        ...init,
        headers: { ...this.headers(init.headers), Authorization: `Bearer ${this.accessToken}` },
      });
    } catch (error) {
      if (retry && error instanceof ApiError && error.status === 401 && await this.refresh()) {
        return this.authorizedRequest<T>(path, init, false);
      }
      throw error;
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      ...init,
      credentials: 'include',
      headers: this.headers(init.headers),
    });
    const payload = await response.json() as { data?: T } & ErrorEnvelope;
    if (!response.ok || payload.data === undefined) {
      throw new ApiError(payload.error?.code ?? `HTTP_${response.status}`, payload.error?.message ?? 'Request failed.', response.status);
    }
    return payload.data;
  }

  private headers(input?: HeadersInit): Headers {
    const headers = new Headers(input);
    headers.set('Content-Type', 'application/json');
    return headers;
  }

  private setSession(session: AuthData): void {
    this.accessToken = session.accessToken;
    this.snapshot = { status: 'authenticated', user: session.user };
    this.emit();
  }

  private clearSession(broadcast: boolean): void {
    this.accessToken = null;
    this.snapshot = { status: 'anonymous', user: null };
    this.emit();
    if (broadcast) this.channel?.postMessage({ type: 'auth-cleared' });
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}

export const authClient = new AuthClient();
export type { AuthSnapshot };
