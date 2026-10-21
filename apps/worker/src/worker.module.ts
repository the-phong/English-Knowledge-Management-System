import { Module } from '@nestjs/common';
import { parseWorkerEnv } from '@ekms/config';
import { WORKER_ENV, WorkerService } from './worker.service';

@Module({
  providers: [
    { provide: WORKER_ENV, useFactory: () => parseWorkerEnv(process.env) },
    WorkerService,
  ],
})
export class WorkerModule {}
