/**
 * Netlify Function — Image proxy
 *
 * Fetches an image from a third-party HTTP URL server-side and returns it
 * to the browser over HTTPS, preventing mixed-content blocking when the
 * Xtream IPTV server serves images over plain HTTP.
 *
 * IPTV providers commonly host cover images on servers that are entirely
 * separate from the main API host (different CDNs, image servers, etc.),
 * so any host-based allowlist would block legitimate images. Instead the
 * proxy is secured by:
 *   - Blocking requests to private/loopback IP ranges (SSRF protection)
 *   - Only forwarding responses with an image/* Content-Type
 *   - Only accepting GET / HEAD requests
 *
 * Usage:  GET /.netlify/functions/image?url=<encoded-image-url>
 */

const TIMEOUT_MS = 10_000;

// IPv4 private / loopback / link-local ranges (SSRF guard)
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/;

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(null, { status: 405 });
  }

  // ── 1. Parse & validate the requested URL ────────────────────────────────
  const reqUrl = new URL(req.url);
  const imageUrl = reqUrl.searchParams.get('url');

  if (!imageUrl) {
    return new Response(null, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return new Response(null, { status: 400 });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response(null, { status: 400 });
  }

  // ── 2. SSRF guard — block private / loopback hosts ───────────────────────
  const hostname = parsed.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '::1' ||
    PRIVATE_IP_RE.test(hostname)
  ) {
    return new Response(null, { status: 403 });
  }

  // ── 3. Fetch image from upstream ─────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'IPTVHub/1.0' },
    });

    clearTimeout(timeoutId);

    if (!upstream.ok) {
      return new Response(null, { status: upstream.status >= 400 ? upstream.status : 502 });
    }

    const contentType = upstream.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!contentType.startsWith('image/')) {
      return new Response(null, { status: 415 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return new Response(null, { status: 504 });
    }

    return new Response(null, { status: 502 });
  }
}

