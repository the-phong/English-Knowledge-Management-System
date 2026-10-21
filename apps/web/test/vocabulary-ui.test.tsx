import { dom } from './setup-dom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import {
  AppRouterContext,
  type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { AuthProvider } from '../src/auth/auth-context';
import VocabularyPage from '../src/app/vocabulary/page';

const redirects: string[] = [];
const router: AppRouterInstance = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace(path) {
    redirects.push(path);
  },
  prefetch: async () => {},
  bfcacheId: 'test',
};
const wrapped = (page: React.ReactNode) => (
  <AppRouterContext.Provider value={router}>
    <AuthProvider>{page}</AuthProvider>
  </AppRouterContext.Provider>
);
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status < 400 ? { data } : { error: data }), {
    status,
  });

test('Vocabulary stays private when restoration fails', async () => {
  const previous = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return response(
      {
        code: 'AUTH_REQUIRED',
        message: 'Sign in',
        requestId: crypto.randomUUID(),
      },
      401,
    );
  };
  try {
    render(wrapped(<VocabularyPage />));
    assert.equal(screen.queryByText('Personal library'), null);
    await waitFor(() => assert.ok(redirects.includes('/auth')));
    assert.equal(
      calls.some((path) => path.includes('/vocabulary')),
      false,
    );
  } finally {
    cleanup();
    globalThis.fetch = previous;
    redirects.length = 0;
  }
});

test('manual Quick Add saves without context and duplicate opens the original item', async () => {
  const previous = globalThis.fetch;
  const calls: {
    path: string;
    method: string;
    body?: string;
    authorization?: string;
  }[] = [];
  const item = {
    id: '6e70ac95-5992-4894-8ef3-398cc17c84ab',
    lemma: 'issue',
    partOfSpeech: 'NOUN',
    definition: 'một vấn đề',
    definitionProvenance: 'USER_AUTHORED',
    attribution: null,
    sourceContext: null,
    note: '',
    importance: 1,
    archivedAt: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
  };
  let saved = false;
  globalThis.fetch = async (input, options) => {
    const path = String(input);
    const method = options?.method ?? 'GET';
    const headers = new Headers(options?.headers);
    calls.push({
      path,
      method,
      body: options?.body as string | undefined,
      authorization: headers.get('Authorization') ?? undefined,
    });
    if (path.endsWith('/auth/refresh'))
      return response({ accessToken: 'access-token' }, 201);
    if (path.endsWith('/me'))
      return response({
        id: crypto.randomUUID(),
        email: 'learner@example.test',
        timezone: 'UTC',
        preferences: {},
        createdAt: new Date().toISOString(),
      });
    if (path.endsWith('/tags')) return response([]);
    if (method === 'GET' && path.includes('/vocabulary?'))
      return response({ items: saved ? [item] : [], nextCursor: null });
    if (method === 'POST' && path.endsWith('/vocabulary')) {
      saved = true;
      return response(
        {
          item,
          created:
            calls.filter(
              (call) =>
                call.method === 'POST' && call.path.endsWith('/vocabulary'),
            ).length === 1,
        },
        calls.filter(
          (call) => call.method === 'POST' && call.path.endsWith('/vocabulary'),
        ).length === 1
          ? 201
          : 200,
      );
    }
    if (method === 'GET' && path.endsWith(`/vocabulary/${item.id}`))
      return response(item);
    throw new Error(`Unexpected ${method} ${path}`);
  };
  try {
    render(wrapped(<VocabularyPage />));
    await screen.findByText('Your library is empty');
    fireEvent.click(screen.getByRole('button', { name: 'Quick Add' }));
    assert.ok(screen.getByLabelText(/Source context/));
    fireEvent.change(screen.getByLabelText('English word or phrase'), {
      target: { value: 'issue' },
    });
    fireEvent.change(screen.getByLabelText('Part of speech'), {
      target: { value: 'NOUN' },
    });
    fireEvent.change(screen.getByLabelText('Your target meaning'), {
      target: { value: 'một vấn đề' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await waitFor(() => assert.ok(screen.getByText('Word saved.')));
    const post = calls.find(
      (call) => call.method === 'POST' && call.path.endsWith('/vocabulary'),
    )!;
    assert.equal(JSON.parse(post.body!).sourceContext, null);
    assert.equal(JSON.parse(post.body!).userId, undefined);
    assert.equal(post.authorization, 'Bearer access-token');
    assert.ok(screen.getByRole('heading', { name: 'issue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quick Add' }));
    fireEvent.change(screen.getByLabelText('English word or phrase'), {
      target: { value: 'issue' },
    });
    fireEvent.change(screen.getByLabelText('Part of speech'), {
      target: { value: 'NOUN' },
    });
    fireEvent.change(screen.getByLabelText('Your target meaning'), {
      target: { value: 'một vấn đề' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await waitFor(() => assert.ok(screen.getByText(/already saved/)));
    assert.equal(dom.window.localStorage.length, 0);
  } finally {
    cleanup();
    globalThis.fetch = previous;
    redirects.length = 0;
  }
});
