import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRepository,
  parseScreenState,
  RepositoryError,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from './repository';
import { memoryStorage, type KeyValueStorage } from './storage';

const NOW = new Date(2026, 8, 29, 10, 14);
const repo = (storage: KeyValueStorage, state?: Parameters<typeof createRepository>[0]['state']) =>
  createRepository({ storage, state, latencyMs: 0, now: () => NOW });

afterEach(() => {
  vi.useRealTimers();
});

describe('parseScreenState', () => {
  it.each([
    ['?state=loading', 'loading'],
    ['?state=empty', 'empty'],
    ['?state=error', 'error'],
    ['?state=ready', 'ready'],
    ['?tab=kanban&state=empty', 'empty'],
    ['?state=broken', 'ready'],
    ['', 'ready'],
    [null, 'ready'],
  ])('%s → %s', (search, expected) => {
    expect(parseScreenState(search)).toBe(expected);
  });
});

describe('repository', () => {
  it('seeds on first load and persists to storage', async () => {
    const storage = memoryStorage();
    const data = await repo(storage).load();
    expect(data.deals).toHaveLength(60);
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(saved.version).toBe(SCHEMA_VERSION);
    expect(saved.data.deals).toHaveLength(60);
  });

  it('keeps changes across reloads', async () => {
    const storage = memoryStorage();
    const first = repo(storage);
    const data = await first.load();
    first.save({ ...data, tasks: [] });
    expect((await repo(storage).load()).tasks).toEqual([]);
  });

  it('returns copies: mutating loaded data does not change what is stored', async () => {
    const storage = memoryStorage();
    const r = repo(storage);
    const data = await r.load();
    data.deals.length = 0;
    expect((await r.load()).deals).toHaveLength(60);
  });

  it('replaces corrupt or outdated saved data with a fresh seed', async () => {
    expect((await repo(memoryStorage({ [STORAGE_KEY]: '{not json' })).load()).deals).toHaveLength(
      60,
    );
    const old = JSON.stringify({ version: SCHEMA_VERSION - 1, data: { deals: [] } });
    expect((await repo(memoryStorage({ [STORAGE_KEY]: old })).load()).deals).toHaveLength(60);
    const wrongShape = JSON.stringify({ version: SCHEMA_VERSION, data: { deals: 'x' } });
    expect((await repo(memoryStorage({ [STORAGE_KEY]: wrongShape })).load()).deals).toHaveLength(
      60,
    );
  });

  it('keeps working in memory when storage is full or blocked', async () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const r = repo(storage);
    const data = await r.load();
    expect(data.deals).toHaveLength(60);
    expect(() => r.save(data)).not.toThrow();
  });

  it('reset() brings back the demo data after changes', async () => {
    const storage = memoryStorage();
    const r = repo(storage);
    r.save({ ...(await r.load()), deals: [] });
    expect(r.reset().deals).toHaveLength(60);
    expect((await r.load()).deals).toHaveLength(60);
  });

  it('waits for the simulated latency before resolving', async () => {
    vi.useFakeTimers();
    const r = createRepository({ storage: memoryStorage(), latencyMs: 450, now: () => NOW });
    let done = false;
    const promise = r.load().then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(449);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(done).toBe(true);
  });
});

describe('forced screen states', () => {
  it('loading never resolves', async () => {
    vi.useFakeTimers();
    let settled = false;
    void repo(memoryStorage(), 'loading')
      .load()
      .finally(() => {
        settled = true;
      });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe(false);
  });

  it('error rejects with NET_TIMEOUT', async () => {
    const error = await repo(memoryStorage(), 'error')
      .load()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).code).toBe('NET_TIMEOUT');
  });

  it('empty keeps users (so the shell renders) and nothing else', async () => {
    const data = await repo(memoryStorage(), 'empty').load();
    expect(data.users).toHaveLength(6);
    expect([data.clients, data.deals, data.applications, data.tasks, data.interactions]).toEqual([
      [],
      [],
      [],
      [],
      [],
    ]);
  });

  it('a forced state never overwrites the real saved data', async () => {
    const storage = memoryStorage();
    await repo(storage).load();
    const before = storage.getItem(STORAGE_KEY);
    const empty = repo(storage, 'empty');
    empty.save(await empty.load());
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });
});
