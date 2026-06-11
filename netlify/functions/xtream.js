/**
 * Netlify Function — Xtream Codes API proxy (BFF)
 *
 * Accepts POST requests from the client with:
 *   { serverUrl, username, password, action, ...extraParams }
 *
 * Builds the Xtream player_api.php URL and proxies the request
 * server-side to avoid CORS issues.
 */

const ALLOWED_ACTIONS = new Set([
  'authenticate',
  'get_vod_categories',
  'get_series_categories',
  'get_vod_streams',
  'get_series',
  'get_vod_info',
  'get_series_info',
]);

const TIMEOUT_MS = 15_000;

export default async function handler(req, context) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  const { serverUrl, username, password, action, ...extras } = body ?? {};

  if (!serverUrl || !username || !password) {
    return errorResponse(400, 'serverUrl, username och password krävs.');
  }

  if (action && !ALLOWED_ACTIONS.has(action)) {
    return errorResponse(400, `Okänd action: ${action}`);
  }

  let baseUrl;
  try {
    baseUrl = new URL('/player_api.php', normalizeServerUrl(serverUrl));
  } catch {
    return errorResponse(400, 'Ogiltig server URL.');
  }

  baseUrl.searchParams.set('username', username);
  baseUrl.searchParams.set('password', password);

  if (action && action !== 'authenticate') {
    baseUrl.searchParams.set('action', action);
  }

  // Append allowed extra parameters
  const ALLOWED_EXTRAS = ['category_id', 'vod_id', 'series_id', 'stream_id'];
  for (const key of ALLOWED_EXTRAS) {
    if (extras[key] != null) {
      baseUrl.searchParams.set(key, String(extras[key]));
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(baseUrl.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'IPTVHub/1.0' },
    });

    clearTimeout(timeoutId);

    if (!upstream.ok) {
      if (upstream.status === 401 || upstream.status === 403) {
        return errorResponse(401, 'Ogiltiga inloggningsuppgifter.');
      }
      return errorResponse(502, `Leverantören svarade med status ${upstream.status}.`);
    }

    const data = await upstream.json();

    // Xtream returns user_info.auth === 0 when credentials are wrong
    if (data?.user_info?.auth === 0) {
      return errorResponse(401, 'Ogiltiga inloggningsuppgifter.');
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return errorResponse(504, 'Leverantören svarade inte i tid (timeout).');
    }

    return errorResponse(502, 'Kunde inte ansluta till leverantören.');
  }
}

function normalizeServerUrl(raw) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
