import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ErrorFilter } from './http/error.filter';
import { ResponseInterceptor } from './http/response.interceptor';
import cookieParser from 'cookie-parser';
import type { ApiEnv } from '@ekms/config';
import { API_ENV } from './tokens';

export function configureApp(app: INestApplication): void {
  const env = app.get<ApiEnv>(API_ENV);
  app.use(cookieParser());
  app.enableCors({
    credentials: true,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, !origin || env.AUTH_ALLOWED_ORIGINS.includes(origin)),
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ErrorFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();
}
