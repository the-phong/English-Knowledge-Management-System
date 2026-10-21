import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FoundationHome } from '../src/components/foundation-home';

test('foundation page renders a semantic main region without fake workflows', () => {
  const html = renderToStaticMarkup(<FoundationHome />);
  assert.match(html, /<main\b/);
  assert.match(html, /<h1>/);
  assert.match(
    html,
    /Authentication and learning workflows are not available yet/,
  );
  assert.doesNotMatch(html, /Sign in|Save a word|Start quiz/);
});
