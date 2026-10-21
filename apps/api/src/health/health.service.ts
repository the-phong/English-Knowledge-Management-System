import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../infrastructure/database.service';
import { RedisService } from '../infrastructure/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async ready(): Promise<{ status: 'ready' }> {
    const results = await Promise.allSettled([
      this.database.check(),
      this.redis.check(),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      throw new ServiceUnavailableException('Required dependency unavailable');
    }
    return { status: 'ready' };
  }
}
