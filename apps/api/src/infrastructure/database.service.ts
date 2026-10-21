import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ApiEnv } from '@ekms/config';
import { Pool } from 'pg';
import { API_ENV } from '../tokens';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 1500,
      idleTimeoutMillis: 10000,
    });
  }

  async check(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
