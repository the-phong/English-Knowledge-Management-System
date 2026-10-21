const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseApiEnv, parseWorkerEnv, parseWebEnv } = require('../dist');

const valid = {
  DATABASE_URL: 'postgresql://user:local@localhost:5432/ekms_dev',
  REDIS_URL: 'redis://localhost:6379',
};

test('API configuration rejects a missing database URL', () => {
  assert.throws(() => parseApiEnv({ REDIS_URL: valid.REDIS_URL }));
});

test('API configuration rejects an invalid port', () => {
  assert.throws(() => parseApiEnv({ ...valid, API_PORT: '70000' }));
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
