import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}
  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: string; checks: Record<string, string> }> {
    const checks: Record<string, string> = { database: 'ok', redis: 'ok' };
    try { await this.prisma.$queryRaw`SELECT 1`; } catch { checks.database = 'error'; }
    try { await this.redis.ping(); } catch { checks.redis = 'error'; }
    if (Object.values(checks).some((value) => value !== 'ok')) throw new ServiceUnavailableException({ status: 'not_ready', checks });
    return { status: 'ok', checks };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
