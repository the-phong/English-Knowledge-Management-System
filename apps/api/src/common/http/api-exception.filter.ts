import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-id.middleware';

type ErrorPayload = { code?: string; message?: string | string[]; details?: unknown[] };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const payload: ErrorPayload = typeof raw === 'object' && raw !== null ? raw : {};
    const defaultMessage = status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error.' : 'Request failed.';
    const message = Array.isArray(payload.message) ? defaultMessage : (payload.message ?? defaultMessage);
    const code = payload.code ?? (status === HttpStatus.INTERNAL_SERVER_ERROR ? 'INTERNAL_ERROR' : `HTTP_${status}`);

    response.status(status).json({
      error: {
        code,
        message,
        details: payload.details ?? [],
        requestId: request.id,
      },
    });
  }
}
