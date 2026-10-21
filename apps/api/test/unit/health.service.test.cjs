require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HealthService } = require('../../dist/health/health.service');

test('readiness checks both required dependencies', async () => {
  let databaseCalled = 0;
  let redisCalled = 0;
  const service = new HealthService(
    {
      check: async () => {
        databaseCalled++;
      },
    },
    {
      check: async () => {
        redisCalled++;
      },
    },
  );
  assert.deepEqual(await service.ready(), { status: 'ready' });
  assert.equal(databaseCalled, 1);
  assert.equal(redisCalled, 1);
});
