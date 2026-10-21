'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type {
  DictionarySenseSuggestion,
  PartOfSpeech,
  VocabularyItemView,
  VocabularyTagView,
} from '@ekms/contracts';
import { useAuth } from '../../auth/auth-context';
import { ProtectedShell } from '../../auth/protected-shell';
import { AppShell } from '../../components/app-shell';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/layout';
import {
  Alert,
  Card,
  EmptyState,
  LoadingState,
} from '../../components/ui/surfaces';
import { TextField } from '../../components/ui/text-field';
import { ApiFailure } from '../../lib/auth-client';
import { vocabularyClient } from '../../lib/vocabulary-client';

type Client = ReturnType<typeof vocabularyClient>;
type Status = 'active' | 'archived' | 'all';
const partOptions: PartOfSpeech[] = [
  'UNKNOWN',
  'NOUN',
  'VERB',
  'ADJECTIVE',
  'ADVERB',
  'PHRASE',
  'OTHER',
];

function errorMessage(error: unknown) {
  if (error instanceof ApiFailure && error.code === 'CONCURRENT_MODIFICATION')
    return 'This item changed elsewhere. Reload it before trying again.';
  return error instanceof Error
    ? error.message
    : 'The request failed. Try again.';
}

function ContextField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        Source context <span className="field__optional">(optional)</span>
      </label>
      <textarea
        id={id}
        className="field__input field__textarea"
        maxLength={3000}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="field__hint">
        A sentence you actually encountered. Leave blank if you have none.
      </p>
    </div>
  );
}

function TagChoices({
  tags,
  selected,
  onChange,
  legend,
}: {
  tags: VocabularyTagView[];
  selected: string[];
  onChange(ids: string[]): void;
  legend: string;
}) {
  return (
    <fieldset className="vocab-tag-choices">
      <legend>{legend}</legend>
      {tags.length === 0 ? (
        <p className="text-muted">
          Create a personal tag below to organize words.
        </p>
      ) : (
        tags.map((tag) => (
          <label key={tag.id} className="vocab-check">
            <input
              type="checkbox"
              checked={selected.includes(tag.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, tag.id]
                    : selected.filter((id) => id !== tag.id),
                )
              }
            />
            <span>{tag.name}</span>
          </label>
        ))
      )}
    </fieldset>
  );
}

function QuickAdd({
  api,
  tags,
  onSaved,
  onClose,
}: {
  api: Client;
  tags: VocabularyTagView[];
  onSaved(item: VocabularyItemView, created: boolean): void;
  onClose(): void;
}) {
  const [lemma, setLemma] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech>('UNKNOWN');
  const [definition, setDefinition] = useState('');
  const [sourceContext, setSourceContext] = useState('');
  const [note, setNote] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<DictionarySenseSuggestion[]>(
    [],
  );
  const [selectedSense, setSelectedSense] = useState<string | null>(null);
  const [providerMessage, setProviderMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const key = useRef<string | null>(null);
  const change = () => {
    key.current = null;
    setError('');
  };

  async function lookup() {
    setLookingUp(true);
    setProviderMessage('');
    setSuggestions([]);
    setSelectedSense(null);
    try {
      const result = await api.lookup(lemma.trim(), true);
      setSuggestions(result.senses);
      setProviderMessage(
        result.status === 'unavailable'
          ? 'No authorized dictionary provider is configured. Add your own meaning below.'
          : result.senses.length
            ? 'These are locally authored EKMS development examples, not a live dictionary.'
            : 'No local example for this word. Add your own meaning below.',
      );
    } catch (failure) {
      setProviderMessage(
        `${errorMessage(failure)} You can still add your own meaning.`,
      );
    } finally {
      setLookingUp(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!lemma.trim() || (!selectedSense && !definition.trim())) {
      setError(
        'Enter a word and your meaning, or select a local example sense.',
      );
      return;
    }
    setBusy(true);
    key.current ??= crypto.randomUUID();
    try {
      const result = await api.create(
        {
          lemma,
          ...(selectedSense
            ? { sourceSenseId: selectedSense }
            : { partOfSpeech, definition }),
          sourceContext: sourceContext.trim() || null,
          note,
          tagIds,
        },
        key.current,
      );
      onSaved(result.item, result.created);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="vocab-panel" aria-label="Quick Add">
      <div className="vocab-panel__header">
        <h2>Quick Add</h2>
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>
      <p className="text-muted">
        Save the meaning you intend to learn. A source sentence is optional.
      </p>
      <form
        className="vocab-form"
        onSubmit={(event) => {
          void submit(event);
        }}
        noValidate
      >
        <TextField
          id="quick-lemma"
          label="English word or phrase"
          value={lemma}
          maxLength={400}
          required
          disabled={busy}
          onChange={(event) => {
            setLemma(event.target.value);
            setSuggestions([]);
            setSelectedSense(null);
            change();
          }}
        />
        <div className="vocab-lookup">
          <Button
            variant="secondary"
            disabled={busy || lookingUp || !lemma.trim()}
            loading={lookingUp}
            onClick={() => {
              void lookup();
            }}
          >
            Find local example senses
          </Button>
          <span className="text-muted">
            No licensed live dictionary is connected.
          </span>
        </div>
        {providerMessage && (
          <Alert tone="info">
            <p>{providerMessage}</p>
          </Alert>
        )}
        {suggestions.length > 0 && (
          <fieldset className="vocab-senses">
            <legend>Choose a locally authored example sense</legend>
            {suggestions.map((sense) => (
              <label className="vocab-sense" key={sense.sourceSenseId}>
                <input
                  type="radio"
                  name="quick-sense"
                  checked={selectedSense === sense.sourceSenseId}
                  onChange={() => {
                    setSelectedSense(sense.sourceSenseId);
                    change();
                  }}
                />
                <span>
                  <strong>{sense.partOfSpeech.toLowerCase()}</strong> ·{' '}
                  {sense.definition}
                  <small>{sense.attribution}</small>
                </span>
              </label>
            ))}
            <label className="vocab-sense">
              <input
                type="radio"
                name="quick-sense"
                checked={selectedSense === null}
                onChange={() => {
                  setSelectedSense(null);
                  change();
                }}
              />
              <span>Write my own meaning</span>
            </label>
          </fieldset>
        )}
        {!selectedSense && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="quick-pos">
                Part of speech
              </label>
              <select
                id="quick-pos"
                className="field__input"
                value={partOfSpeech}
                disabled={busy}
                onChange={(event) => {
                  setPartOfSpeech(event.target.value as PartOfSpeech);
                  change();
                }}
              >
                {partOptions.map((part) => (
                  <option value={part} key={part}>
                    {part.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              id="quick-definition"
              label="Your target meaning"
              value={definition}
              maxLength={1000}
              required
              disabled={busy}
              onChange={(event) => {
                setDefinition(event.target.value);
                change();
              }}
            />
          </>
        )}
        <ContextField
          id="quick-context"
          value={sourceContext}
          onChange={(value) => {
            setSourceContext(value);
            change();
          }}
        />
        <div className="field">
          <label className="field__label" htmlFor="quick-note">
            Personal note <span className="field__optional">(optional)</span>
          </label>
          <textarea
            id="quick-note"
            className="field__input field__textarea"
            maxLength={3000}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              change();
            }}
          />
        </div>
        <TagChoices
          tags={tags}
          selected={tagIds}
          onChange={(ids) => {
            setTagIds(ids);
            change();
          }}
          legend="Personal tags"
        />
        {error && (
          <Alert tone="error">
            <p>{error}</p>
          </Alert>
        )}
        <Button type="submit" disabled={busy} loading={busy}>
          {busy ? 'Saving…' : 'Save word'}
        </Button>
      </form>
    </Card>
  );
}

function Detail({
  item,
  api,
  tags,
  onChanged,
  onClose,
}: {
  item: VocabularyItemView;
  api: Client;
  tags: VocabularyTagView[];
  onChanged(item: VocabularyItemView): void;
  onClose(): void;
}) {
  const [editing, setEditing] = useState(false);
  const [definition, setDefinition] = useState(item.definition);
  const [sourceContext, setSourceContext] = useState(item.sourceContext ?? '');
  const [note, setNote] = useState(item.note);
  const [importance, setImportance] = useState(item.importance);
  const [tagIds, setTagIds] = useState(item.tags.map((tag) => tag.id));
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await api.patch(item.id, {
        expectedVersion: item.version,
        ...(item.definitionProvenance === 'USER_AUTHORED'
          ? { definition }
          : {}),
        sourceContext: sourceContext.trim() || null,
        note,
        importance,
        tagIds,
      });
      onChanged(updated);
      setEditing(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setError('');
    try {
      const updated = await api.setArchived(
        item.id,
        !item.archivedAt,
        item.version,
        crypto.randomUUID(),
      );
      onChanged(updated);
      setConfirmArchive(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="vocab-panel" aria-labelledby="vocab-detail-heading">
      <div className="vocab-panel__header">
        <div>
          <p className="eyebrow">Saved sense</p>
          <h2 id="vocab-detail-heading">{item.lemma}</h2>
        </div>
        <Button variant="quiet" onClick={onClose}>
          Back to words
        </Button>
      </div>
      <p className="vocab-detail__meaning">
        <span className="status-badge">{item.partOfSpeech.toLowerCase()}</span>{' '}
        {item.definition}
      </p>
      <p className="text-muted">
        {item.definitionProvenance === 'USER_AUTHORED'
          ? 'Your own meaning'
          : `${item.attribution ?? 'EKMS original fixture'} · development example`}
      </p>
      {item.archivedAt && (
        <Alert tone="info">
          <p>Archived. Restore this sense to show it in your active library.</p>
        </Alert>
      )}
      {!editing ? (
        <div className="vocab-detail__body">
          <div>
            <h3>Source context</h3>
            <p>{item.sourceContext || 'No source context saved.'}</p>
          </div>
          <div>
            <h3>Personal note</h3>
            <p>{item.note || 'No note saved.'}</p>
          </div>
          <div>
            <h3>Tags</h3>
            <p>
              {item.tags.length
                ? item.tags.map((tag) => tag.name).join(', ')
                : 'No tags assigned.'}
            </p>
          </div>
          <p className="text-muted">
            Importance: {item.importance} · Saved{' '}
            {new Date(item.createdAt).toLocaleDateString()} · Updated{' '}
            {new Date(item.updatedAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <form
          className="vocab-form"
          onSubmit={(event) => {
            void save(event);
          }}
        >
          {item.definitionProvenance === 'USER_AUTHORED' && (
            <TextField
              id="edit-definition"
              label="Target meaning"
              value={definition}
              maxLength={1000}
              required
              onChange={(event) => setDefinition(event.target.value)}
            />
          )}
          <ContextField
            id="edit-context"
            value={sourceContext}
            onChange={setSourceContext}
          />
          <div className="field">
            <label className="field__label" htmlFor="edit-note">
              Personal note
            </label>
            <textarea
              id="edit-note"
              className="field__input field__textarea"
              maxLength={3000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="edit-importance">
              Importance
            </label>
            <select
              id="edit-importance"
              className="field__input"
              value={importance}
              onChange={(event) => setImportance(Number(event.target.value))}
            >
              <option value={1}>Normal</option>
              <option value={2}>Important</option>
              <option value={3}>Very important</option>
            </select>
          </div>
          <TagChoices
            tags={tags}
            selected={tagIds}
            onChange={setTagIds}
            legend="Personal tags"
          />
          <div className="vocab-actions">
            <Button type="submit" disabled={busy} loading={busy}>
              Save changes
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}
      {!editing && (
        <div className="vocab-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(true);
              setError('');
            }}
          >
            Edit word
          </Button>
          <Button
            variant={item.archivedAt ? 'secondary' : 'danger'}
            onClick={() => setConfirmArchive(true)}
          >
            {item.archivedAt ? 'Restore word' : 'Archive word'}
          </Button>
        </div>
      )}
      {confirmArchive && (
        <div
          className="confirm-panel"
          role="group"
          aria-label={item.archivedAt ? 'Confirm restore' : 'Confirm archive'}
        >
          <p>
            {item.archivedAt
              ? 'Restore this sense to the active library?'
              : 'Archive this sense? You can restore it later.'}
          </p>
          <div className="confirm-panel__actions">
            <Button
              variant={item.archivedAt ? 'primary' : 'danger'}
              disabled={busy}
              loading={busy}
              onClick={() => {
                void archive();
              }}
            >
              Confirm {item.archivedAt ? 'restore' : 'archive'}
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => setConfirmArchive(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function TagManager({
  api,
  tags,
  onChanged,
}: {
  api: Client;
  tags: VocabularyTagView[];
  onChanged(): void;
}) {
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    key.current ??= crypto.randomUUID();
    try {
      await api.createTag(name, key.current);
      setName('');
      key.current = null;
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function rename(tag: VocabularyTagView) {
    setBusy(true);
    setError('');
    try {
      await api.renameTag(tag.id, renameValue, tag.version);
      setRenaming(null);
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function remove(tag: VocabularyTagView) {
    setBusy(true);
    setError('');
    try {
      await api.deleteTag(tag.id);
      setConfirmDelete(null);
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="vocab-tags" aria-labelledby="vocab-tags-heading">
      <h2 id="vocab-tags-heading">Personal tags</h2>
      <p className="text-muted">
        Tags belong only to your account. Deleting a tag keeps its words.
      </p>
      <form
        className="vocab-tag-create"
        onSubmit={(event) => {
          void create(event);
        }}
      >
        <TextField
          id="new-tag"
          label="New tag"
          value={name}
          maxLength={50}
          onChange={(event) => {
            setName(event.target.value);
            key.current = null;
          }}
        />
        <Button type="submit" disabled={busy || !name.trim()} loading={busy}>
          Add tag
        </Button>
      </form>
      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}
      <ul className="vocab-tag-list">
        {tags.map((tag) => (
          <li key={tag.id}>
            <span>{tag.name}</span>
            <div className="vocab-actions">
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => {
                  setRenaming(tag.id);
                  setRenameValue(tag.name);
                }}
              >
                Rename
              </Button>
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => setConfirmDelete(tag.id)}
              >
                Delete
              </Button>
            </div>
            {renaming === tag.id && (
              <div className="vocab-tag-edit">
                <TextField
                  id={`rename-${tag.id}`}
                  label="New name"
                  value={renameValue}
                  maxLength={50}
                  onChange={(event) => setRenameValue(event.target.value)}
                />
                <Button
                  disabled={busy}
                  onClick={() => {
                    void rename(tag);
                  }}
                >
                  Save name
                </Button>
                <Button variant="quiet" onClick={() => setRenaming(null)}>
                  Cancel
                </Button>
              </div>
            )}
            {confirmDelete === tag.id && (
              <div
                className="confirm-panel"
                role="group"
                aria-label="Confirm tag deletion"
              >
                <p>Delete this tag? Saved words remain.</p>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    void remove(tag);
                  }}
                >
                  Confirm delete
                </Button>
                <Button variant="quiet" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function VocabularyContent() {
  const { state, request } = useAuth();
  const api = useMemo(() => vocabularyClient(request), [request]);
  const [tags, setTags] = useState<VocabularyTagView[]>([]);
  const [items, setItems] = useState<VocabularyItemView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [tagFilter, setTagFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [quickAdd, setQuickAdd] = useState(false);
  const [selected, setSelected] = useState<VocabularyItemView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const refreshTags = useCallback(() => {
    void api
      .tags()
      .then(setTags)
      .catch((failure) => setError(errorMessage(failure)));
    refresh();
  }, [api, refresh]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    void api
      .tags()
      .then(setTags)
      .catch((failure) => setError(errorMessage(failure)));
  }, [api, state.status]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let active = true;
    setLoading(true);
    setError('');
    void api
      .list({
        q: search,
        status,
        tag: tagFilter,
        cursor: cursorStack[pageIndex] ?? undefined,
        limit: 20,
      })
      .then((result) => {
        if (active) {
          setItems(result.items);
          setNextCursor(result.nextCursor);
        }
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    api,
    state.status,
    search,
    status,
    tagFilter,
    pageIndex,
    cursorStack,
    revision,
  ]);

  async function open(item: VocabularyItemView) {
    setQuickAdd(false);
    setDetailLoading(true);
    setError('');
    try {
      setSelected(await api.get(item.id));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setDetailLoading(false);
    }
  }

  function changed(item: VocabularyItemView) {
    setSelected(item);
    setNotice('Word updated.');
    refresh();
  }
  function changeFilter() {
    setPageIndex(0);
    setCursorStack([null]);
    setSelected(null);
  }

  if (state.status !== 'authenticated') return null;
  return (
    <AppShell current="vocabulary" userEmail={state.user.email}>
      <PageHeader
        eyebrow="Vocabulary Hub"
        title="My words"
        description="Keep each meaning as its own learning object. Add your own meaning even when no dictionary is available."
        action={
          <Button
            onClick={() => {
              setQuickAdd(true);
              setSelected(null);
              setNotice('');
            }}
          >
            Quick Add
          </Button>
        }
      />
      {notice && (
        <Alert tone="success">
          <p>{notice}</p>
        </Alert>
      )}
      {error && (
        <Alert tone="error">
          <p>{error}</p>
          <Button variant="quiet" onClick={refresh}>
            Retry
          </Button>
        </Alert>
      )}
      <div className="vocab-layout">
        <div className="vocab-library">
          <Card aria-labelledby="library-heading">
            <div className="vocab-panel__header">
              <h2 id="library-heading">Personal library</h2>
              <span className="text-muted">One card per target sense</span>
            </div>
            <form
              className="vocab-filters"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput.trim());
                changeFilter();
              }}
            >
              <TextField
                id="vocab-search"
                label="Search words or meanings"
                value={searchInput}
                maxLength={100}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
              <div className="field">
                <label className="field__label" htmlFor="vocab-status">
                  Library status
                </label>
                <select
                  id="vocab-status"
                  className="field__input"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as Status);
                    changeFilter();
                  }}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="vocab-tag-filter">
                  Filter by tag
                </label>
                <select
                  id="vocab-tag-filter"
                  className="field__input"
                  value={tagFilter}
                  onChange={(event) => {
                    setTagFilter(event.target.value);
                    changeFilter();
                  }}
                >
                  <option value="">All tags</option>
                  {tags.map((tag) => (
                    <option value={tag.id} key={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            </form>
            {loading ? (
              <LoadingState label="Loading your words…" />
            ) : !error && items.length === 0 ? (
              <EmptyState
                title={
                  search || status !== 'active' || tagFilter
                    ? 'No matching words'
                    : 'Your library is empty'
                }
                description={
                  search || status !== 'active' || tagFilter
                    ? 'Change the filters or add a new sense.'
                    : 'Use Quick Add to save your first word and meaning.'
                }
              />
            ) : (
              !error && (
                <ul className="vocab-list">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`vocab-word ${selected?.id === item.id ? 'vocab-word--selected' : ''}`}
                        onClick={() => {
                          void open(item);
                        }}
                      >
                        <span className="vocab-word__top">
                          <strong>{item.lemma}</strong>
                          <span className="status-badge">
                            {item.partOfSpeech.toLowerCase()}
                          </span>
                        </span>
                        <span>{item.definition}</span>
                        <small>
                          {item.archivedAt ? 'Archived' : 'Active'}
                          {item.tags.length
                            ? ` · ${item.tags.map((tag) => tag.name).join(', ')}`
                            : ''}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
            <div className="vocab-pagination">
              <Button
                variant="secondary"
                disabled={loading || pageIndex === 0}
                onClick={() => setPageIndex((value) => value - 1)}
              >
                Previous
              </Button>
              <span>Page {pageIndex + 1}</span>
              <Button
                variant="secondary"
                disabled={loading || !nextCursor}
                onClick={() => {
                  if (nextCursor) {
                    setCursorStack((values) => [
                      ...values.slice(0, pageIndex + 1),
                      nextCursor,
                    ]);
                    setPageIndex((value) => value + 1);
                  }
                }}
              >
                Next
              </Button>
            </div>
          </Card>
          <TagManager api={api} tags={tags} onChanged={refreshTags} />
        </div>
        <div className="vocab-side">
          {quickAdd ? (
            <QuickAdd
              api={api}
              tags={tags}
              onSaved={(item, created) => {
                setSelected(item);
                setQuickAdd(false);
                setNotice(
                  created
                    ? 'Word saved.'
                    : 'This sense was already saved. Its existing item is open.',
                );
                refresh();
              }}
              onClose={() => setQuickAdd(false)}
            />
          ) : detailLoading ? (
            <LoadingState label="Opening word…" />
          ) : selected ? (
            <Detail
              key={`${selected.id}-${selected.version}`}
              item={selected}
              api={api}
              tags={tags}
              onChanged={changed}
              onClose={() => setSelected(null)}
            />
          ) : (
            <Card tone="lavender" className="vocab-panel">
              <h2>Choose a sense</h2>
              <p>
                Open a saved word to see its meaning, notes, source context, and
                tags. Quick Add is available without a dictionary provider.
              </p>
              <p className="text-muted">
                IELTS Sets will arrive in a later phase.
              </p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function VocabularyPage() {
  return (
    <ProtectedShell>
      <VocabularyContent />
    </ProtectedShell>
  );
}
