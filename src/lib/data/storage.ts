/** The subset of the Web Storage API the repository needs. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage: tests, SSR, and browsers where localStorage is blocked. */
export function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/**
 * window.localStorage if it exists and is writable, otherwise null
 * (private mode, disabled cookies, server render).
 */
export function browserStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    const probe = '__fundpath_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}
