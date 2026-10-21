require('reflect-metadata');
const { Buffer } = require('node:buffer');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { AccessTokenService } = require('../../dist/auth/access-token.service');
const { CredentialsDto, normalizeEmail } = require('../../dist/auth/auth.dto');
const {
  hashPassword,
  verifyPassword,
  newRefreshToken,
  hashRefreshToken,
} = require('../../dist/auth/auth-crypto');
const { OriginGuard } = require('../../dist/auth/origin.guard');
const { RateLimitService } = require('../../dist/auth/rate-limit.service');
const { AuthController } = require('../../dist/auth/auth.controller');

const env = {
  JWT_SIGNING_KEY_B64: Buffer.alloc(32, 1).toString('base64'),
  REFRESH_PEPPER_B64: Buffer.alloc(32, 2).toString('base64'),
  JWT_ISSUER: 'ekms-test',
  JWT_AUDIENCE: 'ekms-test-web',
  AUTH_ALLOWED_ORIGINS: ['http://localhost:3000'],
  AUTH_LOGIN_IP_LIMIT: 20,
  AUTH_LOGIN_ACCOUNT_LIMIT: 5,
  AUTH_REGISTER_IP_LIMIT: 5,
  AUTH_REFRESH_IP_LIMIT: 30,
};
const identity = {
  userId: 'de313390-0c3b-4e57-a17f-a1c41b474394',
  sessionId: '4898b08b-57aa-43e6-972c-7255ed91ebcb',
};

test('email normalization and credential validation preserve password bytes', async () => {
  assert.equal(normalizeEmail('  Person@Example.COM  '), 'person@example.com');
  const good = plainToInstance(CredentialsDto, {
    email: 'person@example.com',
    password: ' abcdefgh ',
  });
  assert.deepEqual(await validate(good), []);
  assert.equal(good.password, ' abcdefgh ');
  for (const payload of [
    { email: 'bad', password: 'abcdefgh' },
    { email: `${'a'.repeat(250)}@x.com`, password: 'abcdefgh' },
    { email: 'a@b.com', password: 'short' },
    { email: 'a@b.com', password: 'x'.repeat(129) },
  ])
    assert.ok(
      (await validate(plainToInstance(CredentialsDto, payload))).length > 0,
    );
});

test('Argon2id hashes and verifies without accepting a different password', async () => {
  const hash = await hashPassword('a password with spaces ');
  assert.match(hash, /^\$argon2id\$v=19\$/);
  assert.equal(await verifyPassword(hash, 'a password with spaces '), true);
  assert.equal(await verifyPassword(hash, 'a password with spaces'), false);
});

test('access JWT requires 10-minute HS256 claims and rejects tampering, expiry, issuer, audience and none', () => {
  const service = new AccessTokenService(env);
  const token = service.issue(identity);
  const claims = jwt.decode(token);
  assert.equal(claims.exp - claims.iat, 600);
  assert.deepEqual(service.verify(token), identity);
  const key = Buffer.from(env.JWT_SIGNING_KEY_B64, 'base64');
  const sign = (payload, options = {}) =>
    jwt.sign(payload, key, {
      algorithm: 'HS256',
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      subject: identity.userId,
      ...options,
    });
  const invalid = [
    `${token.slice(0, -2)}xx`,
    sign({ sessionId: identity.sessionId }, { expiresIn: -1 }),
    sign(
      { sessionId: identity.sessionId },
      { expiresIn: 600, issuer: 'wrong' },
    ),
    sign(
      { sessionId: identity.sessionId },
      { expiresIn: 600, audience: 'wrong' },
    ),
    jwt.sign({ sessionId: identity.sessionId }, Buffer.alloc(32, 9), {
      algorithm: 'HS256',
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      subject: identity.userId,
      expiresIn: 600,
    }),
    jwt.sign({ sessionId: identity.sessionId }, '', {
      algorithm: 'none',
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      subject: identity.userId,
      expiresIn: 600,
    }),
    sign({ sessionId: 'not-a-uuid' }, { expiresIn: 600 }),
    'not-a-jwt',
  ];
  for (const candidate of invalid)
    assert.throws(() => service.verify(candidate), { status: 401 });
});

test('refresh tokens have 256-bit randomness and only keyed digests are stable', () => {
  const first = newRefreshToken();
  const second = newRefreshToken();
  assert.equal(Buffer.from(first, 'base64url').length, 32);
  assert.notEqual(first, second);
  const pepper = Buffer.from(env.REFRESH_PEPPER_B64, 'base64');
  assert.match(hashRefreshToken(first, pepper), /^[a-f0-9]{64}$/);
  assert.equal(
    hashRefreshToken(first, pepper),
    hashRefreshToken(first, pepper),
  );
  assert.notEqual(
    hashRefreshToken(first, pepper),
    hashRefreshToken(first, Buffer.alloc(32, 3)),
  );
});

test('production refresh cookie is secure, scoped, HttpOnly and cleared compatibly', async () => {
  const options = [];
  const response = {
    cookie: (name, _value, attributes) =>
      options.push({ action: 'set', name, attributes }),
    clearCookie: (name, attributes) =>
      options.push({ action: 'clear', name, attributes }),
  };
  const authService = {
    login: async () => ({
      refreshToken: 'opaque',
      accessToken: 'access',
      user: { id: 'safe' },
    }),
    logout: async () => {},
  };
  const controller = new AuthController(
    authService,
    { check: async () => {} },
    { ...env, AUTH_COOKIE_SECURE: true },
  );
  const result = await controller.login(
    { email: 'a@example.com', password: 'password' },
    { socket: { remoteAddress: '127.0.0.1' } },
    response,
  );
  assert.equal(result.refreshToken, undefined);
  assert.equal(options[0].name, 'ekms_refresh');
  assert.equal(options[0].attributes.secure, true);
  assert.equal(options[0].attributes.httpOnly, true);
  assert.equal(options[0].attributes.sameSite, 'lax');
  assert.equal(options[0].attributes.path, '/api/v1/auth');
  assert.equal(options[0].attributes.maxAge, 30 * 24 * 60 * 60 * 1000);
  await controller.logout({ headers: {}, cookies: {} }, response);
  assert.equal(options[1].action, 'clear');
  assert.equal(options[1].attributes.secure, true);
  assert.equal(options[1].attributes.path, options[0].attributes.path);
});

test('Origin guard rejects missing and malicious origins on mutations', () => {
  const guard = new OriginGuard(env);
  const context = (method, origin) => ({
    switchToHttp: () => ({
      getRequest: () => ({ method, headers: { origin } }),
    }),
  });
  assert.equal(
    guard.canActivate(context('POST', 'http://localhost:3000')),
    true,
  );
  assert.equal(guard.canActivate(context('GET', undefined)), true);
  for (const origin of [
    undefined,
    'https://evil.example',
    'http://localhost:3000.evil.example',
  ]) {
    assert.throws(() => guard.canActivate(context('POST', origin)), {
      status: 403,
    });
  }
});

test('rate limiting applies IP and account buckets, returns Retry-After and fails closed', async () => {
  const buckets = new Map();
  const redis = {
    consumeRateLimit: async (key) => {
      const count = (buckets.get(key) ?? 0) + 1;
      buckets.set(key, count);
      return { count, retryAfter: 60 };
    },
  };
  const service = new RateLimitService(redis, {
    ...env,
    AUTH_LOGIN_ACCOUNT_LIMIT: 1,
  });
  const request = {
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-forwarded-for': 'attacker-controlled' },
  };
  await service.check('login', request, 'a@example.com');
  await assert.rejects(() => service.check('login', request, 'a@example.com'), {
    status: 429,
    retryAfter: 60,
  });
  redis.consumeRateLimit = async () => {
    throw new Error('Redis unavailable');
  };
  await assert.rejects(() => service.check('refresh', request), {
    status: 503,
  });
});
