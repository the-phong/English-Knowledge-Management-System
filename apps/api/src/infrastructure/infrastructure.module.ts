import { Global, Module } from '@nestjs/common';
import { parseApiEnv } from '@ekms/config';
import { API_ENV } from '../tokens';
import { DatabaseService } from './database.service';
import { RedisService } from './redis.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    { provide: API_ENV, useFactory: () => parseApiEnv(process.env) },
    DatabaseService,
    RedisService,
    PrismaService,
  ],
  exports: [API_ENV, DatabaseService, RedisService, PrismaService],
})
export class InfrastructureModule {}
