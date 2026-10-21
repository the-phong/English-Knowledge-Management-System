import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import type { ApiEnv } from '@ekms/config';
import { PrismaService } from '../infrastructure/prisma.service';
import { API_ENV } from '../tokens';
import {
  AccessTokenService,
  type AccessIdentity,
} from './access-token.service';
import {
  hashPassword,
  hashRefreshToken,
  newRefreshToken,
  REFRESH_TTL_SECONDS,
  verifyPassword,
} from './auth-crypto';
import { AuthError } from './auth-error';
import { normalizeEmail } from './auth.dto';

type Tx = Prisma.TransactionClient;
type LockedSession = {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  consumed_at: Date | null;
  revoked_at: Date | null;
};

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.normalizedEmail,
    timezone: user.timezone,
    preferences: user.preferences,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AuthService {
  private readonly pepper: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokens: AccessTokenService,
    @Inject(API_ENV) env: ApiEnv,
  ) {
    this.pepper = Buffer.from(env.REFRESH_PEPPER_B64, 'base64');
  }

  private tokenHash(token: string): string {
    return hashRefreshToken(token, this.pepper);
  }

  private invalid(): never {
    throw new AuthError('AUTH_REQUIRED', 'Authentication required', 401);
  }

  private async lockUser(tx: Tx, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  }

  async register(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await hashPassword(password);
    try {
      const user = await this.prisma.user.create({
        data: { normalizedEmail, passwordHash },
      });
      return publicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AuthError(
          'AUTH_ACCOUNT_EXISTS',
          'Account already exists',
          409,
        );
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail: normalizeEmail(email) },
    });
    if (!user) {
      // Similar adaptive work for unknown accounts without a stored dummy credential.
      await hashPassword(password);
      return this.invalid();
    }
    if (!(await verifyPassword(user.passwordHash, password)))
      return this.invalid();
    const refreshToken = newRefreshToken();
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.tokenHash(refreshToken),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      },
    });
    return {
      accessToken: this.accessTokens.issue({
        userId: user.id,
        sessionId: session.id,
      }),
      refreshToken,
      user: publicUser(user),
    };
  }

  async authenticateAccess(token: string): Promise<AccessIdentity> {
    const identity = this.accessTokens.verify(token);
    const session = await this.prisma.refreshSession.findFirst({
      where: {
        id: identity.sessionId,
        userId: identity.userId,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) return this.invalid();
    return identity;
  }

  async refresh(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return this.invalid();
    const tokenHash = this.tokenHash(token);
    const replacement = newRefreshToken();
    const outcome = await this.prisma.$transaction(
      async (tx) => {
        const match = await tx.refreshSession.findUnique({
          where: { tokenHash },
          select: { userId: true },
        });
        if (!match) return { kind: 'invalid' as const };
        await this.lockUser(tx, match.userId);
        const rows = await tx.$queryRaw<LockedSession[]>`
        SELECT id, user_id, family_id, expires_at, consumed_at, revoked_at
        FROM refresh_sessions WHERE token_hash = ${tokenHash} FOR UPDATE
      `;
        const session = rows[0];
        if (!session) return { kind: 'invalid' as const };
        const now = new Date();
        if (session.consumed_at) {
          await tx.refreshSession.updateMany({
            where: {
              userId: session.user_id,
              familyId: session.family_id,
              revokedAt: null,
            },
            data: { revokedAt: now },
          });
          await tx.securityEvent.createMany({
            data: [
              {
                userId: session.user_id,
                familyId: session.family_id,
                sessionId: session.id,
                eventType: 'REFRESH_REUSE_DETECTED',
              },
              {
                userId: session.user_id,
                familyId: session.family_id,
                sessionId: session.id,
                eventType: 'SESSION_FAMILY_REVOKED',
              },
            ],
          });
          return { kind: 'reuse' as const };
        }
        if (session.revoked_at || session.expires_at <= now)
          return { kind: 'invalid' as const };
        const next = await tx.refreshSession.create({
          data: {
            userId: session.user_id,
            tokenHash: this.tokenHash(replacement),
            familyId: session.family_id,
            expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000),
          },
        });
        await tx.refreshSession.update({
          where: { id: session.id },
          data: { consumedAt: now, replacedById: next.id },
        });
        return {
          kind: 'ok' as const,
          userId: session.user_id,
          sessionId: next.id,
        };
      },
      { maxWait: 5000, timeout: 10000 },
    );
    if (outcome.kind === 'reuse') {
      throw new AuthError(
        'AUTH_REFRESH_REUSE_DETECTED',
        'Session revoked; sign in again',
        401,
      );
    }
    if (outcome.kind !== 'ok') return this.invalid();
    return {
      accessToken: this.accessTokens.issue({
        userId: outcome.userId,
        sessionId: outcome.sessionId,
      }),
      refreshToken: replacement,
    };
  }

  async me(identity: AccessIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { id: identity.userId },
    });
    if (!user) return this.invalid();
    return publicUser(user);
  }

  async sessions(identity: AccessIdentity) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: {
        userId: identity.userId,
        revokedAt: null,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true },
    });
    return sessions.map((session) => ({
      ...session,
      current: session.id === identity.sessionId,
    }));
  }

  async revokeSession(
    identity: AccessIdentity,
    sessionId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, identity.userId);
      const session = await tx.refreshSession.findFirst({
        where: { id: sessionId, userId: identity.userId },
      });
      if (!session)
        throw new AuthError('RESOURCE_NOT_FOUND', 'Resource not found', 404);
      await tx.refreshSession.updateMany({
        where: {
          userId: identity.userId,
          familyId: session.familyId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await tx.securityEvent.create({
        data: {
          userId: identity.userId,
          familyId: session.familyId,
          sessionId,
          eventType: 'SESSION_REVOKED',
        },
      });
    });
  }

  async logoutAll(identity: AccessIdentity): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, identity.userId);
      await tx.refreshSession.updateMany({
        where: { userId: identity.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.securityEvent.create({
        data: {
          userId: identity.userId,
          sessionId: identity.sessionId,
          eventType: 'ALL_SESSIONS_REVOKED',
        },
      });
    });
  }

  async logout(cookieToken?: string, accessToken?: string): Promise<void> {
    let sessionId: string | undefined;
    let userId: string | undefined;
    if (cookieToken && /^[A-Za-z0-9_-]{43}$/.test(cookieToken)) {
      const session = await this.prisma.refreshSession.findUnique({
        where: { tokenHash: this.tokenHash(cookieToken) },
        select: { id: true, userId: true },
      });
      sessionId = session?.id;
      userId = session?.userId;
    }
    if (!sessionId && accessToken) {
      try {
        const identity = this.accessTokens.verify(accessToken);
        sessionId = identity.sessionId;
        userId = identity.userId;
      } catch {
        /* Invalid access is ignored; the cookie may already be gone. */
      }
    }
    if (!sessionId || !userId) return;
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const session = await tx.refreshSession.findFirst({
        where: { id: sessionId, userId },
      });
      if (!session) return;
      await tx.refreshSession.updateMany({
        where: { userId, familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.securityEvent.create({
        data: {
          userId,
          familyId: session.familyId,
          sessionId,
          eventType: 'SESSION_REVOKED',
        },
      });
    });
  }
}
