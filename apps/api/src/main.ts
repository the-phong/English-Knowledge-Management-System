import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ConsoleLogger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { parseApiEnv } from '@ekms/config';

async function main(): Promise<void> {
  const env = parseApiEnv(process.env);
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  configureApp(app);
  await app.listen(env.API_PORT, '0.0.0.0');
}

void main().catch(() => {
  process.stderr.write(
    `${JSON.stringify({ level: 'error', event: 'api_startup_failed' })}\n`,
  );
  process.exitCode = 1;
});
