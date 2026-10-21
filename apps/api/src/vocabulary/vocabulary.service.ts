import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createVocabularySchema,
  expectedVersionSchema,
  patchVocabularySchema,
  type DictionaryLookupView,
  type VocabularyItemView,
  type VocabularyListView,
} from '@ekms/contracts';
import type { ApiEnv } from '@ekms/config';
import { PrismaService } from '../infrastructure/prisma.service';
import { API_ENV } from '../tokens';
import {
  FixtureDictionaryProvider,
  guardedLookup,
} from './dictionary.provider';
import { IdempotencyService, type MutationResult } from './idempotency.service';
import {
  CursorCodec,
  manualSenseKey,
  normalizeContext,
  normalizeLemma,
  parseVocabularyInput,
  validateDefinition,
  validateNote,
} from './vocabulary-domain';
import { VocabularyError } from './vocabulary-error';

const itemInclude = {
  lexeme: true,
  tags: { include: { tag: true } },
} as const;
type FullItem = Prisma.VocabularyItemGetPayload<{
  include: typeof itemInclude;
}>;

export function itemView(item: FullItem): VocabularyItemView {
  return {
    id: item.id,
    lemma: item.lexeme.normalizedLemma,
    partOfSpeech: item.partOfSpeech as VocabularyItemView['partOfSpeech'],
    definition: item.definition,
    definitionProvenance:
      item.definitionProvenance as VocabularyItemView['definitionProvenance'],
    attribution: item.attribution,
    sourceContext: item.sourceContext,
    note: item.note,
    importance: item.importance,
    archivedAt: item.archivedAt?.toISOString() ?? null,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    tags: item.tags
      .map(({ tag }) => ({ id: tag.id, name: tag.name, version: tag.version }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

@Injectable()
export class VocabularyService {
  private readonly fixture = new FixtureDictionaryProvider();
  private readonly cursor: CursorCodec;

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {
    this.cursor = new CursorCodec(env.JWT_SIGNING_KEY_B64);
  }

  async lookup(
    q: string | undefined,
    provider: string | undefined,
  ): Promise<DictionaryLookupView> {
    if (typeof q !== 'string')
      throw new VocabularyError('VALIDATION_ERROR', 'Query required', 400);
    const lemma = normalizeLemma(q);
    if (provider !== 'fixture' || this.env.NODE_ENV === 'production')
      return { status: 'unavailable', provider: null, senses: [] };
    const senses = await guardedLookup(this.fixture, lemma);
    return { status: 'available', provider: this.fixture.id, senses };
  }

  private async assertTags(
    tx: Prisma.TransactionClient,
    userId: string,
    tagIds: string[],
  ) {
    const unique = [...new Set(tagIds)];
    if (!unique.length) return unique;
    const owned = await tx.contextTag.count({
      where: { userId, id: { in: unique } },
    });
    if (owned !== unique.length)
      throw new VocabularyError(
        'RESOURCE_NOT_FOUND',
        'Resource not found',
        404,
      );
    return unique;
  }

  async create(
    userId: string,
    key: string | undefined,
    body: unknown,
  ): Promise<MutationResult<{ item: VocabularyItemView; created: boolean }>> {
    const input = parseVocabularyInput(createVocabularySchema, body);
    const lemma = normalizeLemma(input.lemma);
    const sourceContext = normalizeContext(input.sourceContext);
    const note = validateNote(input.note);
    let definition: string;
    let partOfSpeech = input.partOfSpeech ?? 'UNKNOWN';
    let senseKey: string;
    let source: ReturnType<FixtureDictionaryProvider['findById']>;
    if (input.sourceSenseId) {
      if (
        this.env.NODE_ENV === 'production' ||
        !this.fixture.rights.persistentStorageAllowed
      )
        throw new VocabularyError(
          'DICTIONARY_RIGHTS_DENIED',
          'Dictionary source cannot be saved',
          409,
        );
      source = this.fixture.findById(input.sourceSenseId);
      if (
        !source ||
        source.lemma !== lemma ||
        (input.partOfSpeech && input.partOfSpeech !== source.partOfSpeech)
      )
        throw new VocabularyError(
          'SENSE_MAPPING_REQUIRED',
          'Choose a recognized sense',
          409,
        );
      partOfSpeech = source.partOfSpeech;
      definition = source.definition;
      senseKey = `provider:${source.providerId}:${source.sourceSenseId}`;
    } else {
      definition = validateDefinition(input.definition ?? '');
      senseKey = manualSenseKey(lemma, partOfSpeech, definition);
    }
    return this.idempotency.execute<{
      item: VocabularyItemView;
      created: boolean;
    }>(userId, 'vocabulary.create', key, input, async (tx) => {
      const existing = await tx.vocabularyItem.findUnique({
        where: { userId_senseKey: { userId, senseKey } },
        include: itemInclude,
      });
      if (existing)
        return {
          status: 200,
          body: { item: itemView(existing), created: false },
        };
      const ownedTags = await this.assertTags(tx, userId, input.tagIds);
      const lexeme = await tx.lexeme.upsert({
        where: { normalizedLemma: lemma },
        create: { normalizedLemma: lemma },
        update: {},
      });
      let dictionarySenseId: string | undefined;
      if (source) {
        const sense = await tx.dictionarySense.upsert({
          where: {
            providerId_sourceSenseId: {
              providerId: source.providerId,
              sourceSenseId: source.sourceSenseId,
            },
          },
          create: {
            lexemeId: lexeme.id,
            providerId: source.providerId,
            sourceSenseId: source.sourceSenseId,
            partOfSpeech: source.partOfSpeech,
            definition: source.definition,
            attribution: source.attribution,
            provenance: source.provenance,
            providerVersion: source.providerVersion,
          },
          update: {},
        });
        if (sense.lexemeId !== lexeme.id)
          throw new VocabularyError(
            'SENSE_MAPPING_REQUIRED',
            'Sense mapping conflict',
            409,
          );
        dictionarySenseId = sense.id;
      }
      const created = await tx.vocabularyItem.create({
        data: {
          userId,
          lexemeId: lexeme.id,
          dictionarySenseId,
          senseKey,
          partOfSpeech,
          definition,
          definitionProvenance: source ? 'LOCAL_FIXTURE' : 'USER_AUTHORED',
          attribution: source?.attribution,
          sourceContext,
          note,
          importance: input.importance ?? 1,
        },
      });
      if (ownedTags.length) {
        await tx.vocabularyTag.createMany({
          data: ownedTags.map((contextTagId) => ({
            userId,
            vocabularyItemId: created.id,
            contextTagId,
          })),
        });
      }
      const item = await tx.vocabularyItem.findUniqueOrThrow({
        where: { id: created.id },
        include: itemInclude,
      });
      return { status: 201, body: { item: itemView(item), created: true } };
    });
  }

  async get(userId: string, id: string): Promise<VocabularyItemView> {
    const item = await this.prisma.vocabularyItem.findFirst({
      where: { id, userId },
      include: itemInclude,
    });
    if (!item)
      throw new VocabularyError(
        'RESOURCE_NOT_FOUND',
        'Resource not found',
        404,
      );
    return itemView(item);
  }

  async list(
    userId: string,
    query: Record<string, unknown>,
  ): Promise<VocabularyListView> {
    const rawLimit = query.limit ?? '20';
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new VocabularyError('VALIDATION_ERROR', 'Invalid limit', 400);
    const rawStatus = query.status ?? 'active';
    if (
      rawStatus !== 'active' &&
      rawStatus !== 'archived' &&
      rawStatus !== 'all'
    )
      throw new VocabularyError('VALIDATION_ERROR', 'Invalid status', 400);
    const status = rawStatus as 'active' | 'archived' | 'all';
    const search = query.q === undefined ? '' : normalizeLemma(String(query.q));
    const tagId = query.tag === undefined ? null : String(query.tag);
    if (tagId && !/^[0-9a-f-]{36}$/i.test(tagId))
      throw new VocabularyError('VALIDATION_ERROR', 'Invalid tag', 400);
    if (
      tagId &&
      !(await this.prisma.contextTag.findFirst({
        where: { id: tagId, userId },
        select: { id: true },
      }))
    )
      throw new VocabularyError(
        'RESOURCE_NOT_FOUND',
        'Resource not found',
        404,
      );
    const scope = { userId, status, search, tagId };
    const cursor =
      query.cursor === undefined
        ? null
        : this.cursor.decode(String(query.cursor), scope);
    const where: Prisma.VocabularyItemWhereInput = {
      userId,
      ...(status === 'active'
        ? { archivedAt: null }
        : status === 'archived'
          ? { archivedAt: { not: null } }
          : {}),
      ...(tagId ? { tags: { some: { contextTagId: tagId } } } : {}),
      ...(search
        ? {
            OR: [
              { lexeme: { normalizedLemma: { contains: search } } },
              { definition: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(cursor
        ? {
            AND: [
              {
                OR: [
                  { createdAt: { lt: new Date(cursor.createdAt) } },
                  {
                    createdAt: new Date(cursor.createdAt),
                    id: { lt: cursor.id },
                  },
                ],
              },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.vocabularyItem.findMany({
      where,
      include: itemInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items: items.map(itemView),
      nextCursor:
        hasMore && last
          ? this.cursor.encode({
              ...scope,
              createdAt: last.createdAt.toISOString(),
              id: last.id,
              expiresAt: Date.now() + 60 * 60 * 1000,
            })
          : null,
    };
  }

  async patch(
    userId: string,
    id: string,
    body: unknown,
  ): Promise<VocabularyItemView> {
    const input = parseVocabularyInput(patchVocabularySchema, body);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const item = await tx.vocabularyItem.findFirst({
            where: { id, userId },
            include: { lexeme: true },
          });
          if (!item)
            throw new VocabularyError(
              'RESOURCE_NOT_FOUND',
              'Resource not found',
              404,
            );
          if (item.version !== input.expectedVersion)
            throw new VocabularyError(
              'CONCURRENT_MODIFICATION',
              'Item changed; reload before editing',
              409,
            );
          if (input.definition !== undefined && item.dictionarySenseId)
            throw new VocabularyError(
              'SENSE_MAPPING_REQUIRED',
              'Provider meaning cannot be edited',
              409,
            );
          const tags =
            input.tagIds === undefined
              ? undefined
              : await this.assertTags(tx, userId, input.tagIds);
          const definition =
            input.definition === undefined
              ? undefined
              : validateDefinition(input.definition);
          const result = await tx.vocabularyItem.updateMany({
            where: { id, userId, version: input.expectedVersion },
            data: {
              ...(definition !== undefined
                ? {
                    definition,
                    senseKey: manualSenseKey(
                      item.lexeme.normalizedLemma,
                      item.partOfSpeech,
                      definition,
                    ),
                  }
                : {}),
              ...(input.sourceContext !== undefined
                ? { sourceContext: normalizeContext(input.sourceContext) }
                : {}),
              ...(input.note !== undefined
                ? { note: validateNote(input.note) }
                : {}),
              ...(input.importance !== undefined
                ? { importance: input.importance }
                : {}),
              version: { increment: 1 },
            },
          });
          if (result.count !== 1)
            throw new VocabularyError(
              'CONCURRENT_MODIFICATION',
              'Item changed; reload before editing',
              409,
            );
          if (tags) {
            await tx.vocabularyTag.deleteMany({
              where: { vocabularyItemId: id, userId },
            });
            if (tags.length)
              await tx.vocabularyTag.createMany({
                data: tags.map((contextTagId) => ({
                  userId,
                  vocabularyItemId: id,
                  contextTagId,
                })),
              });
          }
          const updated = await tx.vocabularyItem.findFirstOrThrow({
            where: { id, userId },
            include: itemInclude,
          });
          return itemView(updated);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      )
        throw new VocabularyError(
          'CONCURRENT_MODIFICATION',
          'Item changed or duplicate sense exists',
          409,
        );
      throw error;
    }
  }

  async setArchived(
    userId: string,
    id: string,
    archive: boolean,
    key: string | undefined,
    body: unknown,
  ): Promise<MutationResult<VocabularyItemView>> {
    const input = parseVocabularyInput(expectedVersionSchema, body);
    return this.idempotency.execute(
      userId,
      archive ? 'vocabulary.archive' : 'vocabulary.restore',
      key,
      { id, ...input },
      async (tx) => {
        const item = await tx.vocabularyItem.findFirst({
          where: { id, userId },
          include: itemInclude,
        });
        if (!item)
          throw new VocabularyError(
            'RESOURCE_NOT_FOUND',
            'Resource not found',
            404,
          );
        if (item.version !== input.expectedVersion)
          throw new VocabularyError(
            'CONCURRENT_MODIFICATION',
            'Item changed; reload before editing',
            409,
          );
        if (Boolean(item.archivedAt) === archive)
          return { status: 200, body: itemView(item) };
        const changed = await tx.vocabularyItem.updateMany({
          where: { id, userId, version: input.expectedVersion },
          data: {
            archivedAt: archive ? new Date() : null,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1)
          throw new VocabularyError(
            'CONCURRENT_MODIFICATION',
            'Item changed; reload before editing',
            409,
          );
        const updated = await tx.vocabularyItem.findFirstOrThrow({
          where: { id, userId },
          include: itemInclude,
        });
        return { status: 200, body: itemView(updated) };
      },
    );
  }
}
