const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const {
  CursorCodec,
  manualSenseKey,
  normalizeContext,
  normalizeLemma,
  normalizeTag,
  requestHash,
  validateDefinition,
  validateNote,
} = require('../../dist/vocabulary/vocabulary-domain');
const {
  FixtureDictionaryProvider,
  guardedLookup,
  denyAllDictionaryRights,
} = require('../../dist/vocabulary/dictionary.provider');

test('lemma NFKC, whitespace, case and length preserve distinct senses', () => {
  assert.equal(normalizeLemma('  ＩＳＳＵＥ\t  One  '), 'issue one');
  assert.equal(normalizeLemma('Điểm'), 'điểm');
  assert.throws(() => normalizeLemma(' '.repeat(5)), /Invalid lemma/);
  assert.throws(() => normalizeLemma('a'.repeat(101)), /Invalid lemma/);
  const one = manualSenseKey('issue', 'NOUN', 'một vấn đề');
  assert.equal(one, manualSenseKey('issue', 'NOUN', '  MỘT   VẤN ĐỀ '));
  assert.notEqual(one, manualSenseKey('issue', 'NOUN', 'một số báo'));
  assert.notEqual(one, manualSenseKey('issue', 'VERB', 'một vấn đề'));
});

test('optional context, definition, note and tag boundaries', () => {
  assert.equal(normalizeContext(undefined), null);
  assert.equal(normalizeContext(null), null);
  assert.equal(normalizeContext('  '), null);
  assert.equal(normalizeContext('  câu gốc  '), 'câu gốc');
  assert.throws(
    () => normalizeContext('a'.repeat(3001)),
    /Invalid source context/,
  );
  assert.equal(validateDefinition(' nghĩa '), 'nghĩa');
  assert.throws(() => validateDefinition(' '), /Invalid definition/);
  assert.throws(
    () => validateDefinition('a'.repeat(1001)),
    /Invalid definition/,
  );
  assert.equal(validateNote(undefined), '');
  assert.throws(() => validateNote('a'.repeat(3001)), /Invalid note/);
  assert.deepEqual(normalizeTag('  Học   Thuật '), {
    name: 'Học Thuật',
    normalizedName: 'học thuật',
  });
  assert.throws(() => normalizeTag(' '.repeat(10)), /Invalid tag name/);
});

test('cursor signature, user/filter scope, expiry and request fingerprints', () => {
  const codec = new CursorCodec(randomBytes(32).toString('base64'));
  const scope = {
    userId: randomUUID(),
    status: 'active',
    search: 'issue',
    tagId: null,
  };
  const payload = {
    ...scope,
    createdAt: new Date().toISOString(),
    id: randomUUID(),
    expiresAt: Date.now() + 60_000,
  };
  const cursor = codec.encode(payload);
  assert.deepEqual(codec.decode(cursor, scope), payload);
  assert.throws(() => codec.decode(`${cursor}x`, scope), /Invalid cursor/);
  assert.throws(
    () => codec.decode(cursor, { ...scope, userId: randomUUID() }),
    /Invalid cursor/,
  );
  assert.throws(
    () => codec.decode(cursor, { ...scope, status: 'archived' }),
    /Invalid cursor/,
  );
  assert.throws(
    () =>
      codec.decode(
        codec.encode({ ...payload, expiresAt: Date.now() - 1 }),
        scope,
      ),
    /Invalid cursor/,
  );
  assert.equal(requestHash({ a: 1, b: 2 }), requestHash({ b: 2, a: 1 }));
  assert.notEqual(requestHash({ a: 1 }), requestHash({ a: 2 }));
});

test('fixture rights are explicit; missing, timeout and malformed providers fail safely', async () => {
  const fixture = new FixtureDictionaryProvider();
  assert.equal(denyAllDictionaryRights.persistentStorageAllowed, false);
  assert.equal(denyAllDictionaryRights.cacheAllowed, false);
  assert.equal(denyAllDictionaryRights.aiProcessingAllowed, false);
  assert.equal(fixture.rights.persistentStorageAllowed, true);
  const senses = await guardedLookup(fixture, 'issue');
  assert.equal(senses.length, 2);
  assert.notEqual(senses[0].sourceSenseId, senses[1].sourceSenseId);
  assert.equal(senses[0].attribution, 'EKMS original development fixture');
  assert.deepEqual(await guardedLookup(fixture, 'unknown'), []);
  await assert.rejects(
    guardedLookup(
      { ...fixture, id: 'bad', lookup: async () => [{ invented: true }] },
      'issue',
    ),
    /Dictionary unavailable/,
  );
  await assert.rejects(
    guardedLookup(
      { ...fixture, lookup: () => new Promise(() => {}) },
      'issue',
      5,
    ),
    /Dictionary unavailable/,
  );
  await assert.rejects(
    guardedLookup({ ...fixture, rights: denyAllDictionaryRights }, 'issue'),
    /Dictionary unavailable/,
  );
});
