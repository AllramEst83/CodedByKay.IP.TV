/**
 * Netlify Function — Xtream Codes API proxy (BFF)
 *
 * Accepts POST requests from the client with:
 *   { pin, action, ...extraParams }
 *
 * Xtream credentials (XTREAM_SERVER_URL, XTREAM_USERNAME, XTREAM_PASSWORD)
 * are read exclusively from server-side environment variables — they are
 * never exposed to or sent from the client.
 *
 * Security layers:
 *   1. Origin/domain whitelisting (ALLOWED_ORIGINS env var)
 *   2. PIN validation              (ALLOWED_PINS    env var)
 */

import {
  validatePin,
  validateOrigin,
  originForbiddenResponse,
  pinUnauthorizedResponse,
} from './_shared/validate.js';

const ALLOWED_ACTIONS = new Set([
  'authenticate',
  'get_vod_categories',
  'get_series_categories',
  'get_vod_streams',
  'get_series',
  'get_vod_info',
  'get_series_info',
]);

const TIMEOUT_MS = 30_000;

export default async function handler(req, context) {
  // ── 1. Method guard ────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  // ── 2. Origin / domain whitelist ──────────────────────────────────────────
  if (!validateOrigin(req)) {
    return originForbiddenResponse();
  }

  // ── 3. Parse body ─────────────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Ogiltig JSON-kropp.');
  }

  const { pin, action, ...extras } = body ?? {};

  // ── 4. PIN validation ─────────────────────────────────────────────────────
  if (!validatePin(pin)) {
    return pinUnauthorizedResponse();
  }

  // ── 5. Load credentials from environment (never from client) ─────────────
  const serverUrl = process.env.XTREAM_SERVER_URL ?? '';
  const username  = process.env.XTREAM_USERNAME   ?? '';
  const password  = process.env.XTREAM_PASSWORD   ?? '';

  if (!serverUrl || !username || !password) {
    return errorResponse(500, 'Serverinställningar saknas. Kontakta administratören.');
  }

  if (action && !ALLOWED_ACTIONS.has(action)) {
    return errorResponse(400, `Okänd action: ${action}`);
  }

  // ── 6. Build Xtream URL ───────────────────────────────────────────────────
  let baseUrl;
  try {
    baseUrl = new URL('/player_api.php', normalizeServerUrl(serverUrl));
  } catch {
    return errorResponse(500, 'Ogiltig server URL i miljökonfigurationen.');
  }

  baseUrl.searchParams.set('username', username);
  baseUrl.searchParams.set('password', password);

  if (action && action !== 'authenticate') {
    baseUrl.searchParams.set('action', action);
  }

  const ALLOWED_EXTRAS = ['category_id', 'vod_id', 'series_id', 'stream_id'];
  for (const key of ALLOWED_EXTRAS) {
    if (extras[key] != null) {
      baseUrl.searchParams.set(key, String(extras[key]));
    }
  }

  // ── 7. Proxy request ──────────────────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(baseUrl.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'IPTVHub/1.0' },
    });

    clearTimeout(timeoutId);

    if (!upstream.ok) {
      if (upstream.status === 401 || upstream.status === 403) {
        return errorResponse(401, 'Ogiltiga inloggningsuppgifter på servern.');
      }
      return errorResponse(502, `Leverantören svarade med status ${upstream.status}.`);
    }

    if (action === 'authenticate') {
      const data = await upstream.json();
      if (data?.user_info?.auth === 0) {
        return errorResponse(401, 'Ogiltiga inloggningsuppgifter på servern.');
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return errorResponse(504, 'Leverantören svarade inte i tid (timeout).');
    }

    return errorResponse(502, 'Kunde inte ansluta till leverantören.');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeServerUrl(raw) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `http://${trimmed}`;
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
