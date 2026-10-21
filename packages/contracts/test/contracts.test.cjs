const { test } = require('node:test');
const assert = require('node:assert/strict');
const { errorEnvelopeSchema, healthSchema } = require('../dist');

test('foundation response schemas reject malformed payloads', () => {
  assert.equal(healthSchema.parse({ status: 'ok' }).status, 'ok');
  assert.equal(
    errorEnvelopeSchema.safeParse({
      error: { code: 'X', message: 'safe', requestId: 'bad' },
    }).success,
    false,
  );
});
