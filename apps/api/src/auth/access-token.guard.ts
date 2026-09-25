import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { TokenService } from './token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { auth?: { userId: string; sessionId: string } }>();
    const authorization = request.header('authorization');
    const [scheme, token, extra] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || token === undefined || extra !== undefined) throw this.unauthorized();

    try {
      const claims = await this.tokens.verifyAccessToken(token);
      const session = await this.prisma.refreshSession.findFirst({
        where: { id: claims.sessionId, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      if (session === null) throw this.unauthorized();
      request.auth = { userId: claims.sub, sessionId: claims.sessionId };
      return true;
    } catch {
      throw this.unauthorized();
    }
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({ code: 'AUTH_UNAUTHORIZED', message: 'Authentication is required.', details: [] });
  }
}
