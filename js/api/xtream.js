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
// Persisted in localStorage so genres accumulate across sessions from
// detail modal views — no background prefetch needed.

const GENRE_STORAGE_KEY = 'iptv-hub-genres';

const _genreMap = _hydrateGenreMap();

function _hydrateGenreMap() {
  try {
    const raw = localStorage.getItem(GENRE_STORAGE_KEY);
    if (raw) return new Map(JSON.parse(raw));
  } catch { /* corrupted data — start fresh */ }
  return new Map();
}

function _persistGenreMap() {
  try {
    const entries = [..._genreMap.entries()].slice(-2000);
    localStorage.setItem(GENRE_STORAGE_KEY, JSON.stringify(entries));
  } catch { /* storage full — non-critical */ }
}

/**
 * Return the cached genre string for a given item id, or null if unknown.
 * @param {string|number} itemId
 * @returns {string|null}
 */
export function getGenreForItem(itemId) {
  return _genreMap.get(String(itemId)) || null;
}

/**
 * Store a genre for an item. Called internally by getVodInfo/getSeriesInfo.
 */
function _setGenre(itemId, genre) {
  _genreMap.set(String(itemId), genre);
  _persistGenreMap();
}

/** Clear the in-memory genre cache (but keep localStorage for next session). */
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
    throw Object.assign(new Error('Network error — could not reach the server.'), { status: 0 });
  }

  let data;
  try {
    data = await res.json();
    console.log(data);
  } catch {
    throw Object.assign(new Error(`Unexpected response (${res.status}).`), { status: res.status });
  }

  if (!res.ok) {
    throw Object.assign(
      new Error(data?.error ?? `Server error (${res.status}).`),
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
  const data = await cachedCallBff(
    key,
    { pin, action: 'get_vod_streams', ...(categoryId ? { category_id: categoryId } : {}) },
    CACHE_TTL_LONG,
  );
  // Some Xtream servers return an object or null instead of an array
  // when no category_id is given — normalise to always return an array.
  return Array.isArray(data) ? data : [];
}

export async function getSeries(pin, categoryId = '') {
  const key = `series:${categoryId}`;
  const data = await cachedCallBff(
    key,
    { pin, action: 'get_series', ...(categoryId ? { category_id: categoryId } : {}) },
    CACHE_TTL_LONG,
  );
  // Normalise to always return an array
  return Array.isArray(data) ? data : [];
}

export async function getVodInfo(pin, vodId) {
  const key = `vod_info:${vodId}`;
  const data = await cachedCallBff(
    key,
    { pin, action: 'get_vod_info', vod_id: vodId },
    CACHE_TTL_SHORT,
  );
  const genre = data?.info?.genre;
  if (genre?.trim()) _setGenre(vodId, genre.trim());
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
  if (genre?.trim()) _setGenre(seriesId, genre.trim());
  return data;
}

