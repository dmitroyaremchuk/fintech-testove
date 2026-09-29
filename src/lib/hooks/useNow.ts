'use client';

import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

/** Current time, refreshed every minute so "today", overdue counts and badges stay correct. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}
