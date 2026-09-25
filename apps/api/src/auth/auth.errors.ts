import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';

export function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.', details: [] });
}

export function invalidRefresh(): UnauthorizedException {
  return new UnauthorizedException({ code: 'AUTH_INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired.', details: [] });
}

export function refreshReuseDetected(): UnauthorizedException {
  return new UnauthorizedException({ code: 'AUTH_REFRESH_REUSE_DETECTED', message: 'Refresh token reuse was detected.', details: [] });
}

export function emailAlreadyRegistered(): ConflictException {
  return new ConflictException({ code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists.', details: [] });
}

export function sessionNotFound(): NotFoundException {
  return new NotFoundException({ code: 'AUTH_SESSION_NOT_FOUND', message: 'Session not found.', details: [] });
}
