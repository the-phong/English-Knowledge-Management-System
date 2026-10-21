import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-id.middleware';

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
      status === 503
        ? 'DEPENDENCY_UNAVAILABLE'
        : status === 404
          ? 'RESOURCE_NOT_FOUND'
          : status === 400
            ? 'VALIDATION_ERROR'
            : status === 405
              ? 'METHOD_NOT_ALLOWED'
              : 'INTERNAL_ERROR';
    const message =
      status === 503
        ? 'Required dependency unavailable'
        : status === 404
          ? 'Resource not found'
          : status === 400
            ? 'Invalid request'
            : status === 405
              ? 'Method not allowed'
              : 'An unexpected error occurred';
    response
      .status(status)
      .json({ error: { code, message, requestId: request.requestId } });
  }
}
