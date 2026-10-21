require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../../dist/app.module');
const { configureApp } = require('../../dist/configure-app');
const { PrismaService } = require('../../dist/infrastructure/prisma.service');

const origin = 'http://localhost:3000';
const password = 'P04 isolated test password';
const suite = randomUUID();
const email = (label) => `p04-${label}-${suite}@example.test`;

test(
  'Vocabulary HTTP, PostgreSQL concurrency, identity, ownership and fallback',
  { timeout: 120000 },
  async () => {
    assert.match(
      process.env.DATABASE_URL ?? '',
      /\/ekms_p02_test(?:\?|$)/,
      'isolated EKMS test database required',
    );
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const server = app.getHttpServer();
    const prisma = app.get(PrismaService);
    const createdUsers = [];
    const access = (token) => ({ Authorization: `Bearer ${token}` });
    const mutate = (method, route, token, body, key) => {
      const agent = request(server);
      let call = agent[method](`/api/v1${route}`)
        .set('Origin', origin)
        .set(access(token));
      if (key) call = call.set('Idempotency-Key', key);
      return body === undefined ? call : call.send(body);
    };
    const registerAndLogin = async (label) => {
      const registered = await request(server)
        .post('/api/v1/auth/register')
        .set('Origin', origin)
        .send({ email: email(label), password });
      assert.equal(registered.status, 201, JSON.stringify(registered.body));
      createdUsers.push(registered.body.data.id);
      const loggedIn = await request(server)
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .send({ email: email(label), password });
      assert.equal(loggedIn.status, 201);
      return {
        id: registered.body.data.id,
        token: loggedIn.body.data.accessToken,
      };
    };

    try {
      const alice = await registerAndLogin('alice');
      const bob = await registerAndLogin('bob');
      const manual = {
        lemma: '  ＩＳＳＵＥ ',
        partOfSpeech: 'NOUN',
        definition: 'một vấn đề',
      };
      const key = randomUUID();
      const first = await mutate(
        'post',
        '/vocabulary',
        alice.token,
        manual,
        key,
      );
      assert.equal(first.status, 201, JSON.stringify(first.body));
      assert.equal(first.body.data.item.lemma, 'issue');
      assert.equal(first.body.data.item.sourceContext, null);
      assert.equal(first.body.data.item.definitionProvenance, 'USER_AUTHORED');
      const itemId = first.body.data.item.id;
      const replay = await mutate(
        'post',
        '/vocabulary',
        alice.token,
        manual,
        key,
      );
      assert.equal(replay.status, 201);
      assert.deepEqual(replay.body.data, first.body.data);
      const keyConflict = await mutate(
        'post',
        '/vocabulary',
        alice.token,
        { ...manual, definition: 'bản phát hành' },
        key,
      );
      assert.equal(keyConflict.status, 409);
      assert.equal(
        keyConflict.body.error.code,
        'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
      );
      const duplicate = await mutate(
        'post',
        '/vocabulary',
        alice.token,
        { ...manual, lemma: 'issue' },
        randomUUID(),
      );
      assert.equal(duplicate.status, 200);
      assert.equal(duplicate.body.data.created, false);
      assert.equal(duplicate.body.data.item.id, itemId);
      const anotherSense = await mutate(
        'post',
        '/vocabulary',
        alice.token,
        { ...manual, definition: 'bản phát hành' },
        randomUUID(),
      );
      assert.equal(anotherSense.status, 201);
      assert.notEqual(anotherSense.body.data.item.id, itemId);
      const bobCopy = await mutate(
        'post',
        '/vocabulary',
        bob.token,
        manual,
        randomUUID(),
      );
      assert.equal(bobCopy.status, 201);
      assert.notEqual(bobCopy.body.data.item.id, itemId);
      assert.equal(
        await prisma.vocabularyItem.count({
          where: { userId: alice.id, lexeme: { normalizedLemma: 'issue' } },
        }),
        2,
      );

      const nullContext = await mutate(
        'post',
        '/vocabulary',
        alice.token,
        { lemma: 'distinct', definition: 'riêng biệt', sourceContext: null },
        randomUUID(),
      );
      const emptyContext = await mutate(
        'post',
        '/vocabulary',
        alice.token,
        { lemma: 'another', definition: 'khác', sourceContext: '' },
        randomUUID(),
      );
      assert.equal(nullContext.body.data.item.sourceContext, null);
      assert.equal(emptyContext.body.data.item.sourceContext, null);
      assert.equal(
        (
          await mutate(
            'post',
            '/vocabulary',
            alice.token,
            {
              lemma: 'long',
              definition: 'nghĩa',
              sourceContext: 'x'.repeat(3001),
            },
            randomUUID(),
          )
        ).status,
        400,
      );

      const racePayload = {
        lemma: 'parallel',
        definition: 'diễn ra đồng thời',
      };
      const race = await Promise.all(
        Array.from({ length: 4 }, () =>
          mutate('post', '/vocabulary', alice.token, racePayload, randomUUID()),
        ),
      );
      assert.deepEqual(
        race.map((response) => response.status).sort(),
        [200, 200, 200, 201],
      );
      assert.equal(
        new Set(race.map((response) => response.body.data.item.id)).size,
        1,
      );
      assert.equal(
        await prisma.vocabularyItem.count({
          where: { userId: alice.id, lexeme: { normalizedLemma: 'parallel' } },
        }),
        1,
      );
      const sameKey = randomUUID();
      const sameKeyRace = await Promise.all([
        mutate(
          'post',
          '/vocabulary',
          alice.token,
          { lemma: 'retryable', definition: 'có thể thử lại' },
          sameKey,
        ),
        mutate(
          'post',
          '/vocabulary',
          alice.token,
          { lemma: 'retryable', definition: 'có thể thử lại' },
          sameKey,
        ),
      ]);
      assert.deepEqual(
        sameKeyRace.map((response) => response.status),
        [201, 201],
      );
      assert.equal(
        sameKeyRace[0].body.data.item.id,
        sameKeyRace[1].body.data.item.id,
      );

      const tagRace = await Promise.all([
        mutate(
          'post',
          '/tags',
          alice.token,
          { name: '  IELTS  ' },
          randomUUID(),
        ),
        mutate('post', '/tags', alice.token, { name: 'ielts' }, randomUUID()),
      ]);
      assert.deepEqual(
        tagRace.map((response) => response.status).sort(),
        [200, 201],
      );
      const tagId = tagRace[0].body.data.tag.id;
      const createdWithTag = await mutate(
        'post',
        '/vocabulary',
        alice.token,
        {
          lemma: 'tagged meaning',
          definition: 'nghĩa thử nghiệm',
          tagIds: [tagId],
        },
        randomUUID(),
      );
      assert.equal(
        createdWithTag.status,
        201,
        JSON.stringify(createdWithTag.body),
      );
      assert.equal(createdWithTag.body.data.item.tags[0].id, tagId);
      assert.equal(
        await prisma.contextTag.count({
          where: { userId: alice.id, normalizedName: 'ielts' },
        }),
        1,
      );
      const bobTag = await mutate(
        'post',
        '/tags',
        bob.token,
        { name: 'Private' },
        randomUUID(),
      );
      assert.equal(bobTag.status, 201);
      const foreignTagId = bobTag.body.data.tag.id;
      assert.equal(
        (
          await mutate('patch', `/vocabulary/${itemId}`, alice.token, {
            expectedVersion: 1,
            tagIds: [foreignTagId],
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await mutate(
            'post',
            '/vocabulary',
            alice.token,
            { lemma: 'foreign', definition: 'khác', tagIds: [foreignTagId] },
            randomUUID(),
          )
        ).status,
        404,
      );
      const edited = await mutate(
        'patch',
        `/vocabulary/${itemId}`,
        alice.token,
        {
          expectedVersion: 1,
          sourceContext: 'A user-observed source sentence.',
          note: 'Personal note',
          tagIds: [tagId],
        },
      );
      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      assert.equal(edited.body.data.tags[0].id, tagId);
      assert.equal(edited.body.data.version, 2);
      assert.equal(
        (
          await mutate('patch', `/vocabulary/${itemId}`, alice.token, {
            expectedVersion: 1,
            note: 'stale',
          })
        ).status,
        409,
      );
      const edits = await Promise.all([
        mutate('patch', `/vocabulary/${itemId}`, alice.token, {
          expectedVersion: 2,
          note: 'first concurrent edit',
        }),
        mutate('patch', `/vocabulary/${itemId}`, alice.token, {
          expectedVersion: 2,
          note: 'second concurrent edit',
        }),
      ]);
      assert.deepEqual(
        edits.map((response) => response.status).sort(),
        [200, 409],
      );

      const pageOne = await request(server)
        .get('/api/v1/vocabulary?limit=1')
        .set(access(alice.token));
      assert.equal(pageOne.status, 200);
      assert.equal(pageOne.body.data.items.length, 1);
      assert.ok(pageOne.body.data.nextCursor);
      const pageTwo = await request(server)
        .get(
          `/api/v1/vocabulary?limit=1&cursor=${encodeURIComponent(pageOne.body.data.nextCursor)}`,
        )
        .set(access(alice.token));
      assert.equal(pageTwo.status, 200);
      assert.notEqual(
        pageTwo.body.data.items[0].id,
        pageOne.body.data.items[0].id,
      );
      const tampered = await request(server)
        .get(
          `/api/v1/vocabulary?cursor=${encodeURIComponent(pageOne.body.data.nextCursor + 'x')}`,
        )
        .set(access(alice.token));
      assert.equal(tampered.status, 400);
      assert.equal(tampered.body.error.code, 'INVALID_CURSOR');
      assert.equal(
        (
          await request(server)
            .get(
              `/api/v1/vocabulary?cursor=${encodeURIComponent(pageOne.body.data.nextCursor)}`,
            )
            .set(access(bob.token))
        ).status,
        400,
      );
      assert.equal(
        (
          await request(server)
            .get(
              `/api/v1/vocabulary?cursor=${encodeURIComponent(pageOne.body.data.nextCursor)}&status=archived`,
            )
            .set(access(alice.token))
        ).status,
        400,
      );
      assert.equal(
        (
          await request(server)
            .get(`/api/v1/vocabulary?tag=${tagId}`)
            .set(access(alice.token))
        ).body.data.items.length,
        2,
      );
      assert.equal(
        (
          await request(server)
            .get('/api/v1/vocabulary?q=issue')
            .set(access(alice.token))
        ).body.data.items.length,
        2,
      );

      const current = await request(server)
        .get(`/api/v1/vocabulary/${itemId}`)
        .set(access(alice.token));
      const archived = await mutate(
        'post',
        `/vocabulary/${itemId}/archive`,
        alice.token,
        { expectedVersion: current.body.data.version },
        randomUUID(),
      );
      assert.equal(archived.status, 200);
      assert.ok(archived.body.data.archivedAt);
      assert.equal(
        (
          await request(server)
            .get('/api/v1/vocabulary?q=issue')
            .set(access(alice.token))
        ).body.data.items.length,
        1,
      );
      assert.equal(
        (
          await request(server)
            .get('/api/v1/vocabulary?status=archived')
            .set(access(alice.token))
        ).body.data.items.some((item) => item.id === itemId),
        true,
      );
      const restored = await mutate(
        'post',
        `/vocabulary/${itemId}/restore`,
        alice.token,
        { expectedVersion: archived.body.data.version },
        randomUUID(),
      );
      assert.equal(restored.status, 200);
      assert.equal(restored.body.data.archivedAt, null);
      assert.equal(
        (
          await mutate(
            'post',
            `/vocabulary/${itemId}/archive`,
            alice.token,
            { expectedVersion: archived.body.data.version },
            randomUUID(),
          )
        ).status,
        409,
      );

      const fixture = await request(server)
        .get('/api/v1/dictionary/lookup?q=issue&provider=fixture')
        .set(access(alice.token));
      assert.equal(fixture.status, 200);
      assert.equal(fixture.body.data.senses.length, 2);
      assert.equal(fixture.body.data.senses[0].provenance, 'LOCAL_FIXTURE');
      const missingProvider = await request(server)
        .get('/api/v1/dictionary/lookup?q=issue')
        .set(access(alice.token));
      assert.equal(missingProvider.body.data.status, 'unavailable');
      const fixtureItem = await mutate(
        'post',
        '/vocabulary',
        alice.token,
        {
          lemma: 'issue',
          sourceSenseId: fixture.body.data.senses[0].sourceSenseId,
        },
        randomUUID(),
      );
      assert.equal(fixtureItem.status, 201);
      assert.equal(
        fixtureItem.body.data.item.attribution,
        'EKMS original development fixture',
      );
      assert.equal(
        (
          await mutate(
            'post',
            '/vocabulary',
            alice.token,
            { lemma: 'issue', sourceSenseId: 'unknown-source' },
            randomUUID(),
          )
        ).status,
        409,
      );

      for (const route of [`/vocabulary/${bobCopy.body.data.item.id}`]) {
        assert.equal(
          (
            await request(server)
              .get(`/api/v1${route}`)
              .set(access(alice.token))
          ).status,
          404,
        );
        assert.equal(
          (
            await mutate('patch', route, alice.token, {
              expectedVersion: 1,
              note: 'attack',
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await mutate(
              'post',
              `${route}/archive`,
              alice.token,
              { expectedVersion: 1 },
              randomUUID(),
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await mutate(
              'post',
              `${route}/restore`,
              alice.token,
              { expectedVersion: 1 },
              randomUUID(),
            )
          ).status,
          404,
        );
      }
      assert.equal(
        (
          await mutate('patch', `/tags/${foreignTagId}`, alice.token, {
            name: 'stolen',
            expectedVersion: 1,
          })
        ).status,
        404,
      );
      assert.equal(
        (await mutate('delete', `/tags/${foreignTagId}`, alice.token)).status,
        404,
      );
      assert.equal(
        (
          await mutate(
            'post',
            '/vocabulary',
            alice.token,
            { lemma: 'hijack', definition: 'x', userId: bob.id },
            randomUUID(),
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await mutate('post', '/vocabulary', alice.token, {
            lemma: 'invalid',
            definition: 'x',
          })
        ).status,
        400,
      );
      assert.equal(
        (await request(server).get('/api/v1/vocabulary')).status,
        401,
      );
      assert.equal(
        (
          await request(server)
            .get('/api/v1/vocabulary/not-a-uuid')
            .set(access(alice.token))
        ).status,
        400,
      );
      assert.equal(
        (
          await request(server)
            .get(`/api/v1/vocabulary/${randomUUID()}`)
            .set(access(alice.token))
        ).status,
        404,
      );
      assert.equal(
        (
          await request(server)
            .post('/api/v1/vocabulary')
            .set(access(alice.token))
            .send(manual)
        ).status,
        403,
      );
      assert.equal(
        (
          await request(server)
            .post('/api/v1/vocabulary')
            .set('Origin', 'https://evil.example')
            .set(access(alice.token))
            .send(manual)
        ).status,
        403,
      );
      const invalidJson = await request(server)
        .post('/api/v1/vocabulary')
        .set('Origin', origin)
        .set(access(alice.token))
        .set('Content-Type', 'application/json')
        .send('{bad');
      assert.equal(invalidJson.status, 400);
      assert.equal(invalidJson.body.error.code, 'VALIDATION_ERROR');
      assert.equal(
        invalidJson.body.error.requestId,
        invalidJson.headers['x-request-id'],
      );
      assert.doesNotMatch(
        JSON.stringify(first.body),
        /passwordHash|tokenHash|senseKey|userId/,
      );

      const renamedTag = await mutate('patch', `/tags/${tagId}`, alice.token, {
        name: 'Academic',
        expectedVersion: 1,
      });
      assert.equal(renamedTag.status, 200);
      assert.equal(
        (await mutate('delete', `/tags/${tagId}`, alice.token)).status,
        200,
      );
      assert.equal(
        (
          await request(server)
            .get(`/api/v1/vocabulary/${itemId}`)
            .set(access(alice.token))
        ).body.data.tags.length,
        0,
      );
      assert.equal(
        (
          await prisma.$queryRawUnsafe(
            "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('mastery_snapshots','learning_attempts')",
          )
        )[0].n,
        0,
      );
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
      await app.close();
    }
  },
);
