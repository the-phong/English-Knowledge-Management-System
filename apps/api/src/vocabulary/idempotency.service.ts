import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma.service';
import { requestHash, validateIdempotencyKey } from './vocabulary-domain';
import { VocabularyError } from './vocabulary-error';

export type MutationResult<T> = { status: number; body: T };

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    userId: string,
    operation: string,
    keyHeader: string | undefined,
    input: unknown,
    action: (tx: Prisma.TransactionClient) => Promise<MutationResult<T>>,
  ): Promise<MutationResult<T>> {
    const key = validateIdempotencyKey(keyHeader);
    const fingerprint = requestHash(input);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.idempotencyRecord.findUnique({
              where: { userId_operation_key: { userId, operation, key } },
            });
            if (existing) {
              if (existing.requestHash !== fingerprint)
                throw new VocabularyError(
                  'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
                  'Idempotency key belongs to another request',
                  409,
                );
              return existing.responseBody as MutationResult<T>;
            }
            const result = await action(tx);
            await tx.idempotencyRecord.create({
              data: {
                userId,
                operation,
                key,
                requestHash: fingerprint,
                responseBody: JSON.parse(
                  JSON.stringify(result),
                ) as Prisma.InputJsonValue,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            });
            return result;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000,
          },
        );
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034');
        if (!retryable || attempt === 4) {
          if (retryable)
            throw new VocabularyError(
              'CONCURRENT_MODIFICATION',
              'Concurrent request conflict',
              409,
            );
          throw error;
        }
      }
    }
    throw new VocabularyError(
      'CONCURRENT_MODIFICATION',
      'Concurrent request conflict',
      409,
    );
  }
}
