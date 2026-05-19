/**
 * useDebouncedCallback — single source of truth for debounce timing
 * across the app.  Returns a memoised function that calls the latest
 * `callback` after `delay` ms of inactivity.  Cleared on unmount.
 *
 * Why it exists (Part X.7 + 2026-05-19 reviewer follow-up):
 *   DebouncedSearch + SearchScreen both need the same debounce
 *   behaviour.  Earlier the timer + setTimeout logic was duplicated
 *   inline in two places — DRY violation called out by the reviewer.
 *   This hook is the ONLY place that owns the timer; both DebouncedSearch
 *   (primitive) and SearchScreen (composed UI with extra chrome) call
 *   into it.  No parallel paths.
 *
 * Usage:
 *   const debouncedFire = useDebouncedCallback(fire, 250);
 *   onChange={(text) => debouncedFire(text)}
 *
 * Plan ref: Part X.7.1 (P9 follow-up).
 */
import { useCallback, useEffect, useRef } from 'react';

const useDebouncedCallback = (callback, delay = 250) => {
  const timerRef = useRef(null);
  const callbackRef = useRef(callback);
  const mountedRef = useRef(true);

  // Track the latest callback without re-creating the debounced fn
  // on every render — caller can pass an inline arrow and we'll
  // still call the freshest version.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return useCallback(
    (...args) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        if (typeof callbackRef.current === 'function') {
          callbackRef.current(...args);
        }
      }, delay);
    },
    [delay],
  );
};

export default useDebouncedCallback;
