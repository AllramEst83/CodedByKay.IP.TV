/**
 * Netlify Function — Image proxy
 *
 * Fetches an image from a third-party HTTP URL server-side and returns it
 * to the browser over HTTPS, preventing mixed-content blocking when the
 * Xtream IPTV server serves images over plain HTTP.
 *
 * Usage:  GET /.netlify/functions/image?url=<encoded-image-url>
 *
 * Security:
 *   - Only HTTP/HTTPS URLs are accepted.
 *   - When XTREAM_SERVER_URL is set, only URLs on that same host are proxied
 *     (prevents using this as an open proxy for arbitrary hosts).
 *   - Only image/* Content-Types are forwarded.
 */

const TIMEOUT_MS = 10_000;

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

  // ── 2. Host allowlist — only proxy images from the configured IPTV server ─
  const serverUrl = process.env.XTREAM_SERVER_URL ?? '';
  if (serverUrl) {
    try {
      const allowedHost = new URL(normalizeServerUrl(serverUrl)).host;
      if (parsed.host !== allowedHost) {
        return new Response(null, { status: 403 });
      }
    } catch {
      // If XTREAM_SERVER_URL is malformed, fall through (log in production monitoring)
    }
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

    const body = await upstream.arrayBuffer();

    return new Response(body, {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeServerUrl(raw) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `http://${trimmed}`;
}
