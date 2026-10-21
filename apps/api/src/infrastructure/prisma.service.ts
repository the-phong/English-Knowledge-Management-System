import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { ApiEnv } from '@ekms/config';
import { API_ENV } from '../tokens';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(API_ENV) env: ApiEnv) {
    super({ datasources: { db: { url: env.DATABASE_URL } } });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
