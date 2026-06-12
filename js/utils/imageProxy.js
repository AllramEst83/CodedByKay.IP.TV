/**
 * Image URL helper.
 *
 * In production (HTTPS), plain HTTP image URLs are rewritten to pass through
 * the server-side image proxy (/.netlify/functions/image) to prevent
 * mixed-content blocking when the IPTV server only supports HTTP.
 *
 * In development (localhost / HTTP context), URLs are returned as-is since
 * the proxy endpoint doesn't exist in the Vite dev server, and mixed-content
 * blocking does not apply on non-secure origins.
 *
 * HTTPS and relative URLs are always returned unchanged.
 */

const PROXY = '/.netlify/functions/image';

/**
 * Whether we are running in a secure production context.
 * In dev (localhost, file://), window.location.protocol is 'http:'.
 */
const IS_SECURE = typeof window !== 'undefined' && window.location.protocol === 'https:';

/**
 * Normalizes Xtream image fields (string, array, or nested object) to a URL string.
 * @param {unknown} value
 * @returns {string|null}
 */
export function resolveImageUrl(value) {
  if (value == null || value === '') return null;

  if (Array.isArray(value)) {
    return resolveImageUrl(value[0]);
  }

  if (typeof value === 'object') {
    return resolveImageUrl(value.url ?? value.path ?? value.src ?? null);
  }

  const url = String(value).trim();
  return url || null;
}

/**
 * @param {unknown} url
 * @returns {string|null}
 */
export function proxyImageUrl(url) {
  const resolved = resolveImageUrl(url);
  if (!resolved) return null;

  // Only proxy HTTP images when running over HTTPS (production)
  if (IS_SECURE && resolved.startsWith('http://')) {
    return `${PROXY}?url=${encodeURIComponent(resolved)}`;
  }
  return resolved;
}
