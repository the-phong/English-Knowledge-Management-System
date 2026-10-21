import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createTagSchema,
  patchTagSchema,
  type VocabularyTagView,
} from '@ekms/contracts';
import { PrismaService } from '../infrastructure/prisma.service';
import { IdempotencyService, type MutationResult } from './idempotency.service';
import { normalizeTag, parseVocabularyInput } from './vocabulary-domain';
import { VocabularyError } from './vocabulary-error';

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async list(userId: string): Promise<VocabularyTagView[]> {
    const tags = await this.prisma.contextTag.findMany({
      where: { userId },
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
    });
    return tags.map(({ id, name, version }) => ({ id, name, version }));
  }

  async create(
    userId: string,
    key: string | undefined,
    body: unknown,
  ): Promise<MutationResult<{ tag: VocabularyTagView; created: boolean }>> {
    const input = parseVocabularyInput(createTagSchema, body);
    const { name, normalizedName } = normalizeTag(input.name);
    return this.idempotency.execute<{
      tag: VocabularyTagView;
      created: boolean;
    }>(userId, 'tags.create', key, input, async (tx) => {
      const existing = await tx.contextTag.findUnique({
        where: { userId_normalizedName: { userId, normalizedName } },
      });
      if (existing)
        return {
          status: 200,
          body: {
            tag: {
              id: existing.id,
              name: existing.name,
              version: existing.version,
            },
            created: false,
          },
        };
      const tag = await tx.contextTag.create({
        data: { userId, name, normalizedName },
      });
      return {
        status: 201,
        body: {
          tag: { id: tag.id, name: tag.name, version: tag.version },
          created: true,
        },
      };
    });
  }

  async patch(
    userId: string,
    id: string,
    body: unknown,
  ): Promise<VocabularyTagView> {
    const input = parseVocabularyInput(patchTagSchema, body);
    const { name, normalizedName } = normalizeTag(input.name);
    try {
      const tag = await this.prisma.contextTag.findFirst({
        where: { id, userId },
      });
      if (!tag)
        throw new VocabularyError(
          'RESOURCE_NOT_FOUND',
          'Resource not found',
          404,
        );
      const changed = await this.prisma.contextTag.updateMany({
        where: { id, userId, version: input.expectedVersion },
        data: { name, normalizedName, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new VocabularyError(
          'CONCURRENT_MODIFICATION',
          'Tag changed; reload before editing',
          409,
        );
      const updated = await this.prisma.contextTag.findFirstOrThrow({
        where: { id, userId },
      });
      return { id: updated.id, name: updated.name, version: updated.version };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new VocabularyError(
          'CONCURRENT_MODIFICATION',
          'A tag with that name already exists',
          409,
        );
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<{ deleted: true }> {
    const result = await this.prisma.contextTag.deleteMany({
      where: { id, userId },
    });
    if (result.count !== 1)
      throw new VocabularyError(
        'RESOURCE_NOT_FOUND',
        'Resource not found',
        404,
      );
    // Database cascades only join rows; the VocabularyItem remains.
    return { deleted: true };
  }
}
