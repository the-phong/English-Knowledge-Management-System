import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ApiEnv } from '@ekms/config';
import Redis from 'ioredis';
import { API_ENV } from '../tokens';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private connecting?: Promise<void>;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.client.on('error', () => undefined);
  }

  async check(): Promise<void> {
    if (this.client.status !== 'ready') {
      this.connecting ??= this.client.connect().finally(() => {
        this.connecting = undefined;
      });
      await this.connecting;
    }
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
