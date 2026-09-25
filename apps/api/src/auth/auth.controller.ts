import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { Environment } from '../config/environment';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest, IssuedAuth } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OriginGuard } from './origin.guard';
import { TokenService } from './token.service';

const refreshCookieName = 'ekms_refresh';

export function refreshCookieOptions(appEnvironment: Environment['APP_ENV'], maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: appEnvironment === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge,
  };
}

function readCookie(request: Request, name: string): string | undefined {
  const part = request.headers.cookie?.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  if (part === undefined) return undefined;
  const value = part.slice(name.length + 1);
  try { return decodeURIComponent(value); } catch { return undefined; }
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  @Post('register')
  @UseGuards(OriginGuard)
  async register(@Body() input: RegisterDto, @Res({ passthrough: true }) response: Response): Promise<Omit<IssuedAuth, 'refreshToken'>> {
    return this.respondWithSession(await this.auth.register(input), response);
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(OriginGuard)
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response): Promise<Omit<IssuedAuth, 'refreshToken'>> {
    return this.respondWithSession(await this.auth.login(input), response);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(OriginGuard)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<Omit<IssuedAuth, 'refreshToken'>> {
    return this.respondWithSession(await this.auth.refresh(readCookie(request, refreshCookieName)), response);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(OriginGuard)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ success: true }> {
    await this.auth.logout(readCookie(request, refreshCookieName));
    this.clearRefreshCookie(response);
    return { success: true };
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(OriginGuard, AccessTokenGuard)
  async logoutAll(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<{ success: true }> {
    await this.auth.logoutAll(request.auth.userId);
    this.clearRefreshCookie(response);
    return { success: true };
  }

  @Get('sessions')
  @UseGuards(AccessTokenGuard)
  sessions(@Req() request: AuthenticatedRequest): Promise<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>> {
    return this.auth.listSessions(request.auth.userId, request.auth.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(200)
  @UseGuards(OriginGuard, AccessTokenGuard)
  async revokeSession(@Req() request: AuthenticatedRequest, @Param('id') sessionId: string): Promise<{ success: true }> {
    await this.auth.revokeSession(request.auth.userId, sessionId);
    return { success: true };
  }

  private respondWithSession(issued: IssuedAuth, response: Response): Omit<IssuedAuth, 'refreshToken'> {
    response.cookie(refreshCookieName, issued.refreshToken, this.cookieOptions());
    return { accessToken: issued.accessToken, user: issued.user };
  }

  private cookieOptions(): CookieOptions {
    return refreshCookieOptions(this.config.get('APP_ENV', { infer: true }), this.tokens.refreshMaxAge());
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(refreshCookieName, {
      httpOnly: true,
      secure: this.config.get('APP_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }
}
