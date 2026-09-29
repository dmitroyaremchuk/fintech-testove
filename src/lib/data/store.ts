// App data store (Zustand). Owns the loaded dataset, the load status and the session.
// Components read role-scoped data through useScopedData(); scoping itself lives in scope.ts.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Id } from '../types';
import type { Dataset } from './dataset';
import {
  createRepository,
  parseScreenState,
  RepositoryError,
  type Repository,
  type ScreenState,
} from './repository';
import { scopeDataset, type Session } from './scope';
import { browserStorage, memoryStorage, type KeyValueStorage } from './storage';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DataState {
  status: LoadStatus;
  data: Dataset | null;
  error: RepositoryError | null;
  session: Session;
  /** Manager last chosen in "Log in as", restored when switching back from Head. */
  lastManagerId: Id;
  /** False until the saved session was read (first render uses the default, like the server). */
  hydrated: boolean;
  /** Forced demo state from ?state=, for screens to render the matching empty state. */
  screenState: ScreenState;
  load: () => Promise<void>;
  /** Replace the dataset and persist it. Rules produce the next dataset; the store just saves it. */
  commit: (next: Dataset) => void;
  /**
   * Apply a change to the LATEST dataset. Use when a change may land after others (delayed
   * commits, e.g. after an animation) and for precise inverse Undo that keeps later edits.
   */
  update: (change: (current: Dataset) => Dataset) => void;
  /** "Reset demo data" in the profile menu. Returns the previous dataset for Undo. */
  reset: () => Dataset | null;
  setSession: (session: Session) => void;
}

export const SESSION_KEY = 'fundpath:session';
const DEFAULT_MANAGER = 'u1';
const DEFAULT_SESSION: Session = { role: 'manager', userId: DEFAULT_MANAGER };

interface PersistedSession extends Session {
  lastManagerId: Id;
}

function readSession(storage: KeyValueStorage): PersistedSession {
  try {
    const raw = storage.getItem(SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PersistedSession>) : null;
    if (
      (parsed?.role === 'manager' || parsed?.role === 'head') &&
      typeof parsed.userId === 'string'
    ) {
      const lastManagerId =
        typeof parsed.lastManagerId === 'string'
          ? parsed.lastManagerId
          : parsed.role === 'manager'
            ? parsed.userId
            : DEFAULT_MANAGER;
      return { role: parsed.role, userId: parsed.userId, lastManagerId };
    }
  } catch {
    // ignore corrupt session
  }
  return { ...DEFAULT_SESSION, lastManagerId: DEFAULT_MANAGER };
}

export function createDataStore(repo: Repository, storage: KeyValueStorage): StoreApi<DataState> {
  return createStore<DataState>()((set, get) => ({
    status: 'idle',
    data: null,
    error: null,
    session: DEFAULT_SESSION,
    lastManagerId: DEFAULT_MANAGER,
    hydrated: false,
    screenState: repo.state,

    async load() {
      if (!get().hydrated) {
        const { lastManagerId, ...session } = readSession(storage);
        set({ session, lastManagerId, hydrated: true });
      }
      set({ status: 'loading', error: null });
      try {
        const data = await repo.load();
        set({ status: 'ready', data });
      } catch (err) {
        const error =
          err instanceof RepositoryError ? err : new RepositoryError('NET_TIMEOUT', new Date());
        set({ status: 'error', error });
      }
    },

    commit(next) {
      repo.save(next);
      set({ data: next });
    },

    update(change) {
      const current = get().data;
      if (!current) return;
      const next = change(current);
      repo.save(next);
      set({ data: next });
    },

    reset() {
      const previous = get().data;
      set({ data: repo.reset(), status: 'ready', error: null });
      return previous;
    },

    setSession(session) {
      const lastManagerId = session.role === 'manager' ? session.userId : get().lastManagerId;
      try {
        const payload: PersistedSession = { ...session, lastManagerId };
        storage.setItem(SESSION_KEY, JSON.stringify(payload));
      } catch {
        // storage blocked: keep the session in memory
      }
      set({ session, lastManagerId });
    },
  }));
}

let appStore: StoreApi<DataState> | null = null;

/** The browser singleton, created on first use with localStorage and the current ?state=. */
function getAppStore(): StoreApi<DataState> {
  if (!appStore) {
    const storage = browserStorage() ?? memoryStorage();
    const state = parseScreenState(typeof window === 'undefined' ? '' : window.location.search);
    appStore = createDataStore(createRepository({ storage, state }), storage);
  }
  return appStore;
}

export function useDataStore<T>(selector: (state: DataState) => T): T {
  return useStore(getAppStore(), selector);
}

/** The dataset as the current session is allowed to see it, or null until loaded. */
export function useScopedData(): Dataset | null {
  const data = useDataStore((s) => s.data);
  const session = useDataStore((s) => s.session);
  return useMemo(() => (data ? scopeDataset(data, session) : null), [data, session]);
}
