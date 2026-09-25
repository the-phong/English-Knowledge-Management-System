import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomBytes } from 'node:crypto';
import type { Environment } from '../config/environment';
import type { AccessClaims } from './auth.types';

const durationUnits: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function durationToMilliseconds(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === undefined) throw new Error(`Invalid duration: ${value}`);
  return amount * durationUnits[unit]!;
}

@Injectable()
export class TokenService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHmac('sha256', this.config.get('REFRESH_TOKEN_PEPPER', { infer: true })).update(token).digest('hex');
  }

  refreshExpiresAt(now = new Date()): Date {
    return new Date(now.getTime() + durationToMilliseconds(this.config.get('REFRESH_TOKEN_TTL', { infer: true })));
  }

  refreshMaxAge(): number {
    return durationToMilliseconds(this.config.get('REFRESH_TOKEN_TTL', { infer: true }));
  }

  async signAccessToken(userId: string, sessionId: string): Promise<string> {
    const expiresIn = Math.floor(durationToMilliseconds(this.config.get('ACCESS_TOKEN_TTL', { infer: true })) / 1_000);
    return this.jwt.signAsync(
      { sub: userId, sessionId },
      {
        expiresIn,
        issuer: this.config.get('JWT_ISSUER', { infer: true }),
        audience: this.config.get('JWT_AUDIENCE', { infer: true }),
      },
    );
  }

  async verifyAccessToken(token: string): Promise<AccessClaims> {
    return this.jwt.verifyAsync<AccessClaims>(token, {
      issuer: this.config.get('JWT_ISSUER', { infer: true }),
      audience: this.config.get('JWT_AUDIENCE', { infer: true }),
    });
  }
}
