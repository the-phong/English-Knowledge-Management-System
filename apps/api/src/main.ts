import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApiApp } from './common/http/configure-api-app';
import { JsonLogger } from './common/logging/json.logger';
import type { Environment } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Environment, true>);
  app.useLogger(new JsonLogger([
    config.get('JWT_ACCESS_SECRET', { infer: true }),
    config.get('REFRESH_TOKEN_PEPPER', { infer: true }),
    config.get('OPENAI_API_KEY', { infer: true }),
  ]));
  app.flushLogs();
  configureApiApp(app);
  const swagger = new DocumentBuilder().setTitle('EKMS API').setVersion('1.0').build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  await app.listen(config.get('API_PORT', { infer: true }));
}

void bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify({
    level: 'fatal',
    message: 'API startup failed.',
    errorType: error instanceof Error ? error.name : 'UnknownError',
  }));
  process.exitCode = 1;
});
