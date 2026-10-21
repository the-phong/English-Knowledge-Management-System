import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { parseApiEnv } from '@ekms/config';
import { API_ENV } from './tokens';
import { DatabaseService } from './infrastructure/database.service';
import { RedisService } from './infrastructure/redis.service';
import { HealthService } from './health/health.service';
import { HealthController } from './health/health.controller';
import { RequestIdMiddleware } from './http/request-id.middleware';

@Module({
  controllers: [HealthController],
  providers: [
    { provide: API_ENV, useFactory: () => parseApiEnv(process.env) },
    DatabaseService,
    RedisService,
    HealthService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
