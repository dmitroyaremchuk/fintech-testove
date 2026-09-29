import { describe, expect, it } from 'vitest';
import { createRepository } from './repository';
import { memoryStorage } from './storage';
import { createDataStore } from './store';

const NOW = new Date(2026, 8, 29, 10, 14);
const setup = (state?: 'ready' | 'empty' | 'error') => {
  const storage = memoryStorage();
  const repo = createRepository({ storage, state, latencyMs: 0, now: () => NOW });
  return { storage, store: createDataStore(repo, storage) };
};

describe('data store', () => {
  it('idle → loading → ready', async () => {
    const { store } = setup();
    expect(store.getState().status).toBe('idle');
    const loading = store.getState().load();
    expect(store.getState().status).toBe('loading');
    await loading;
    expect(store.getState().status).toBe('ready');
    expect(store.getState().data?.deals).toHaveLength(60);
  });

  it('error state is exposed with its code', async () => {
    const { store } = setup('error');
    await store.getState().load();
    expect(store.getState().status).toBe('error');
    expect(store.getState().error?.code).toBe('NET_TIMEOUT');
    expect(store.getState().data).toBeNull();
  });

  it('empty state loads an empty dataset and tells screens why', async () => {
    const { store } = setup('empty');
    await store.getState().load();
    expect(store.getState().screenState).toBe('empty');
    expect(store.getState().data?.clients).toEqual([]);
  });

  it('commit persists; reset restores the demo data', async () => {
    const { store } = setup();
    await store.getState().load();
    const data = store.getState().data!;
    store.getState().commit({ ...data, tasks: [] });
    expect(store.getState().data?.tasks).toEqual([]);
    store.getState().reset();
    expect(store.getState().data?.tasks.length).toBeGreaterThan(0);
  });

  it('session defaults to Olena as manager and is restored on load (after first render)', async () => {
    const { store, storage } = setup();
    expect(store.getState().session).toEqual({ role: 'manager', userId: 'u1' });
    store.getState().setSession({ role: 'head', userId: 'h1' });

    const repo = createRepository({ storage, latencyMs: 0, now: () => NOW });
    const reloaded = createDataStore(repo, storage);
    expect(reloaded.getState().session.role).toBe('manager'); // same as the server render
    await reloaded.getState().load();
    expect(reloaded.getState().session).toEqual({ role: 'head', userId: 'h1' });
  });

  it('remembers the last manager picked, for switching back from Head', async () => {
    const { store, storage } = setup();
    store.getState().setSession({ role: 'manager', userId: 'u3' });
    store.getState().setSession({ role: 'head', userId: 'h1' });
    expect(store.getState().lastManagerId).toBe('u3');

    const reloaded = createDataStore(
      createRepository({ storage, latencyMs: 0, now: () => NOW }),
      storage,
    );
    await reloaded.getState().load();
    expect(reloaded.getState().lastManagerId).toBe('u3');
  });

  it('reset returns the previous data so the UI can offer Undo', async () => {
    const { store } = setup();
    await store.getState().load();
    const before = store.getState().data!;
    store.getState().commit({ ...before, tasks: [] });
    const previous = store.getState().reset();
    expect(previous?.tasks).toEqual([]);
    store.getState().commit(previous!);
    expect(store.getState().data?.tasks).toEqual([]);
  });
});
