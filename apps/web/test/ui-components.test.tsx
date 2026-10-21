import { dom } from './setup-dom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../src/components/ui/button';
import { TextField } from '../src/components/ui/text-field';
import { Alert, EmptyState, LoadingState } from '../src/components/ui/surfaces';
import { AppShell } from '../src/components/app-shell';

test('button variants retain native disabled semantics and loading feedback', () => {
  let clicks = 0;
  try {
    render(
      <Button variant="danger" disabled onClick={() => clicks++}>
        Remove access
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Remove access' });
    fireEvent.click(button);
    assert.equal(clicks, 0);
    assert.equal(button.hasAttribute('disabled'), true);
    assert.match(button.className, /ui-button--danger/);
    cleanup();
    render(<Button loading>Saving…</Button>);
    const loading = screen.getByRole('button', { name: 'Saving…' });
    assert.equal(loading.getAttribute('aria-busy'), 'true');
    assert.equal(loading.hasAttribute('disabled'), true);
  } finally {
    cleanup();
  }
});

test('field error is associated with its label and input', () => {
  try {
    render(
      <TextField
        id="test-email"
        label="Email"
        hint="Your account email"
        error="Enter a valid email"
      />,
    );
    const input = screen.getByLabelText('Email');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(
      input.getAttribute('aria-describedby'),
      'test-email-hint test-email-error',
    );
    assert.equal(
      dom.window.document.getElementById('test-email-error')?.textContent,
      'Enter a valid email',
    );
  } finally {
    cleanup();
  }
});

test('feedback and empty states communicate with text as well as color', () => {
  const html = renderToStaticMarkup(
    <>
      <Alert tone="error">
        <p>Connection unavailable.</p>
      </Alert>
      <LoadingState label="Loading sessions…" />
      <EmptyState
        title="No active sessions"
        description="Sign in again if needed."
      />
    </>,
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /Connection unavailable/);
  assert.match(html, /role="status"/);
  assert.match(html, /No active sessions/);
});

test('workspace navigation exposes only working routes and current page', () => {
  const html = renderToStaticMarkup(
    <AppShell current="account" userEmail="test@example.test">
      <h1>Account and security</h1>
    </AppShell>,
  );
  assert.match(html, /aria-label="Workspace"/);
  assert.match(html, /href="\/app"/);
  assert.match(html, /href="\/vocabulary"/);
  assert.match(html, /href="\/account"/);
  assert.match(html, /aria-current="page"/);
  assert.doesNotMatch(html, /href="\/(learning|writing|progress)"/);
});
