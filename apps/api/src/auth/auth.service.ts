import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { emailAlreadyRegistered, invalidCredentials, invalidRefresh, refreshReuseDetected, sessionNotFound } from './auth.errors';
import type { IssuedAuth, SafeUser } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

const dummyPasswordHash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';

type LockedRefreshSession = {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_id: string | null;
};

type RefreshOutcome =
  | { kind: 'success'; sessionId: string; refreshToken: string; user: SafeUser }
  | { kind: 'invalid' }
  | { kind: 'reuse' };

export function classifyRefreshSession(
  session: Pick<LockedRefreshSession, 'expires_at' | 'revoked_at' | 'replaced_by_id'>,
  now: Date,
): 'rotate' | 'invalid' | 'reuse' {
  if (session.revoked_at !== null || session.replaced_by_id !== null) return 'reuse';
  if (session.expires_at.getTime() <= now.getTime()) return 'invalid';
  return 'rotate';
}

const safeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  timezone: true,
} satisfies Prisma.UserSelect;

export function normalizeEmail(email: string): string {
  return email.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  async register(input: RegisterDto): Promise<IssuedAuth> {
    const normalizedEmail = normalizeEmail(input.email);
    const passwordHash = await bcrypt.hash(input.password, this.config.get('BCRYPT_COST', { infer: true }));
    const refreshToken = this.tokens.createRefreshToken();

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            email: normalizedEmail,
            normalizedEmail,
            passwordHash,
            displayName: input.displayName?.trim() || null,
          },
          select: safeUserSelect,
        });
        const session = await transaction.refreshSession.create({
          data: {
            userId: user.id,
            tokenHash: this.tokens.hashRefreshToken(refreshToken),
            familyId: randomUUID(),
            expiresAt: this.tokens.refreshExpiresAt(),
          },
          select: { id: true },
        });
        return { user, sessionId: session.id };
      });

      return {
        accessToken: await this.tokens.signAccessToken(created.user.id, created.sessionId),
        refreshToken,
        user: created.user,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = JSON.stringify(error.meta?.target ?? '');
        if (target.includes('email')) throw emailAlreadyRegistered();
      }
      throw error;
    }
  }

  async login(input: LoginDto): Promise<IssuedAuth> {
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail: normalizeEmail(input.email) },
      select: { ...safeUserSelect, passwordHash: true },
    });
    const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? dummyPasswordHash);
    if (user === null || !passwordMatches) throw invalidCredentials();

    const refreshToken = this.tokens.createRefreshToken();
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        familyId: randomUUID(),
        expiresAt: this.tokens.refreshExpiresAt(),
      },
      select: { id: true },
    });
    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
    };
    return {
      accessToken: await this.tokens.signAccessToken(user.id, session.id),
      refreshToken,
      user: safeUser,
    };
  }

  async refresh(refreshToken: string | undefined): Promise<IssuedAuth> {
    if (refreshToken === undefined || refreshToken.length === 0) throw invalidRefresh();
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);

    const outcome = await this.prisma.$transaction<RefreshOutcome>(async (transaction) => {
      const rows = await transaction.$queryRaw<LockedRefreshSession[]>`
        SELECT id, user_id, family_id, expires_at, revoked_at, replaced_by_id
        FROM refresh_sessions
        WHERE token_hash = ${tokenHash}
        FOR UPDATE
      `;
      const current = rows[0];
      if (current === undefined) return { kind: 'invalid' };
      const now = new Date();
      const classification = classifyRefreshSession(current, now);

      if (classification === 'reuse') {
        await transaction.refreshSession.updateMany({
          where: { familyId: current.family_id, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.securityEvent.create({
          data: {
            userId: current.user_id,
            refreshSessionId: current.id,
            type: 'REFRESH_TOKEN_REUSE_DETECTED',
            metadata: { detectedAt: now.toISOString() },
          },
        });
        return { kind: 'reuse' };
      }

      if (classification === 'invalid') {
        await transaction.refreshSession.update({ where: { id: current.id }, data: { revokedAt: now } });
        return { kind: 'invalid' };
      }

      const nextRefreshToken = this.tokens.createRefreshToken();
      const replacement = await transaction.refreshSession.create({
        data: {
          userId: current.user_id,
          tokenHash: this.tokens.hashRefreshToken(nextRefreshToken),
          familyId: current.family_id,
          expiresAt: this.tokens.refreshExpiresAt(now),
        },
        select: { id: true },
      });
      await transaction.refreshSession.update({
        where: { id: current.id },
        data: { revokedAt: now, replacedById: replacement.id },
      });
      const user = await transaction.user.findUniqueOrThrow({ where: { id: current.user_id }, select: safeUserSelect });
      return { kind: 'success', sessionId: replacement.id, refreshToken: nextRefreshToken, user };
    });

    if (outcome.kind === 'reuse') throw refreshReuseDetected();
    if (outcome.kind === 'invalid') throw invalidRefresh();
    return {
      accessToken: await this.tokens.signAccessToken(outcome.user.id, outcome.sessionId),
      refreshToken: outcome.refreshToken,
      user: outcome.user,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken === undefined || refreshToken.length === 0) return;
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.tokens.hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async listSessions(userId: string, currentSessionId: string): Promise<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>> {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true },
    });
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw sessionNotFound();
  }

  async getUser(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: safeUserSelect });
    if (user === null) throw new ConflictException({ code: 'AUTH_USER_MISSING', message: 'Authenticated user no longer exists.', details: [] });
    return user;
  }
}
