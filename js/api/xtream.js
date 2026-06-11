/**
 * Client-side API module.
 * All calls are proxied through /.netlify/functions/xtream (BFF).
 *
 * The client sends only { pin, action, ...extraParams }.
 * Xtream server credentials live exclusively in Netlify env vars — never
 * in the client or localStorage.
 */

const ENDPOINT = '/.netlify/functions/xtream';

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

// ─── Public API ───────────────────────────────────────────────────────────────
// Each function receives `pin` as a string.

export async function authenticate(pin) {
  return callBff({ pin, action: 'authenticate' });
}

export async function getVodCategories(pin) {
  return callBff({ pin, action: 'get_vod_categories' });
}

export async function getSeriesCategories(pin) {
  return callBff({ pin, action: 'get_series_categories' });
}

export async function getVodStreams(pin, categoryId = '') {
  return callBff({
    pin,
    action: 'get_vod_streams',
    ...(categoryId ? { category_id: categoryId } : {}),
  });
}

export async function getSeries(pin, categoryId = '') {
  return callBff({
    pin,
    action: 'get_series',
    ...(categoryId ? { category_id: categoryId } : {}),
  });
}

export async function getVodInfo(pin, vodId) {
  return callBff({ pin, action: 'get_vod_info', vod_id: vodId });
}

export async function getSeriesInfo(pin, seriesId) {
  return callBff({ pin, action: 'get_series_info', series_id: seriesId });
}
