import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { WorkerEnv } from '@ekms/config';
import type { Worker } from 'bullmq';
import type Redis from 'ioredis';
import { createFoundationWorker, createWorkerConnection } from './queue';

export const WORKER_ENV = Symbol('WORKER_ENV');

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<unknown, void, string>;
  private connection?: Redis;

  constructor(@Inject(WORKER_ENV) private readonly env: WorkerEnv) {}

  async onModuleInit(): Promise<void> {
    const connection = createWorkerConnection(this.env.REDIS_URL);
    this.connection = connection;
    connection.on('error', () => {
      process.stderr.write(
        `${JSON.stringify({ level: 'error', event: 'worker_connection_error' })}\n`,
      );
    });
    try {
      await connection.connect();
      await connection.ping();
      const worker = createFoundationWorker(connection);
      this.worker = worker;
      worker.on('error', () => {
        process.stderr.write(
          `${JSON.stringify({ level: 'error', event: 'worker_connection_error' })}\n`,
        );
      });
      await worker.waitUntilReady();
      void worker.run().catch(() => {
        process.stderr.write(
          `${JSON.stringify({ level: 'error', event: 'worker_loop_failed' })}\n`,
        );
      });
    } catch {
      if (this.worker) await this.worker.close(true);
      connection.disconnect();
      throw new Error('Worker could not connect to Redis');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) await this.worker.close();
    this.connection?.disconnect();
  }
}
