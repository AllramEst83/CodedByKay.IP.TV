/**
 * Lightweight TTL-based in-memory cache.
 *
 * Entries are stored as { value, expiresAt } pairs in a Map.
 * Expired entries are evicted lazily on the next read.
 *
 * TTL constants (ms):
 *   CACHE_TTL_LONG  — large list data (categories, streams, series)
 *   CACHE_TTL_SHORT — detail data (vod_info, series_info)
 */

export const CACHE_TTL_LONG  = 30 * 60 * 1000; // 30 minutes
export const CACHE_TTL_SHORT = 10 * 60 * 1000; // 10 minutes

/** @type {Map<string, { value: unknown, expiresAt: number }>} */
const _store = new Map();

/**
 * Retrieve a cached value. Returns `undefined` if the key is absent or expired.
 * @param {string} key
 * @returns {unknown | undefined}
 */
export function cacheGet(key) {
  const entry = _store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    _store.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Store a value under the given key with a TTL.
 * @param {string} key
 * @param {unknown} value
 * @param {number} [ttlMs=CACHE_TTL_LONG]
 */
export function cacheSet(key, value, ttlMs = CACHE_TTL_LONG) {
  _store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Remove a single entry from the cache.
 * @param {string} key
 */
export function cacheDel(key) {
  _store.delete(key);
}

/**
 * Remove all cached entries.
 */
export function cacheClear() {
  _store.clear();
}

/**
 * Returns the number of (potentially not-yet-evicted) entries currently held.
 * Useful for debugging.
 */
export function cacheSize() {
  return _store.size;
}

/**
 * Returns the ISO expiry timestamp for a key, or null if not cached / expired.
 * @param {string} key
 * @returns {string | null}
 */
export function cacheExpiresAt(key) {
  const entry = _store.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return new Date(entry.expiresAt).toISOString();
}
