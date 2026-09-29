// In-memory repository persisted to localStorage, with fake latency and a forced screen state
// (?state=ready|loading|empty|error) so every screen's states can be shown on demand.

import { SIMULATED_LATENCY_MS } from '../constants';
import { emptyDataset, type Dataset } from './dataset';
import { createSeed } from './seed/build';
import type { KeyValueStorage } from './storage';

export const SCREEN_STATES = ['ready', 'loading', 'empty', 'error'] as const;
export type ScreenState = (typeof SCREEN_STATES)[number];

/** Reads `?state=` from a query string; anything unknown or missing means "ready". */
export function parseScreenState(search: string | null | undefined): ScreenState {
  const value = new URLSearchParams(search ?? '').get('state');
  return SCREEN_STATES.find((s) => s === value) ?? 'ready';
}

export const STORAGE_KEY = 'fundpath:data';
/** Bump when the Dataset shape changes; older saved data is replaced by a fresh seed. */
export const SCHEMA_VERSION = 1;

interface Persisted {
  version: number;
  savedAt: string;
  data: Dataset;
}

export class RepositoryError extends Error {
  constructor(
    readonly code: 'NET_TIMEOUT',
    readonly at: Date,
  ) {
    super(`Couldn’t load data (${code})`);
    this.name = 'RepositoryError';
  }
}

export interface Repository {
  /** Resolves after the simulated latency. `loading` never resolves, `error` rejects. */
  load(): Promise<Dataset>;
  /** Persists the whole dataset. Ignored in forced demo states so they never overwrite real data. */
  save(data: Dataset): void;
  /** Replaces everything with a fresh seed built for the current date. */
  reset(): Dataset;
  readonly state: ScreenState;
}

export interface RepositoryOptions {
  storage: KeyValueStorage;
  state?: ScreenState;
  latencyMs?: number;
  now?: () => Date;
}

const ARRAYS: (keyof Dataset)[] = [
  'users',
  'clients',
  'deals',
  'applications',
  'documents',
  'interactions',
  'tasks',
];

function isDataset(value: unknown): value is Dataset {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return ARRAYS.every((key) => Array.isArray(record[key]));
}

export function createRepository({
  storage,
  state = 'ready',
  latencyMs = SIMULATED_LATENCY_MS,
  now = () => new Date(),
}: RepositoryOptions): Repository {
  const read = (): Dataset | null => {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Persisted>;
      if (parsed.version !== SCHEMA_VERSION || !isDataset(parsed.data)) return null;
      return parsed.data;
    } catch {
      return null; // corrupt JSON: fall back to a fresh seed
    }
  };

  const write = (data: Dataset) => {
    try {
      const payload: Persisted = { version: SCHEMA_VERSION, savedAt: now().toISOString(), data };
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded or storage blocked: keep working in memory for this session.
    }
  };

  const seed = (): Dataset => {
    const data = createSeed(now());
    write(data);
    return data;
  };

  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, latencyMs));

  return {
    state,
    async load() {
      if (state === 'loading') return new Promise<Dataset>(() => undefined);
      await wait();
      if (state === 'error') throw new RepositoryError('NET_TIMEOUT', now());
      const data = read() ?? seed();
      return structuredClone(state === 'empty' ? emptyDataset(data.users) : data);
    },
    save(data) {
      if (state !== 'ready') return;
      write(data);
    },
    reset() {
      return structuredClone(seed());
    },
  };
}
