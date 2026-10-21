import { dom } from './setup-dom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  render,
  fireEvent,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import {
  AppRouterContext,
  type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { AuthProvider } from '../src/auth/auth-context';
import { ProtectedShell } from '../src/auth/protected-shell';
import AuthPage from '../src/app/auth/page';
import AccountPage from '../src/app/account/page';

const replacements: string[] = [];
const router: AppRouterInstance = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace(href) {
    replacements.push(href);
  },
  prefetch: async () => {},
  bfcacheId: 'test',
};
const wrapped = (component: React.ReactNode) => (
  <AppRouterContext.Provider value={router}>
    <AuthProvider>{component}</AuthProvider>
  </AppRouterContext.Provider>
);
const response = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(status < 400 ? { data } : { error: data }), {
    status,
    headers,
  });
const error = {
  code: 'AUTH_REQUIRED',
  message: 'Authentication required',
  requestId: '17c67b2c-cfbe-4cb4-9899-87c6c96dd677',
};

test('login and registration form have accessible controls, validation and busy state', async () => {
  const previous = globalThis.fetch;
  const calls: string[] = [];
  let resolveLogin: ((value: Response) => void) | undefined;
  globalThis.fetch = async (input) => {
    const path = String(input);
    calls.push(path);
    if (path.endsWith('/auth/refresh')) return response(error, 401);
    if (path.endsWith('/auth/register'))
      return response({ id: 'user-id' }, 201);
    if (path.endsWith('/auth/login'))
      return new Promise<Response>((resolve) => {
        resolveLogin = resolve;
      });
    throw new Error('unexpected request');
  };
  try {
    render(wrapped(<AuthPage />));
    assert.ok(screen.getByRole('main'));
    assert.ok(await screen.findByLabelText('Email'));
    assert.ok(screen.getByLabelText('Password'));
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'short' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create account' }).closest('form')!,
    );
    assert.match(screen.getByRole('alert').textContent ?? '', /valid email/);
    assert.equal(
      calls.filter((item) => item.endsWith('/auth/register')).length,
      0,
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'valid password' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create account' }).closest('form')!,
    );
    await waitFor(() =>
      assert.match(
        screen.getByRole('status').textContent ?? '',
        /Account created/,
      ),
    );
    assert.equal(
      calls.filter((item) => item.endsWith('/auth/register')).length,
      1,
    );
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'valid password' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Sign in' }).closest('form')!,
    );
    await waitFor(() => assert.ok(resolveLogin));
    assert.equal(
      screen
        .getByRole('button', { name: 'Please wait…' })
        .hasAttribute('disabled'),
      true,
    );
    resolveLogin!(
      response(
        {
          accessToken: 'access-token',
          user: {
            id: 'user-id',
            email: 'user@example.test',
            timezone: 'UTC',
            preferences: {},
            createdAt: new Date().toISOString(),
          },
        },
        201,
      ),
    );
    await waitFor(() => assert.ok(replacements.includes('/app')));
    assert.equal(dom.window.localStorage.length, 0);
    assert.equal(dom.window.sessionStorage.length, 0);
  } finally {
    cleanup();
    globalThis.fetch = previous;
    replacements.length = 0;
  }
});

test('failed restoration withholds private content and redirects to login', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => response(error, 401);
  try {
    render(
      wrapped(
        <ProtectedShell>
          <p>Private content</p>
        </ProtectedShell>,
      ),
    );
    assert.equal(screen.queryByText('Private content'), null);
    await waitFor(() => assert.ok(replacements.includes('/auth')));
    assert.equal(screen.queryByText('Private content'), null);
  } finally {
    cleanup();
    globalThis.fetch = previous;
    replacements.length = 0;
  }
});

test('session restoration shows account security and revokes an owned session', async () => {
  const previous = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, options) => {
    const path = String(input);
    calls.push(`${options?.method ?? 'GET'} ${path}`);
    if (path.endsWith('/auth/refresh'))
      return response({ accessToken: 'access-token' }, 201);
    if (path.endsWith('/me'))
      return response({
        id: 'user-id',
        email: 'user@example.test',
        timezone: 'UTC',
        preferences: {},
        createdAt: new Date().toISOString(),
      });
    if (path.endsWith('/auth/sessions'))
      return response([
        {
          id: 'session-id',
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
          current: false,
        },
      ]);
    if (path.endsWith('/auth/sessions/session-id'))
      return response({ revoked: true });
    if (path.endsWith('/auth/logout-all'))
      return response({ loggedOut: true }, 201);
    throw new Error(`unexpected ${path}`);
  };
  try {
    render(wrapped(<AccountPage />));
    assert.equal(screen.queryByText('Account and security'), null);
    await waitFor(() => assert.ok(screen.getByText('Account and security')));
    await waitFor(() => assert.ok(screen.getByText(/Other session/)));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    assert.ok(
      screen.getByRole('group', { name: 'Confirm session revocation' }),
    );
    await waitFor(() =>
      assert.equal(
        dom.window.document.activeElement,
        screen.getByRole('button', { name: 'Confirm revoke' }),
      ),
    );
    assert.equal(
      calls.some((item) => item.startsWith('DELETE ')),
      false,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm revoke' }));
    await waitFor(() =>
      assert.ok(
        calls.some(
          (item) => item === 'DELETE /api/v1/auth/sessions/session-id',
        ),
      ),
    );
    await waitFor(() =>
      assert.equal(screen.queryByText(/Other session/), null),
    );
    assert.ok(screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out everywhere' }),
    );
    assert.ok(
      screen.getByRole('group', { name: 'Confirm sign out everywhere' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm sign out everywhere' }),
    );
    await waitFor(() =>
      assert.ok(calls.includes('POST /api/v1/auth/logout-all')),
    );
    await waitFor(() => assert.ok(replacements.includes('/auth')));
  } finally {
    cleanup();
    globalThis.fetch = previous;
    replacements.length = 0;
  }
});
