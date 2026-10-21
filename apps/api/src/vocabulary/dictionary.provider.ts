import { z } from 'zod';
import type { DictionarySenseSuggestion } from '@ekms/contracts';
import { VocabularyError } from './vocabulary-error';

export type DictionaryRights = {
  displayAllowed: boolean;
  persistentStorageAllowed: boolean;
  cacheAllowed: boolean;
  aiProcessingAllowed: boolean;
  reuseInQuizAllowed: boolean;
  attributionRequired: boolean;
};

export interface DictionaryProvider {
  readonly id: string;
  readonly version: string;
  readonly rights: DictionaryRights;
  lookup(lemma: string): Promise<DictionarySenseSuggestion[]>;
}

export const denyAllDictionaryRights: DictionaryRights = {
  displayAllowed: false,
  persistentStorageAllowed: false,
  cacheAllowed: false,
  aiProcessingAllowed: false,
  reuseInQuizAllowed: false,
  attributionRequired: true,
};

const suggestionSchema = z.strictObject({
  sourceSenseId: z.string().min(1).max(128),
  lemma: z.string().min(1).max(100),
  partOfSpeech: z.enum([
    'NOUN',
    'VERB',
    'ADJECTIVE',
    'ADVERB',
    'PHRASE',
    'OTHER',
    'UNKNOWN',
  ]),
  definition: z.string().min(1).max(1000),
  attribution: z.string().min(1).max(255),
  provenance: z.literal('LOCAL_FIXTURE'),
  providerId: z.string().min(1).max(64),
  providerVersion: z.string().min(1).max(32),
});

export async function guardedLookup(
  provider: DictionaryProvider,
  lemma: string,
  timeoutMs = 1500,
): Promise<DictionarySenseSuggestion[]> {
  if (!provider.rights.displayAllowed)
    throw new VocabularyError(
      'DICTIONARY_RIGHTS_DENIED',
      'Dictionary unavailable',
      503,
    );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      provider.lookup(lemma),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('provider timeout')),
          timeoutMs,
        );
      }),
    ]);
    const parsed = z.array(suggestionSchema).max(20).safeParse(result);
    if (
      !parsed.success ||
      parsed.data.some(
        (sense) =>
          sense.lemma !== lemma ||
          sense.providerId !== provider.id ||
          sense.providerVersion !== provider.version,
      )
    )
      throw new Error('malformed provider response');
    return parsed.data;
  } catch {
    throw new VocabularyError(
      'DEPENDENCY_UNAVAILABLE',
      'Dictionary unavailable',
      503,
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// These short educational meanings were authored for EKMS development fixtures.
const fixtureSenses: DictionarySenseSuggestion[] = [
  {
    sourceSenseId: 'fixture-v1:issue-problem',
    lemma: 'issue',
    partOfSpeech: 'NOUN',
    definition: 'vấn đề hoặc chủ đề cần được xem xét',
    attribution: 'EKMS original development fixture',
    provenance: 'LOCAL_FIXTURE',
    providerId: 'ekms-original-fixture',
    providerVersion: '1',
  },
  {
    sourceSenseId: 'fixture-v1:issue-publish',
    lemma: 'issue',
    partOfSpeech: 'VERB',
    definition: 'phát hành hoặc đưa ra một tài liệu',
    attribution: 'EKMS original development fixture',
    provenance: 'LOCAL_FIXTURE',
    providerId: 'ekms-original-fixture',
    providerVersion: '1',
  },
  {
    sourceSenseId: 'fixture-v1:resilient',
    lemma: 'resilient',
    partOfSpeech: 'ADJECTIVE',
    definition: 'có khả năng phục hồi sau khó khăn',
    attribution: 'EKMS original development fixture',
    provenance: 'LOCAL_FIXTURE',
    providerId: 'ekms-original-fixture',
    providerVersion: '1',
  },
];

export class FixtureDictionaryProvider implements DictionaryProvider {
  readonly id = 'ekms-original-fixture';
  readonly version = '1';
  readonly rights: DictionaryRights = {
    displayAllowed: true,
    persistentStorageAllowed: true,
    cacheAllowed: true,
    aiProcessingAllowed: false,
    reuseInQuizAllowed: true,
    attributionRequired: true,
  };

  async lookup(lemma: string): Promise<DictionarySenseSuggestion[]> {
    return fixtureSenses.filter((sense) => sense.lemma === lemma);
  }

  findById(sourceSenseId: string): DictionarySenseSuggestion | undefined {
    return fixtureSenses.find((sense) => sense.sourceSenseId === sourceSenseId);
  }
}
