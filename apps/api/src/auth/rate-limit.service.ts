import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnv } from '@ekms/config';
import type { Request } from 'express';
import { RedisService } from '../infrastructure/redis.service';
import { API_ENV } from '../tokens';
import { AuthError } from './auth-error';

@Injectable()
export class RateLimitService {
  private readonly key: Buffer;

  constructor(
    private readonly redis: RedisService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {
    this.key = Buffer.from(env.REFRESH_PEPPER_B64, 'base64');
  }

  private keyed(value: string): string {
    return createHmac('sha256', this.key).update(value).digest('hex');
  }

  private async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    let result: { count: number; retryAfter: number };
    try {
      result = await this.redis.consumeRateLimit(key, windowSeconds);
    } catch {
      throw new AuthError(
        'DEPENDENCY_UNAVAILABLE',
        'Authentication temporarily unavailable',
        503,
      );
    }
    if (result.count > limit) {
      throw new AuthError(
        'RATE_LIMITED',
        'Too many requests',
        429,
        result.retryAfter,
      );
    }
  }

  async check(
    kind: 'register' | 'login' | 'refresh',
    request: Request,
    email?: string,
  ): Promise<void> {
    // Do not trust X-Forwarded-For until a specific reverse proxy is configured and reviewed.
    const ip = request.socket.remoteAddress ?? 'unknown';
    const limit =
      kind === 'register'
        ? this.env.AUTH_REGISTER_IP_LIMIT
        : kind === 'login'
          ? this.env.AUTH_LOGIN_IP_LIMIT
          : this.env.AUTH_REFRESH_IP_LIMIT;
    const window = kind === 'register' ? 3600 : kind === 'login' ? 900 : 300;
    await this.consume(`auth:${kind}:ip:${this.keyed(ip)}`, limit, window);
    if (kind === 'login' && email) {
      await this.consume(
        `auth:login:account:${this.keyed(email)}`,
        this.env.AUTH_LOGIN_ACCOUNT_LIMIT,
        900,
      );
    }
  }
}
