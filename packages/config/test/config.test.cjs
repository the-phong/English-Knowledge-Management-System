const { test } = require('node:test');
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
const { parseApiEnv, parseWorkerEnv, parseWebEnv } = require('../dist');

const valid = {
  DATABASE_URL: 'postgresql://user:local@localhost:5432/ekms_dev',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SIGNING_KEY_B64: Buffer.alloc(32, 1).toString('base64'),
  REFRESH_PEPPER_B64: Buffer.alloc(32, 2).toString('base64'),
  JWT_ISSUER: 'ekms-test',
  JWT_AUDIENCE: 'ekms-web',
  AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
  AUTH_COOKIE_SECURE: 'false',
};

test('API configuration rejects a missing database URL', () => {
  assert.throws(() => parseApiEnv({ REDIS_URL: valid.REDIS_URL }));
});

test('API configuration rejects an invalid port', () => {
  assert.throws(() => parseApiEnv({ ...valid, API_PORT: '70000' }));
  assert.equal(parseApiEnv(valid).API_PORT, 3001);
});

test('API authentication configuration fails closed for weak keys and unsafe production cookies', () => {
  assert.throws(() => parseApiEnv({ ...valid, JWT_SIGNING_KEY_B64: 'weak' }));
  assert.throws(() =>
    parseApiEnv({ ...valid, REFRESH_PEPPER_B64: valid.JWT_SIGNING_KEY_B64 }),
  );
  assert.throws(() => parseApiEnv({ ...valid, NODE_ENV: 'production' }));
  assert.throws(() =>
    parseApiEnv({
      ...valid,
      NODE_ENV: 'production',
      AUTH_COOKIE_SECURE: 'true',
    }),
  );
  assert.equal(
    parseApiEnv({
      ...valid,
      NODE_ENV: 'production',
      AUTH_COOKIE_SECURE: 'true',
      AUTH_ALLOWED_ORIGINS: 'https://ekms.example',
    }).AUTH_COOKIE_SECURE,
    true,
  );
});

test('worker configuration accepts only Redis and PostgreSQL URLs', () => {
  assert.equal(parseWorkerEnv(valid).REDIS_URL, valid.REDIS_URL);
  assert.throws(() =>
    parseWorkerEnv({ ...valid, REDIS_URL: 'https://localhost:6379' }),
  );
});

test('web configuration requires an internal API URL', () => {
  assert.throws(() => parseWebEnv({}));
  assert.equal(
    parseWebEnv({ API_INTERNAL_URL: 'http://api:3001' }).API_INTERNAL_URL,
    'http://api:3001',
  );
});
