import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { id: string };

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    // Client-provided IDs are intentionally ignored until a trusted proxy allowlist exists.
    request.id = `req_${randomUUID()}`;
    response.setHeader('X-Request-Id', request.id);
    next();
  }
}
