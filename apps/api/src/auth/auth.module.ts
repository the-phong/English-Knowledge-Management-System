import { Module } from '@nestjs/common';
import { AuthController, MeController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenService } from './access-token.service';
import { AuthGuard } from './auth.guard';
import { OriginGuard } from './origin.guard';
import { RateLimitService } from './rate-limit.service';

@Module({
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    AccessTokenService,
    AuthGuard,
    OriginGuard,
    RateLimitService,
  ],
  exports: [AuthService, AuthGuard, OriginGuard],
})
export class AuthModule {}
