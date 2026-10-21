import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiFailure,
  authRequest,
  refreshSingleFlight,
} from '../src/lib/auth-client';

test('client uses same-origin API and keeps credentials in cookie scope', async () => {
  const previous = globalThis.fetch;
  let captured: { url?: string; options?: RequestInit } = {};
  globalThis.fetch = async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ data: { id: 'safe' } }), {
      status: 200,
    });
  };
  try {
    assert.deepEqual(await authRequest('/me', {}, 'access-token'), {
      id: 'safe',
    });
    assert.equal(captured.url, '/api/v1/me');
    assert.equal(captured.options?.credentials, 'same-origin');
    assert.equal(
      new Headers(captured.options?.headers).get('Authorization'),
      'Bearer access-token',
    );
  } finally {
    globalThis.fetch = previous;
  }
});

test('refresh is single-flight within a tab', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await new Promise((resolve) => setImmediate(resolve));
    return new Response(
      JSON.stringify({ data: { accessToken: 'access-token' } }),
      { status: 200 },
    );
  };
  try {
    const [first, second] = await Promise.all([
      refreshSingleFlight(),
      refreshSingleFlight(),
    ]);
    assert.equal(first, 'access-token');
    assert.equal(second, 'access-token');
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous;
  }
});

test('client surfaces safe API failures and rejects malformed responses', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' },
      }),
      { status: 401 },
    );
  try {
    await assert.rejects(
      () => authRequest('/me'),
      (error: unknown) =>
        error instanceof ApiFailure &&
        error.status === 401 &&
        error.code === 'AUTH_REQUIRED',
    );
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    await assert.rejects(
      () => authRequest('/me'),
      (error: unknown) =>
        error instanceof ApiFailure && error.code === 'INVALID_RESPONSE',
    );
  } finally {
    globalThis.fetch = previous;
  }
});
