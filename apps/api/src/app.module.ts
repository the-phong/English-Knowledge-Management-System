import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuthModule } from './auth/auth.module';
import { HealthService } from './health/health.service';
import { HealthController } from './health/health.controller';
import { RequestIdMiddleware } from './http/request-id.middleware';
import { VocabularyModule } from './vocabulary/vocabulary.module';

@Module({
  imports: [InfrastructureModule, AuthModule, VocabularyModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
