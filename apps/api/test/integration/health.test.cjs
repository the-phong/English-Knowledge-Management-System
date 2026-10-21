require('reflect-metadata');
const { Buffer } = require('node:buffer');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../../dist/app.module');
const { configureApp } = require('../../dist/configure-app');
const {
  DatabaseService,
} = require('../../dist/infrastructure/database.service');
const { RedisService } = require('../../dist/infrastructure/redis.service');
const { API_ENV } = require('../../dist/tokens');

async function createApp(databaseCheck, redisCheck) {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(API_ENV)
    .useValue({
      API_PORT: 3001,
      DATABASE_URL: 'postgresql://test:local@localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'test',
      JWT_SIGNING_KEY_B64: Buffer.alloc(32, 1).toString('base64'),
      REFRESH_PEPPER_B64: Buffer.alloc(32, 2).toString('base64'),
      JWT_ISSUER: 'ekms-test',
      JWT_AUDIENCE: 'ekms-test-web',
      AUTH_ALLOWED_ORIGINS: ['http://localhost:3000'],
      AUTH_COOKIE_SECURE: false,
      AUTH_LOGIN_IP_LIMIT: 20,
      AUTH_LOGIN_ACCOUNT_LIMIT: 5,
      AUTH_REGISTER_IP_LIMIT: 5,
      AUTH_REFRESH_IP_LIMIT: 30,
    })
    .overrideProvider(DatabaseService)
    .useValue({ check: databaseCheck, onModuleDestroy: async () => {} })
    .overrideProvider(RedisService)
    .useValue({ check: redisCheck, onModuleDestroy: async () => {} })
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

test('liveness, readiness, request ID and response envelope', async () => {
  const app = await createApp(
    async () => {},
    async () => {},
  );
  try {
    const live = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'client-forged');
    assert.equal(live.status, 200);
    assert.deepEqual(live.body, { data: { status: 'ok' } });
    assert.match(live.headers['x-request-id'], /^[0-9a-f-]{36}$/);
    assert.notEqual(live.headers['x-request-id'], 'client-forged');
    const ready = await request(app.getHttpServer()).get(
      '/api/v1/health/ready',
    );
    assert.equal(ready.status, 200);
    assert.deepEqual(ready.body, { data: { status: 'ready' } });
  } finally {
    await app.close();
  }
});

test('readiness fails closed and error details do not expose dependencies', async () => {
  const app = await createApp(
    async () => {
      throw new Error('postgresql://secret');
    },
    async () => {},
  );
  try {
    const ready = await request(app.getHttpServer()).get(
      '/api/v1/health/ready',
    );
    assert.equal(ready.status, 503);
    assert.equal(ready.body.error.code, 'DEPENDENCY_UNAVAILABLE');
    assert.equal(ready.body.error.requestId, ready.headers['x-request-id']);
    assert.doesNotMatch(JSON.stringify(ready.body), /secret|postgresql/);
    const live = await request(app.getHttpServer()).get('/api/v1/health/live');
    assert.equal(live.status, 200);
  } finally {
    await app.close();
  }
});

test('Redis failure also makes readiness unavailable', async () => {
  const app = await createApp(
    async () => {},
    async () => {
      throw new Error('redis://secret');
    },
  );
  try {
    const ready = await request(app.getHttpServer()).get(
      '/api/v1/health/ready',
    );
    assert.equal(ready.status, 503);
    assert.equal(ready.body.error.code, 'DEPENDENCY_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(ready.body), /secret|redis:\/\//);
  } finally {
    await app.close();
  }
});

test('unknown API route uses standard error envelope', async () => {
  const app = await createApp(
    async () => {},
    async () => {},
  );
  try {
    const res = await request(app.getHttpServer()).get('/api/v1/not-found');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'RESOURCE_NOT_FOUND');
    assert.equal(res.body.error.requestId, res.headers['x-request-id']);
  } finally {
    await app.close();
  }
});
