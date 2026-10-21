import { Worker } from 'bullmq';
import Redis, { type RedisOptions } from 'ioredis';

export const FOUNDATION_QUEUE = 'ekms-foundation';

export function workerRedisOptions(): RedisOptions {
  return {
    lazyConnect: true,
    connectTimeout: 1500,
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 3000),
  };
}

export function createWorkerConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, workerRedisOptions());
}

export function createFoundationWorker(
  connection: Redis,
): Worker<unknown, void, string> {
  return new Worker<unknown, void, string>(
    FOUNDATION_QUEUE,
    async () => {
      throw new Error('No foundation jobs are supported');
    },
    { connection, autorun: false },
  );
}
