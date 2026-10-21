import type {
  CreateVocabularyInput,
  DictionaryLookupView,
  VocabularyItemView,
  VocabularyListView,
  VocabularyTagView,
} from '@ekms/contracts';

export type AuthorizedRequest = <T>(
  path: string,
  options?: RequestInit,
) => Promise<T>;

const json = (value: unknown) => JSON.stringify(value);
const mutationHeaders = (key: string): HeadersInit => ({
  'Idempotency-Key': key,
  'Content-Type': 'application/json',
});

export function vocabularyClient(request: AuthorizedRequest) {
  return {
    list(params: {
      q?: string;
      status?: string;
      tag?: string;
      cursor?: string;
      limit?: number;
    }) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') query.set(key, String(value));
      }
      return request<VocabularyListView>(`/vocabulary?${query}`);
    },
    get(id: string) {
      return request<VocabularyItemView>(
        `/vocabulary/${encodeURIComponent(id)}`,
      );
    },
    create(input: CreateVocabularyInput, key: string) {
      return request<{ item: VocabularyItemView; created: boolean }>(
        '/vocabulary',
        {
          method: 'POST',
          headers: mutationHeaders(key),
          body: json(input),
        },
      );
    },
    patch(id: string, input: Record<string, unknown>) {
      return request<VocabularyItemView>(
        `/vocabulary/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: json(input),
        },
      );
    },
    setArchived(
      id: string,
      archive: boolean,
      expectedVersion: number,
      key: string,
    ) {
      return request<VocabularyItemView>(
        `/vocabulary/${encodeURIComponent(id)}/${archive ? 'archive' : 'restore'}`,
        {
          method: 'POST',
          headers: mutationHeaders(key),
          body: json({ expectedVersion }),
        },
      );
    },
    lookup(q: string, fixture = false) {
      const query = new URLSearchParams({ q });
      if (fixture) query.set('provider', 'fixture');
      return request<DictionaryLookupView>(`/dictionary/lookup?${query}`);
    },
    tags() {
      return request<VocabularyTagView[]>('/tags');
    },
    createTag(name: string, key: string) {
      return request<{ tag: VocabularyTagView; created: boolean }>('/tags', {
        method: 'POST',
        headers: mutationHeaders(key),
        body: json({ name }),
      });
    },
    renameTag(id: string, name: string, expectedVersion: number) {
      return request<VocabularyTagView>(`/tags/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: json({ name, expectedVersion }),
      });
    },
    deleteTag(id: string) {
      return request<{ deleted: true }>(`/tags/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  };
}
