import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest, SafeUser } from './auth.types';

@Controller('me')
export class MeController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  me(@Req() request: AuthenticatedRequest): Promise<SafeUser> {
    return this.auth.getUser(request.auth.userId);
  }
}
