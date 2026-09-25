import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Environment } from '../config/environment';

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<Environment, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.header('origin');
    const missingAllowed = this.config.get('ALLOW_MISSING_ORIGIN', { infer: true });
    if ((origin === undefined && missingAllowed) || origin === this.config.get('WEB_ORIGIN', { infer: true })) return true;
    throw new ForbiddenException({ code: 'AUTH_ORIGIN_REJECTED', message: 'Request origin is not allowed.', details: [] });
  }
}
