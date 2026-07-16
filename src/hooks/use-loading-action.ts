'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * useLoadingAction — Reusable hook for async button actions.
 *
 * Prevents double-clicks and provides loading state for any async operation.
 *
 * Usage:
 *   const { loading, run } = useLoadingAction();
 *   <Button disabled={loading} onClick={() => run(async () => { await doSomething(); })}>
 *     {loading ? "Loading..." : "Click me"}
 *   </Button>
 *
 * For multiple independent actions (e.g., each friend request button):
 *   const action1 = useLoadingAction();
 *   const action2 = useLoadingAction();
 *
 * Or use useLoadingMap for keyed actions (buy item by ID, accept friend by username):
 *   const { isLoading, run } = useLoadingMap();
 *   <Button disabled={isLoading(itemId)} onClick={() => run(itemId, async () => { await buy(itemId); })}>
 */
export function useLoadingAction() {
  const [loading, setLoading] = useState(false);
  const runningRef = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    // Prevent double-execution
    if (runningRef.current) return undefined;
    runningRef.current = true;
    setLoading(true);
    try {
      return await fn();
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, []);

  return { loading, run };
}

/**
 * useLoadingMap — For multiple independent loading states keyed by ID.
 *
 * Useful when you have a list of items (shop items, friend requests) and
 * each one can trigger an async action independently.
 *
 * Usage:
 *   const { isLoading, run } = useLoadingMap();
 *   <Button disabled={isLoading(item.id)} onClick={() => run(item.id, async () => await buy(item.id))}>
 *     {isLoading(item.id) ? "Buying..." : "Buy"}
 *   </Button>
 */
export function useLoadingMap() {
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const runningMap = useRef<Map<string, boolean>>(new Map());

  const isLoading = useCallback((key: string) => loadingKeys.has(key), [loadingKeys]);

  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    // Prevent double-execution for the same key
    if (runningMap.current.get(key)) return undefined;
    runningMap.current.set(key, true);
    setLoadingKeys(prev => new Set(prev).add(key));
    try {
      return await fn();
    } finally {
      runningMap.current.set(key, false);
      setLoadingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  return { isLoading, run };
}
