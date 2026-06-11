/**
 * Client-side API module.
 * All calls are proxied through /.netlify/functions/xtream (BFF).
 *
 * The client sends only { pin, action, ...extraParams }.
 * Xtream server credentials live exclusively in Netlify env vars — never
 * in the client or localStorage.
 *
 * Responses are cached in memory with a TTL:
 *   - List data  (categories, streams, series): CACHE_TTL_LONG  (30 min)
 *   - Detail data (vod_info, series_info):      CACHE_TTL_SHORT (10 min)
 *
 * Call clearApiCache() to purge all cached responses (e.g. on user request).
 */

import {
  cacheGet,
  cacheSet,
  cacheClear,
  CACHE_TTL_LONG,
  CACHE_TTL_SHORT,
} from '../utils/cache.js';

const ENDPOINT = '/.netlify/functions/xtream';

// ─── Genre cache ──────────────────────────────────────────────────────────────
// Maps item id (string) → raw genre string (e.g. "Drama, Action").
// Lives for the whole session; cleared together with the API cache.

const _genreMap = new Map();

/**
 * Return the cached genre string for a given item id, or null if unknown.
 * @param {string|number} itemId
 * @returns {string|null}
 */
export function getGenreForItem(itemId) {
  return _genreMap.get(String(itemId)) ?? null;
}

/** Clear the in-memory genre cache. */
function clearGenreCache() {
  _genreMap.clear();
}

/**
 * Low-level fetch wrapper.
 * @param {object} payload  Must include `pin` and `action`.
 * @returns {Promise<any>}
 * @throws {Error} with .status
 */
async function callBff(payload) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw Object.assign(new Error('Nätverksfel — kunde inte nå servern.'), { status: 0 });
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw Object.assign(new Error(`Oväntat svar (${res.status}).`), { status: res.status });
  }

  if (!res.ok) {
    throw Object.assign(
      new Error(data?.error ?? `Serverfel (${res.status}).`),
      { status: res.status }
    );
  }

  return data;
}

/**
 * Generic cache-aside wrapper for BFF calls.
 * @param {string}   key     Cache key
 * @param {object}   payload BFF request payload
 * @param {number}   ttl     TTL in ms
 * @param {boolean}  [force] Skip cache and overwrite on fetch
 */
async function cachedCallBff(key, payload, ttl, force = false) {
  if (!force) {
    const hit = cacheGet(key);
    if (hit !== undefined) return hit;
  }
  const data = await callBff(payload);
  cacheSet(key, data, ttl);
  return data;
}

// ─── Cache management ─────────────────────────────────────────────────────────

/**
 * Purge all cached API responses and the genre cache.
 * Call this when the user explicitly requests a cache refresh.
 */
export function clearApiCache() {
  cacheClear();
  clearGenreCache();
}

// ─── Public API ───────────────────────────────────────────────────────────────
// Each function receives `pin` as a string.
// `authenticate` is intentionally NOT cached (security-sensitive).

export async function authenticate(pin) {
  return callBff({ pin, action: 'authenticate' });
}

export async function getVodCategories(pin) {
  return cachedCallBff(
    'vod_categories',
    { pin, action: 'get_vod_categories' },
    CACHE_TTL_LONG,
  );
}

export async function getSeriesCategories(pin) {
  return cachedCallBff(
    'series_categories',
    { pin, action: 'get_series_categories' },
    CACHE_TTL_LONG,
  );
}

export async function getVodStreams(pin, categoryId = '') {
  const key = `vod_streams:${categoryId}`;
  return cachedCallBff(
    key,
    { pin, action: 'get_vod_streams', ...(categoryId ? { category_id: categoryId } : {}) },
    CACHE_TTL_LONG,
  );
}

export async function getSeries(pin, categoryId = '') {
  const key = `series:${categoryId}`;
  return cachedCallBff(
    key,
    { pin, action: 'get_series', ...(categoryId ? { category_id: categoryId } : {}) },
    CACHE_TTL_LONG,
  );
}

export async function getVodInfo(pin, vodId) {
  const key = `vod_info:${vodId}`;
  const data = await cachedCallBff(
    key,
    { pin, action: 'get_vod_info', vod_id: vodId },
    CACHE_TTL_SHORT,
  );
  const genre = data?.info?.genre;
  if (genre?.trim()) _genreMap.set(String(vodId), genre.trim());
  return data;
}

export async function getSeriesInfo(pin, seriesId) {
  const key = `series_info:${seriesId}`;
  const data = await cachedCallBff(
    key,
    { pin, action: 'get_series_info', series_id: seriesId },
    CACHE_TTL_SHORT,
  );
  const genre = data?.info?.genre;
  if (genre?.trim()) _genreMap.set(String(seriesId), genre.trim());
  return data;
}

// ─── Genre prefetch ───────────────────────────────────────────────────────────

/**
 * Batch-prefetch genre data for a list of items in the background.
 * Fetches detail info (via the existing cached API) for items not yet in the
 * genre map, processes up to `maxItems` items, and calls `onProgress` after
 * each completed item so the caller can update the UI incrementally.
 *
 * @param {string}   pin
 * @param {object[]} items
 * @param {'vod'|'series'} type
 * @param {object}   [opts]
 * @param {number}   [opts.concurrency=5]  Parallel requests per batch
 * @param {number}   [opts.maxItems=300]   Cap on total items to process
 * @param {Function} [opts.onProgress]     Called as (loadedCount, totalCount)
 * @param {AbortSignal} [opts.signal]      Cancel signal
 */
export async function prefetchGenres(pin, items, type, {
  concurrency = 5,
  maxItems = 300,
  onProgress,
  signal,
} = {}) {
  const limited = items.slice(0, maxItems);

  // Skip items whose genre is already in the cache
  const pending = limited.filter(item => {
    const id = _itemId(item, type);
    return id != null && !_genreMap.has(String(id));
  });

  const total = pending.length;
  let loaded = 0;

  for (let i = 0; i < pending.length; i += concurrency) {
    if (signal?.aborted) break;

    const batch = pending.slice(i, i + concurrency);

    await Promise.allSettled(batch.map(async (item) => {
      if (signal?.aborted) return;
      const id = _itemId(item, type);
      if (id == null) return;
      try {
        if (type === 'vod') await getVodInfo(pin, id);
        else await getSeriesInfo(pin, id);
      } catch {
        // Ignore individual failures — the item just won't have a genre
      }
      loaded++;
      onProgress?.(loaded, total);
    }));

    // Brief pause between batches to keep API load gentle
    if (i + concurrency < pending.length && !signal?.aborted) {
      await new Promise(r => setTimeout(r, 80));
    }
  }
}

function _itemId(item, type) {
  if (type === 'vod') return item.stream_id ?? item.vod_id ?? item.id ?? null;
  return item.series_id ?? item.id ?? null;
}
