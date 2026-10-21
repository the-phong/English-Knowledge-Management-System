import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnv } from '@ekms/config';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { API_ENV } from '../tokens';
import { ACCESS_TTL_SECONDS } from './auth-crypto';
import { AuthError } from './auth-error';

export interface AccessIdentity {
  userId: string;
  sessionId: string;
}

@Injectable()
export class AccessTokenService {
  private readonly signingKey: Buffer;

  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {
    this.signingKey = Buffer.from(env.JWT_SIGNING_KEY_B64, 'base64');
  }

  issue(identity: AccessIdentity): string {
    return jwt.sign({ sessionId: identity.sessionId }, this.signingKey, {
      algorithm: 'HS256',
      issuer: this.env.JWT_ISSUER,
      audience: this.env.JWT_AUDIENCE,
      subject: identity.userId,
      expiresIn: ACCESS_TTL_SECONDS,
    });
  }

  verify(token: string): AccessIdentity {
    try {
      const payload = jwt.verify(token, this.signingKey, {
        algorithms: ['HS256'],
        issuer: this.env.JWT_ISSUER,
        audience: this.env.JWT_AUDIENCE,
      }) as JwtPayload;
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sessionId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          payload.sub,
        ) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          payload.sessionId,
        ) ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' ||
        payload.exp - payload.iat !== ACCESS_TTL_SECONDS
      )
        throw new Error('Invalid claims');
      return { userId: payload.sub, sessionId: payload.sessionId };
    } catch {
      throw new AuthError('AUTH_REQUIRED', 'Authentication required', 401);
    }
  }
}
