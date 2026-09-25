import { BadRequestException, type INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import { ApiExceptionFilter } from './api-exception.filter';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

function validationDetails(errors: ValidationError[]): Array<{ field: string; code: string; message: string }> {
  return errors.flatMap((error) =>
    Object.entries(error.constraints ?? {}).map(([code, message]) => ({ field: error.property, code, message })),
  );
}

export function configureApiApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  if (config.get('APP_ENV', { infer: true }) !== 'production') {
    app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true });
  }
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: validationDetails(errors),
    }),
  }));
}
