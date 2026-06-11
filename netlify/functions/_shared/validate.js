/**
 * Shared validation utilities for Netlify Functions.
 *
 * Environment variables:
 *   ALLOWED_PINS    — comma-separated list of valid PINs (e.g. "1234,5678")
 *   ALLOWED_ORIGINS — comma-separated list of allowed origins (e.g. "https://myapp.netlify.app")
 *                     Leave unset to allow all origins (useful during local dev).
 */

/**
 * Validates a PIN against the ALLOWED_PINS env var.
 * Returns true if no pins are configured (open/dev mode).
 *
 * @param {string|number} pin
 * @returns {boolean}
 */
export function validatePin(pin) {
  const raw = process.env.ALLOWED_PINS ?? '';
  if (!raw.trim()) return true;
  const allowed = raw.split(',').map((p) => p.trim()).filter(Boolean);
  return allowed.includes(String(pin ?? '').trim());
}

/**
 * Validates the request origin against the ALLOWED_ORIGINS env var.
 * Returns true if no origins are configured (allow all).
 *
 * @param {Request} req
 * @returns {boolean}
 */
export function validateOrigin(req) {
  const raw = process.env.ALLOWED_ORIGINS ?? '';
  if (!raw.trim()) return true;

  const allowed = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const origin =
    req.headers.get('origin') ??
    req.headers.get('referer') ??
    '';

  const normalized = origin.replace(/\/+$/, '');
  return allowed.some((o) => normalized === o || normalized.startsWith(o + '/'));
}

/**
 * Returns a 403 JSON response for origin violations.
 * @returns {Response}
 */
export function originForbiddenResponse() {
  return new Response(JSON.stringify({ error: 'Förbjudet ursprung.' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Returns a 401 JSON response for PIN violations.
 * @returns {Response}
 */
export function pinUnauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Ogiltig PIN-kod.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
