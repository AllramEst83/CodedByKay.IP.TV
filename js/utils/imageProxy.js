/**
 * Image URL helper.
 *
 * Rewrites plain-HTTP image URLs to go through the server-side image proxy
 * (/.netlify/functions/image), preventing mixed-content blocking when the
 * app is served over HTTPS but the IPTV server only supports HTTP.
 *
 * HTTPS and relative URLs are returned unchanged.
 */

const PROXY = '/.netlify/functions/image';

/**
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function proxyImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://')) {
    return `${PROXY}?url=${encodeURIComponent(url)}`;
  }
  return url;
}
