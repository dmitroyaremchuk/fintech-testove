import { useCallback, useState } from 'react';
import { browserStorage, type KeyValueStorage } from '@/src/lib/data';
import type { SavedView } from '@/src/lib/data/clients';

const KEY = 'fundpath:client-views';

function read(storage: KeyValueStorage | null): SavedView[] {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
}

/** Filters the user saved on the Clients list, kept in this browser. */
export function useSavedViews() {
  const [views, setViews] = useState<SavedView[]>(() => read(browserStorage()));

  const persist = useCallback((next: SavedView[]) => {
    setViews(next);
    try {
      browserStorage()?.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage blocked: keep for this session only
    }
  }, []);

  const add = useCallback(
    (view: Omit<SavedView, 'id'>): SavedView => {
      const saved = { ...view, id: `v${Date.now().toString(36)}` };
      persist([...views, saved]);
      return saved;
    },
    [views, persist],
  );

  const remove = useCallback(
    (id: string) => persist(views.filter((v) => v.id !== id)),
    [views, persist],
  );

  const restore = useCallback((list: SavedView[]) => persist(list), [persist]);

  return { views, add, remove, restore };
}
