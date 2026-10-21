import { z } from 'zod';

export const partOfSpeechSchema = z.enum([
  'NOUN',
  'VERB',
  'ADJECTIVE',
  'ADVERB',
  'PHRASE',
  'OTHER',
  'UNKNOWN',
]);

const optionalContext = z.string().max(3000).nullable().optional();
const tagIds = z.array(z.uuid()).max(20).default([]);

export const createVocabularySchema = z
  .strictObject({
    lemma: z.string().min(1).max(400),
    partOfSpeech: partOfSpeechSchema.optional(),
    definition: z.string().max(1000).optional(),
    sourceSenseId: z.string().min(1).max(128).optional(),
    sourceContext: optionalContext,
    note: z.string().max(3000).optional(),
    importance: z.number().int().min(1).max(3).optional(),
    tagIds,
  })
  .superRefine((value, context) => {
    if (Boolean(value.definition) === Boolean(value.sourceSenseId))
      context.addIssue({
        code: 'custom',
        message: 'Provide exactly one manual definition or source sense',
        path: ['definition'],
      });
  });

export const patchVocabularySchema = z
  .strictObject({
    expectedVersion: z.number().int().positive(),
    definition: z.string().max(1000).optional(),
    sourceContext: optionalContext,
    note: z.string().max(3000).optional(),
    importance: z.number().int().min(1).max(3).optional(),
    tagIds: z.array(z.uuid()).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: 'At least one change is required',
  });

export const expectedVersionSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
});

export const createTagSchema = z.strictObject({
  name: z.string().min(1).max(50),
});
export const patchTagSchema = z.strictObject({
  name: z.string().min(1).max(50),
  expectedVersion: z.number().int().positive(),
});

export type CreateVocabularyInput = z.infer<typeof createVocabularySchema>;
export type PatchVocabularyInput = z.infer<typeof patchVocabularySchema>;
export type PartOfSpeech = z.infer<typeof partOfSpeechSchema>;

export type VocabularyTagView = {
  id: string;
  name: string;
  version: number;
};

export type VocabularyItemView = {
  id: string;
  lemma: string;
  partOfSpeech: PartOfSpeech;
  definition: string;
  definitionProvenance: 'USER_AUTHORED' | 'LOCAL_FIXTURE';
  attribution: string | null;
  sourceContext: string | null;
  note: string;
  importance: number;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  tags: VocabularyTagView[];
};

export type VocabularyListView = {
  items: VocabularyItemView[];
  nextCursor: string | null;
};

export type DictionarySenseSuggestion = {
  sourceSenseId: string;
  lemma: string;
  partOfSpeech: PartOfSpeech;
  definition: string;
  attribution: string;
  provenance: 'LOCAL_FIXTURE';
  providerId: string;
  providerVersion: string;
};

export type DictionaryLookupView = {
  status: 'available' | 'unavailable';
  provider: string | null;
  senses: DictionarySenseSuggestion[];
};
