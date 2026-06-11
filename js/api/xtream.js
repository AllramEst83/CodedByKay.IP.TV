/**
 * Client-side API module.
 * All calls are proxied through /.netlify/functions/xtream (BFF).
 * The client never knows or constructs Xtream API URLs.
 */

const ENDPOINT = '/.netlify/functions/xtream';

/**
 * Low-level fetch wrapper.
 * @param {object} payload
 * @returns {Promise<any>}
 * @throws {Error} with .status and .message
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

export async function authenticate(creds) {
  return callBff({ ...creds, action: 'authenticate' });
}

export async function getVodCategories(creds) {
  return callBff({ ...creds, action: 'get_vod_categories' });
}

export async function getSeriesCategories(creds) {
  return callBff({ ...creds, action: 'get_series_categories' });
}

export async function getVodStreams(creds, categoryId = '') {
  return callBff({
    ...creds,
    action: 'get_vod_streams',
    ...(categoryId ? { category_id: categoryId } : {}),
  });
}

export async function getSeries(creds, categoryId = '') {
  return callBff({
    ...creds,
    action: 'get_series',
    ...(categoryId ? { category_id: categoryId } : {}),
  });
}

export async function getVodInfo(creds, vodId) {
  return callBff({ ...creds, action: 'get_vod_info', vod_id: vodId });
}

export async function getSeriesInfo(creds, seriesId) {
  return callBff({ ...creds, action: 'get_series_info', series_id: seriesId });
}
