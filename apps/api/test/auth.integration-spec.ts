import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApiApp } from '../src/common/http/configure-api-app';
import { PrismaService } from '../src/database/prisma.service';
import type { Environment } from '../src/config/environment';

const origin = 'http://localhost:3000';
const password = 'Phase1-Test-Password!';
jest.setTimeout(120_000);

type Registration = { accessToken: string; cookie: string; userId: string; email: string };

describe('Auth API (PostgreSQL integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService | undefined;
  let config: ConfigService<Environment, true>;
  const createdEmails: string[] = [];
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
    config = moduleRef.get(ConfigService);
  });

  afterAll(async () => {
    if (prisma !== undefined) await prisma.user.deleteMany({ where: { normalizedEmail: { in: createdEmails } } });
    if (app !== undefined) await app.close();
  });

  function email(label: string): string {
    const value = `${label}-${runId}@example.test`.toLowerCase();
    createdEmails.push(value);
    return value;
  }

  async function register(label: string): Promise<Registration> {
    const userEmail = email(label);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send({ email: `  ${userEmail.toUpperCase()}  `, password, displayName: label })
      .expect(201);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    return {
      accessToken: response.body.data.accessToken as string,
      cookie: cookies[0]!.split(';')[0]!,
      userId: response.body.data.user.id as string,
      email: userEmail,
    };
  }

  it('rejects a missing or invalid Origin on auth mutations', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: email('origin-missing'), password })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe('AUTH_ORIGIN_REJECTED'));

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://attacker.example')
      .send({ email: 'nobody@example.test', password })
      .expect(403);
  });

  it('registers normalized email, returns safe JWT claims and correct local cookie flags', async () => {
    const account = await register('register');
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: account.email, password })
      .expect(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain('refreshToken');
    expect(response.body.data.user.email).toBe(account.email);
    const cookie = String((response.headers['set-cookie'] as unknown as string[])[0]);
    expect(cookie).toContain('ekms_refresh=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).not.toContain('Secure');
    const rawRefreshToken = cookie.split(';')[0]!.split('=')[1]!;
    const storedSession = await prisma!.refreshSession.findFirstOrThrow({
      where: { userId: account.userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { tokenHash: true },
    });
    expect(storedSession.tokenHash).not.toBe(rawRefreshToken);
    expect(storedSession.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    const payloadPart = (response.body.data.accessToken as string).split('.')[1]!;
    const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as Record<string, unknown>;
    expect(Object.keys(claims).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sessionId', 'sub']);
    expect(claims.sub).toBe(account.userId);
    const me = await request(app.getHttpServer())
      .get('/api/v1/me').set('Authorization', `Bearer ${account.accessToken}`).expect(200);
    expect(me.body.data).toMatchObject({ id: account.userId, email: account.email });
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');

    config.set('APP_ENV', 'production');
    try {
      const productionLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login').set('Origin', origin)
        .send({ email: account.email, password }).expect(200);
      expect(String((productionLogin.headers['set-cookie'] as unknown as string[])[0])).toContain('Secure');
    } finally {
      config.set('APP_ENV', 'test');
    }
  });

  it('enforces unique normalized email and generic login errors', async () => {
    const account = await register('unique');
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send({ email: account.email.toUpperCase(), password })
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('EMAIL_ALREADY_REGISTERED'));

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login').set('Origin', origin)
      .send({ email: account.email, password: 'Wrong-Password-123!' }).expect(401);
    const missingUser = await request(app.getHttpServer())
      .post('/api/v1/auth/login').set('Origin', origin)
      .send({ email: 'missing-user@example.test', password: 'Wrong-Password-123!' }).expect(401);
    expect(wrongPassword.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(missingUser.body.error).toMatchObject({
      code: wrongPassword.body.error.code,
      message: wrongPassword.body.error.message,
    });
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const account = await register('rotation');
    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', account.cookie).expect(200);
    const nextCookie = String((rotated.headers['set-cookie'] as unknown as string[])[0]).split(';')[0]!;
    expect(nextCookie).not.toBe(account.cookie);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', account.cookie).expect(401)
      .expect(({ body }) => expect(body.error.code).toBe('AUTH_REFRESH_REUSE_DETECTED'));
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', nextCookie).expect(401);

    const events = await prisma!.securityEvent.count({ where: { userId: account.userId, type: 'REFRESH_TOKEN_REUSE_DETECTED' } });
    expect(events).toBeGreaterThanOrEqual(1);
  });

  it('supports logout, logout-all, session listing and cross-user isolation', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const bobSessions = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions').set('Authorization', `Bearer ${bob.accessToken}`).expect(200);
    const bobSessionId = bobSessions.body.data[0].id as string;
    const aliceSessions = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions').set('Authorization', `Bearer ${alice.accessToken}`).expect(200);
    expect((aliceSessions.body.data as Array<{ id: string }>).map((session) => session.id)).not.toContain(bobSessionId);

    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${bobSessionId}`)
      .set('Origin', origin).set('Authorization', `Bearer ${alice.accessToken}`).expect(404);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', alice.cookie).expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', alice.cookie).expect(401);

    const bobSecondLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login').set('Origin', origin).send({ email: bob.email, password }).expect(200);
    const secondAccess = bobSecondLogin.body.data.accessToken as string;
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout-all').set('Origin', origin)
      .set('Authorization', `Bearer ${secondAccess}`).expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/me').set('Authorization', `Bearer ${bob.accessToken}`).expect(401);
  });
});
