import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ApiEnv } from '@ekms/config';
import type { Request } from 'express';
import { API_ENV } from '../tokens';
import { AuthError } from './auth-error';

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === 'GET' || request.method === 'HEAD') return true;
    const origin = request.headers.origin;
    if (!origin || !this.env.AUTH_ALLOWED_ORIGINS.includes(origin)) {
      throw new AuthError('FORBIDDEN', 'Origin not allowed', 403);
    }
    return true;
  }
}
