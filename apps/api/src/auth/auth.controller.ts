import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiEnv } from '@ekms/config';
import { API_ENV } from '../tokens';
import { AuthService } from './auth.service';
import { CredentialsDto, normalizeEmail } from './auth.dto';
import { OriginGuard } from './origin.guard';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard';
import { RateLimitService } from './rate-limit.service';
import { REFRESH_TTL_SECONDS } from './auth-crypto';
import { Inject } from '@nestjs/common';
import { AuthError } from './auth-error';

@Controller('auth')
@UseGuards(OriginGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly rateLimits: RateLimitService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie('ekms_refresh', token, {
      httpOnly: true,
      secure: this.env.AUTH_COOKIE_SECURE,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: REFRESH_TTL_SECONDS * 1000,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie('ekms_refresh', {
      httpOnly: true,
      secure: this.env.AUTH_COOKIE_SECURE,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }

  @Post('register')
  async register(@Body() dto: CredentialsDto, @Req() request: Request) {
    await this.rateLimits.check('register', request);
    return this.auth.register(dto.email, dto.password);
  }

  @Post('login')
  async login(
    @Body() dto: CredentialsDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.rateLimits.check('login', request, normalizeEmail(dto.email));
    const { refreshToken, ...result } = await this.auth.login(
      dto.email,
      dto.password,
    );
    this.setRefreshCookie(response, refreshToken);
    return result;
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.rateLimits.check('refresh', request);
    try {
      const { refreshToken, ...result } = await this.auth.refresh(
        request.cookies?.ekms_refresh as string | undefined,
      );
      this.setRefreshCookie(response, refreshToken);
      return result;
    } catch (error) {
      if (error instanceof AuthError && error.getStatus() === 401) {
        this.clearRefreshCookie(response);
      }
      throw error;
    }
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const header = request.headers.authorization;
    await this.auth.logout(
      request.cookies?.ekms_refresh as string | undefined,
      header?.startsWith('Bearer ') ? header.slice(7) : undefined,
    );
    this.clearRefreshCookie(response);
    return { loggedOut: true };
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logoutAll(request.auth!);
    this.clearRefreshCookie(response);
    return { loggedOut: true };
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  async sessions(@Req() request: AuthenticatedRequest) {
    return this.auth.sessions(request.auth!);
  }

  @Delete('sessions/:id')
  @UseGuards(AuthGuard)
  async revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.revokeSession(request.auth!, id);
    if (id === request.auth!.sessionId) this.clearRefreshCookie(response);
    return { revoked: true };
  }
}

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  async me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.auth!);
  }
}
