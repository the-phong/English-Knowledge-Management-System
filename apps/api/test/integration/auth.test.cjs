require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Buffer } = require('node:buffer');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../../dist/app.module');
const { configureApp } = require('../../dist/configure-app');
const { PrismaService } = require('../../dist/infrastructure/prisma.service');

const origin = 'http://localhost:3000';
const password = 'P02 test password 123!';
const suite = randomUUID();
const email = (label) => `${label}-${suite}@example.test`;
const cookie = (response) =>
  response.headers['set-cookie']
    ?.find((value) => value.startsWith('ekms_refresh='))
    ?.split(';')[0];
const auth = (token) => `Bearer ${token}`;

test(
  'real PostgreSQL and HTTP authentication, session isolation and security behavior',
  { timeout: 120000 },
  async () => {
    assert.match(
      process.env.DATABASE_URL ?? '',
      /\/ekms_p02_test(?:\?|$)/,
      'isolated test database required',
    );
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const server = app.getHttpServer();
    const prisma = app.get(PrismaService);
    const created = [];
    const post = (route) =>
      request(server).post(`/api/v1/auth/${route}`).set('Origin', origin);
    const del = (route) =>
      request(server).delete(`/api/v1/auth/${route}`).set('Origin', origin);
    const register = async (label) => {
      const res = await post('register').send({
        email: email(label),
        password,
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      created.push(res.body.data.id);
      assert.equal(res.body.data.passwordHash, undefined);
      return res.body.data;
    };
    const login = async (label) => {
      const res = await post('login').send({ email: email(label), password });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.ok(cookie(res));
      return res;
    };

    try {
      const live = await request(server).get('/api/v1/health/live');
      const ready = await request(server).get('/api/v1/health/ready');
      assert.equal(live.status, 200);
      assert.equal(ready.status, 200);

      const pair = await Promise.all([
        post('register').send({ email: email('race').toUpperCase(), password }),
        post('register').send({ email: email('race'), password }),
      ]);
      assert.deepEqual(pair.map((item) => item.status).sort(), [201, 409]);
      created.push(pair.find((item) => item.status === 201).body.data.id);
      assert.equal(
        await prisma.user.count({ where: { normalizedEmail: email('race') } }),
        1,
      );

      await register('alice');
      await register('bob');
      const invalid = await post('login').send({
        email: email('alice'),
        password: 'wrong password',
      });
      const unknown = await post('login').send({
        email: email('unknown'),
        password: 'wrong password',
      });
      assert.equal(invalid.status, 401);
      assert.deepEqual(invalid.body.error, {
        ...unknown.body.error,
        requestId: invalid.body.error.requestId,
      });
      assert.equal(unknown.status, 401);

      const alice = await login('alice');
      const bob = await login('bob');
      assert.equal(alice.headers['access-control-allow-origin'], origin);
      assert.equal(alice.headers['access-control-allow-credentials'], 'true');
      assert.match(cookie(alice), /^ekms_refresh=/);
      assert.match(alice.headers['set-cookie'][0], /HttpOnly/i);
      assert.match(alice.headers['set-cookie'][0], /SameSite=Lax/i);
      assert.match(alice.headers['set-cookie'][0], /Path=\/api\/v1\/auth/i);
      assert.doesNotMatch(alice.headers['set-cookie'][0], /Secure/i);
      const me = await request(server)
        .get('/api/v1/me')
        .set('Authorization', auth(alice.body.data.accessToken));
      assert.equal(me.status, 200);
      assert.equal(me.body.data.email, email('alice'));
      const sessions = await request(server)
        .get('/api/v1/auth/sessions')
        .set('Authorization', auth(alice.body.data.accessToken));
      assert.equal(sessions.status, 200);
      assert.equal(sessions.body.data.length, 1);
      assert.equal(sessions.body.data[0].current, true);
      assert.doesNotMatch(
        JSON.stringify(sessions.body),
        /tokenHash|passwordHash|ekms_refresh/,
      );

      const bobSession = await request(server)
        .get('/api/v1/auth/sessions')
        .set('Authorization', auth(bob.body.data.accessToken));
      const cross = await del(`sessions/${bobSession.body.data[0].id}`).set(
        'Authorization',
        auth(alice.body.data.accessToken),
      );
      assert.equal(cross.status, 404);
      assert.equal(cross.body.error.code, 'RESOURCE_NOT_FOUND');
      assert.equal(cross.body.error.requestId, cross.headers['x-request-id']);

      const rotated = await post('refresh').set('Cookie', cookie(alice));
      assert.equal(rotated.status, 201);
      assert.notEqual(cookie(rotated), cookie(alice));
      const oldAccess = await request(server)
        .get('/api/v1/me')
        .set('Authorization', auth(alice.body.data.accessToken));
      assert.equal(oldAccess.status, 401);
      const newAccess = await request(server)
        .get('/api/v1/me')
        .set('Authorization', auth(rotated.body.data.accessToken));
      assert.equal(newAccess.status, 200);
      const replay = await post('refresh').set('Cookie', cookie(alice));
      assert.equal(replay.status, 401);
      assert.equal(replay.body.error.code, 'AUTH_REFRESH_REUSE_DETECTED');
      assert.match(replay.headers['set-cookie'][0], /^ekms_refresh=;/);
      assert.match(
        replay.headers['set-cookie'][0],
        /Expires=Thu, 01 Jan 1970 00:00:00 GMT/,
      );
      const afterReplay = await request(server)
        .get('/api/v1/me')
        .set('Authorization', auth(rotated.body.data.accessToken));
      assert.equal(afterReplay.status, 401);
      assert.equal(
        await prisma.securityEvent.count({
          where: {
            userId: me.body.data.id,
            eventType: 'REFRESH_REUSE_DETECTED',
          },
        }),
        1,
      );
      assert.equal(
        await prisma.refreshSession.count({
          where: { userId: me.body.data.id, revokedAt: null },
        }),
        0,
      );

      const fresh = await login('alice');
      const concurrent = await Promise.all([
        post('refresh').set('Cookie', cookie(fresh)),
        post('refresh').set('Cookie', cookie(fresh)),
      ]);
      assert.deepEqual(
        concurrent.map((item) => item.status).sort(),
        [201, 401],
      );
      assert.equal(
        concurrent.find((item) => item.status === 401).body.error.code,
        'AUTH_REFRESH_REUSE_DETECTED',
      );
      const winner = concurrent.find((item) => item.status === 201);
      assert.equal(
        (
          await request(server)
            .get('/api/v1/me')
            .set('Authorization', auth(winner.body.data.accessToken))
        ).status,
        401,
      );

      const logoutSession = await login('alice');
      const issued = jwt.decode(logoutSession.body.data.accessToken);
      const expiredAccess = jwt.sign(
        { sessionId: issued.sessionId },
        Buffer.from(process.env.JWT_SIGNING_KEY_B64, 'base64'),
        {
          algorithm: 'HS256',
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
          subject: issued.sub,
          expiresIn: -1,
        },
      );
      const loggedOut = await post('logout')
        .set('Cookie', cookie(logoutSession))
        .set('Authorization', auth(expiredAccess));
      assert.equal(loggedOut.status, 201);
      assert.match(loggedOut.headers['set-cookie'][0], /Path=\/api\/v1\/auth/);
      assert.equal(
        (
          await request(server)
            .get('/api/v1/me')
            .set('Authorization', auth(logoutSession.body.data.accessToken))
        ).status,
        401,
      );

      const one = await login('alice');
      const two = await login('alice');
      const list = await request(server)
        .get('/api/v1/auth/sessions')
        .set('Authorization', auth(one.body.data.accessToken));
      const other = list.body.data.find((item) => !item.current);
      assert.ok(other);
      assert.equal(
        (
          await del(`sessions/${other.id}`).set(
            'Authorization',
            auth(one.body.data.accessToken),
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(server)
            .get('/api/v1/me')
            .set('Authorization', auth(two.body.data.accessToken))
        ).status,
        401,
      );
      assert.equal(
        (
          await post('logout-all').set(
            'Authorization',
            auth(one.body.data.accessToken),
          )
        ).status,
        201,
      );
      assert.equal(
        (
          await request(server)
            .get('/api/v1/me')
            .set('Authorization', auth(one.body.data.accessToken))
        ).status,
        401,
      );
      assert.equal(
        (
          await request(server)
            .get('/api/v1/me')
            .set('Authorization', auth(bob.body.data.accessToken))
        ).status,
        200,
      );
      const bobOriginalSessions = await request(server)
        .get('/api/v1/auth/sessions')
        .set('Authorization', auth(bob.body.data.accessToken));
      const bobOriginalId = bobOriginalSessions.body.data.find(
        (item) => item.current,
      ).id;
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await tx.refreshSession.update({
            where: { id: bobOriginalId },
            data: { revokedAt: new Date() },
          });
          throw new Error('forced test rollback');
        }),
        /forced test rollback/,
      );
      assert.equal(
        (
          await prisma.refreshSession.findUnique({
            where: { id: bobOriginalId },
          })
        ).revokedAt,
        null,
      );

      const expired = await login('bob');
      const expiredSessions = await request(server)
        .get('/api/v1/auth/sessions')
        .set('Authorization', auth(expired.body.data.accessToken));
      const expiredId = expiredSessions.body.data.find(
        (item) => item.current,
      ).id;
      await prisma.refreshSession.update({
        where: { id: expiredId },
        data: {
          createdAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() - 1_000),
        },
      });
      const expiredRefresh = await post('refresh').set(
        'Cookie',
        cookie(expired),
      );
      assert.equal(expiredRefresh.status, 401);
      assert.equal(expiredRefresh.body.error.code, 'AUTH_REQUIRED');

      const revocable = await login('bob');
      const revocableSessions = await request(server)
        .get('/api/v1/auth/sessions')
        .set('Authorization', auth(revocable.body.data.accessToken));
      const revocableId = revocableSessions.body.data.find(
        (item) => item.current,
      ).id;
      assert.equal(
        (
          await del(`sessions/${revocableId}`).set(
            'Authorization',
            auth(bob.body.data.accessToken),
          )
        ).status,
        200,
      );
      const revokedRefresh = await post('refresh').set(
        'Cookie',
        cookie(revocable),
      );
      assert.equal(revokedRefresh.status, 401);
      assert.equal(revokedRefresh.body.error.code, 'AUTH_REQUIRED');
      assert.equal(
        (
          await request(server)
            .get('/api/v1/me')
            .set('Authorization', auth(revocable.body.data.accessToken))
        ).status,
        401,
      );

      const missingOrigin = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie(bob));
      const maliciousOrigin = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'https://evil.example')
        .set('Cookie', cookie(bob));
      assert.equal(missingOrigin.status, 403);
      assert.equal(maliciousOrigin.status, 403);
      const cors = await request(server)
        .options('/api/v1/auth/login')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      assert.notEqual(
        cors.headers['access-control-allow-origin'],
        'https://evil.example',
      );
      const noCookie = await post('refresh');
      assert.equal(noCookie.status, 401);
      const invalidJwt = await request(server)
        .get('/api/v1/me')
        .set('Authorization', 'Bearer malformed');
      assert.equal(invalidJwt.status, 401);
      const invalidInput = await post('register').send({
        email: 'invalid',
        password: 'short',
      });
      assert.equal(invalidInput.status, 400);
      assert.equal(invalidInput.body.error.code, 'VALIDATION_ERROR');
      const limited = [];
      for (let i = 0; i < 8; i++)
        limited.push(
          await post('login').send({
            email: email('throttled'),
            password: 'invalid password',
          }),
        );
      assert.equal(limited.at(-1).status, 429);
      assert.ok(Number(limited.at(-1).headers['retry-after']) > 0);

      const allResponses = [
        alice,
        bob,
        rotated,
        replay,
        ...concurrent,
        loggedOut,
        one,
        two,
      ];
      for (const response of allResponses) {
        const printed = JSON.stringify(response.body);
        assert.doesNotMatch(
          printed,
          /passwordHash|tokenHash|P02 test password/,
        );
      }
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: created } } });
      await app.close();
    }
  },
);
