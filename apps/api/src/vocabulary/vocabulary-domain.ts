import { createHash, createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { VocabularyError } from './vocabulary-error';

export function parseVocabularyInput<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new VocabularyError('VALIDATION_ERROR', 'Invalid request', 400);
  return parsed.data;
}

export function normalizeLemma(value: string): string {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  const canonical = normalized.toLowerCase();
  if (Array.from(canonical).length < 1 || Array.from(canonical).length > 100)
    throw new VocabularyError('VALIDATION_ERROR', 'Invalid lemma', 400);
  return canonical;
}

export function normalizeTag(value: string): {
  name: string;
  normalizedName: string;
} {
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  const normalizedName = name.toLowerCase();
  if (Array.from(name).length < 1 || Array.from(name).length > 50)
    throw new VocabularyError('VALIDATION_ERROR', 'Invalid tag name', 400);
  return { name, normalizedName };
}

export function validateDefinition(value: string): string {
  const definition = value.trim();
  if (!definition || Array.from(definition).length > 1000)
    throw new VocabularyError('VALIDATION_ERROR', 'Invalid definition', 400);
  return definition;
}

export function normalizeContext(
  value: string | null | undefined,
): string | null {
  const context = value?.trim() ?? '';
  if (Array.from(context).length > 3000)
    throw new VocabularyError(
      'VALIDATION_ERROR',
      'Invalid source context',
      400,
    );
  return context || null;
}

export function validateNote(value: string | undefined): string {
  const note = value ?? '';
  if (Array.from(note).length > 3000)
    throw new VocabularyError('VALIDATION_ERROR', 'Invalid note', 400);
  return note;
}

export function manualSenseKey(
  lemma: string,
  partOfSpeech: string,
  definition: string,
): string {
  // Exact canonical text only: this never claims semantic equivalence.
  const canonicalDefinition = definition
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase();
  const digest = createHash('sha256')
    .update(JSON.stringify([lemma, partOfSpeech, canonicalDefinition]))
    .digest('hex');
  return `manual:v1:${digest}`;
}

export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function requestHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function validateIdempotencyKey(value: string | undefined): string {
  if (!value || !z.uuid().safeParse(value).success)
    throw new VocabularyError(
      'VALIDATION_ERROR',
      'UUID Idempotency-Key required',
      400,
    );
  return value.toLowerCase();
}

export type CursorPayload = {
  userId: string;
  status: 'active' | 'archived' | 'all';
  search: string;
  tagId: string | null;
  createdAt: string;
  id: string;
  expiresAt: number;
};

export class CursorCodec {
  private readonly key: Buffer;

  constructor(signingKeyBase64: string) {
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        Buffer.from(signingKeyBase64, 'base64'),
        Buffer.from('ekms-vocabulary-cursor-salt'),
        Buffer.from('ekms-vocabulary-cursor-v1'),
        32,
      ),
    );
  }

  encode(payload: CursorPayload): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.key)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  decode(
    value: string,
    scope: Pick<CursorPayload, 'userId' | 'status' | 'search' | 'tagId'>,
  ): CursorPayload {
    if (value.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))
      throw new VocabularyError('INVALID_CURSOR', 'Invalid cursor', 400);
    const [data, received] = value.split('.') as [string, string];
    const expected = createHmac('sha256', this.key).update(data).digest();
    const actual = Buffer.from(received, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new VocabularyError('INVALID_CURSOR', 'Invalid cursor', 400);
    try {
      const payload = JSON.parse(
        Buffer.from(data, 'base64url').toString('utf8'),
      ) as CursorPayload;
      if (
        payload.userId !== scope.userId ||
        payload.status !== scope.status ||
        payload.search !== scope.search ||
        payload.tagId !== scope.tagId ||
        !z.uuid().safeParse(payload.id).success ||
        !Number.isFinite(Date.parse(payload.createdAt)) ||
        !Number.isInteger(payload.expiresAt) ||
        payload.expiresAt <= Date.now()
      )
        throw new Error('out of scope');
      return payload;
    } catch {
      throw new VocabularyError('INVALID_CURSOR', 'Invalid cursor', 400);
    }
  }
}
