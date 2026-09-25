import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthClient, type AuthSnapshot } from './auth-client';

const authData = {
  accessToken: 'memory-only-access-token',
  user: { id: '13ce13ac-0ff1-4d20-8818-742499aac6ef', email: 'test@example.test', displayName: null, timezone: 'Asia/Bangkok' },
};

describe('AuthClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('coalesces concurrent refreshes within a tab', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: authData }) } as Response));
    vi.stubGlobal('fetch', fetchMock);
    const client = new AuthClient();

    const [first, second] = await Promise.all([client.refresh(), client.refresh()]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears auth state when refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'AUTH_INVALID_REFRESH_TOKEN', message: 'Expired.' } }),
    } as Response)));
    const client = new AuthClient();
    let snapshot: AuthSnapshot = { status: 'loading', user: null };
    client.subscribe((next) => { snapshot = next; });

    expect(await client.refresh()).toBe(false);
    expect(snapshot.status).toBe('anonymous');
  });
});
