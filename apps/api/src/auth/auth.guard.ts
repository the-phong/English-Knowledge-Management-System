import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthError } from './auth-error';
import type { AccessIdentity } from './access-token.service';

export interface AuthenticatedRequest extends Request {
  auth?: AccessIdentity;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header || !/^Bearer [A-Za-z0-9._-]+$/.test(header)) {
      throw new AuthError('AUTH_REQUIRED', 'Authentication required', 401);
    }
    request.auth = await this.auth.authenticateAccess(header.slice(7));
    return true;
  }
}
