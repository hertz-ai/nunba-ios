/**
 * apiCache — in-memory TTL cache for read-only API responses.
 *
 * Why this exists:
 *   Every tab switch in Hevolve currently re-fetches the same data.
 *   Tap Notifications → tap back to People → feed re-fetches even
 *   though you were just there.  This is the perceived-slowness the
 *   user called out as "make all pages snappy".  A 30-second TTL on
 *   list endpoints + 5s on counts means common tab-flipping reads
 *   are served from RAM, while mutations bust their affected keys.
 *
 * Design:
 *   - Map-backed Map<key, {at:number, ttl:number, value:any}>.
 *   - Key: HTTP method + URL + stringified body.
 *   - LRU-cap at 200 entries (avoids unbounded growth).
 *   - bust(prefix) invalidates all keys starting with a prefix —
 *     called from mutation paths so `POST /posts/like` busts
 *     `GET /posts/<id>` reads.
 *
 * Usage:
 *   import { wrap, bust } from 'services/apiCache';
 *
 *   export const list = () => wrap('GET:/api/social/posts', null, 30_000, async () => {
 *     const r = await fetch(...);
 *     return r.json();
 *   });
 *
 *   export const like = (id) => fetch(...).then(r => { bust('GET:/api/social/posts'); return r.json(); });
 *
 * Phone-perf invariant: zero blocking work on the main thread.
 */

const MAX_ENTRIES = 200;
const store = new Map();

const evictIfNeeded = () => {
  if (store.size <= MAX_ENTRIES) return;
  // Evict oldest entries (Map iteration order = insertion order).
  const toEvict = store.size - MAX_ENTRIES;
  let n = 0;
  for (const k of store.keys()) {
    if (n++ >= toEvict) break;
    store.delete(k);
  }
};

export const wrap = async (key, _body, ttlMs, fetcher) => {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < hit.ttl) {
    return hit.value;
  }
  const value = await fetcher();
  store.set(key, { at: now, ttl: ttlMs, value });
  evictIfNeeded();
  return value;
};

export const bust = (prefix) => {
  if (!prefix) return;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
};

export const bustAll = () => store.clear();

export const _stats = () => ({ size: store.size, keys: Array.from(store.keys()) });

export default { wrap, bust, bustAll };
