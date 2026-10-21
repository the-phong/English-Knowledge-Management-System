import 'reflect-metadata';
import 'dotenv/config';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  app.enableShutdownHooks();
  process.stdout.write(
    `${JSON.stringify({ level: 'info', event: 'worker_ready' })}\n`,
  );
}

void main().catch(() => {
  process.stderr.write(
    `${JSON.stringify({ level: 'error', event: 'worker_startup_failed' })}\n`,
  );
  process.exitCode = 1;
});
