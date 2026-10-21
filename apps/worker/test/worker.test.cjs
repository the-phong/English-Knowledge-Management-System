const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FOUNDATION_QUEUE, workerRedisOptions } = require('../dist/queue');

test('worker infrastructure uses bounded retry options for the designated queue', () => {
  assert.equal(FOUNDATION_QUEUE, 'ekms-foundation');
  const options = workerRedisOptions();
  assert.equal(options.lazyConnect, true);
  assert.equal(options.maxRetriesPerRequest, null);
  assert.equal(options.retryStrategy(20), 3000);
});
