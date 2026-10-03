/* Shared auth helpers for the /shop-orders admin dashboard. Lives in a
   subfolder (not a top-level file) so Netlify's functions bundler does not
   turn it into its own callable endpoint — it's required by the real
   shop-orders-* functions instead.

   Session model: a signed, stateless cookie (HMAC-SHA256 over a JSON
   payload, keyed by SESSION_SECRET). No server-side session store needed.
   Login rate limiting uses Netlify Blobs purely as a small attempt counter
   (not an orders database — Stripe stays the source of truth for orders). */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COOKIE_NAME = 'p4p_admin_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64').toString('utf8');
}

function sign(payloadB64, secret) {
  return base64url(crypto.createHmac('sha256', secret).update(payloadB64).digest());
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return secret;
}

function getAdminUsers() {
  let raw;
  try {
    raw = JSON.parse(process.env.ADMIN_USERS || '{}');
  } catch (e) {
    console.error('admin-auth: ADMIN_USERS is not valid JSON');
    return {};
  }
  // Normalise keys to lowercase so login is case-insensitive on username.
  const out = {};
  for (const key of Object.keys(raw)) {
    out[key.toLowerCase()] = raw[key];
  }
  return out;
}

function createSessionToken(username) {
  const payload = { u: username, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = sign(payloadB64, getSessionSecret());
  return `${payloadB64}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  let expectedSig;
  try {
    expectedSig = sign(payloadB64, getSessionSecret());
  } catch (e) {
    return null;
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64));
  } catch (e) {
    return null;
  }

  if (!payload || typeof payload.u !== 'string' || typeof payload.exp !== 'number') return null;
  if (Date.now() > payload.exp) return null;

  return payload.u;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function getCookieHeader(event) {
  return (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
}

/* Returns the logged-in username, or null if there is no valid session.
   Every admin function must call this and return 401 when it's null. */
function getSessionUser(event) {
  const cookies = parseCookies(getCookieHeader(event));
  return verifySessionToken(cookies[COOKIE_NAME]);
}

function buildSessionCookie(username) {
  const token = createSessionToken(username);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

function buildClearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function unauthorized() {
  return {
    statusCode: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'unauthorized' })
  };
}

async function comparePassword(password, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch (e) {
    return false;
  }
}

/* Netlify Blobs is used only as a tiny, shared counter for login lockout —
   not as an orders store. If Blobs is unavailable for any reason (e.g. a
   transient platform issue), we fail OPEN on the rate limiter only (log and
   allow the attempt) rather than locking admins out of their own dashboard
   because of an unrelated outage. Password/session checks are unaffected. */
async function getAttemptsStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name: 'admin-login-attempts' });
}

async function checkLockout(username) {
  try {
    const store = await getAttemptsStore();
    const record = await store.get(username, { type: 'json' });
    if (record && record.lockUntil && record.lockUntil > Date.now()) {
      return { locked: true, retryAfterSeconds: Math.ceil((record.lockUntil - Date.now()) / 1000) };
    }
    return { locked: false };
  } catch (e) {
    console.error('admin-auth: lockout check failed, failing open', e.message);
    return { locked: false };
  }
}

async function recordFailedAttempt(username) {
  try {
    const store = await getAttemptsStore();
    const record = (await store.get(username, { type: 'json' })) || { count: 0 };
    const now = Date.now();
    // A lockout that has already expired starts a fresh count.
    const count = record.lockUntil && record.lockUntil <= now ? 1 : record.count + 1;
    const next = { count };
    if (count >= MAX_FAILED_ATTEMPTS) {
      next.lockUntil = now + LOCKOUT_MS;
    }
    await store.setJSON(username, next);
  } catch (e) {
    console.error('admin-auth: recording failed attempt failed', e.message);
  }
}

async function clearAttempts(username) {
  try {
    const store = await getAttemptsStore();
    await store.delete(username);
  } catch (e) {
    console.error('admin-auth: clearing attempts failed', e.message);
  }
}

module.exports = {
  COOKIE_NAME,
  getAdminUsers,
  getSessionUser,
  buildSessionCookie,
  buildClearCookie,
  unauthorized,
  comparePassword,
  checkLockout,
  recordFailedAttempt,
  clearAttempts
};
