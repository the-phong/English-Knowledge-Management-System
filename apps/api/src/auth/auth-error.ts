import { HttpException } from '@nestjs/common';

export class AuthError extends HttpException {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
    status: number,
    readonly retryAfter?: number,
  ) {
    super(safeMessage, status);
  }
}
