import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-id.middleware';
import { AuthError } from '../auth/auth-error';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const code =
      exception instanceof AuthError
        ? exception.code
        : status === 503
          ? 'DEPENDENCY_UNAVAILABLE'
          : status === 401
            ? 'AUTH_REQUIRED'
            : status === 403
              ? 'FORBIDDEN'
              : status === 404
                ? 'RESOURCE_NOT_FOUND'
                : status === 400
                  ? 'VALIDATION_ERROR'
                  : status === 409
                    ? 'CONFLICT'
                    : status === 429
                      ? 'RATE_LIMITED'
                      : status === 405
                        ? 'METHOD_NOT_ALLOWED'
                        : 'INTERNAL_ERROR';
    const message =
      exception instanceof AuthError
        ? exception.safeMessage
        : status === 503
          ? 'Required dependency unavailable'
          : status === 401
            ? 'Authentication required'
            : status === 403
              ? 'Forbidden'
              : status === 404
                ? 'Resource not found'
                : status === 400
                  ? 'Invalid request'
                  : status === 409
                    ? 'Conflict'
                    : status === 429
                      ? 'Too many requests'
                      : status === 405
                        ? 'Method not allowed'
                        : 'An unexpected error occurred';
    if (exception instanceof AuthError && exception.retryAfter) {
      response.setHeader('Retry-After', String(exception.retryAfter));
    }
    response
      .status(status)
      .json({ error: { code, message, requestId: request.requestId } });
  }
}
