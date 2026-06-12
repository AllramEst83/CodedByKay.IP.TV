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
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function proxyImageUrl(url) {
  if (!url) return null;
  // Only proxy HTTP images when running over HTTPS (production)
  if (IS_SECURE && url.startsWith('http://')) {
    return `${PROXY}?url=${encodeURIComponent(url)}`;
  }
  return url;
}
