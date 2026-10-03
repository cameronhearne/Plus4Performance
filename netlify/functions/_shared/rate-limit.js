/* Generic per-key rate limiter on Netlify Blobs, for classic exports.handler
   functions (hence connectLambda — see _shared/admin-auth.js for why).
   One blob per request, counted over a trailing sliding window, rather than
   a single counter key that's read-then-written — avoids the lost-update
   race a shared key has under Blobs' eventual consistency (see admin-auth.js
   for the full explanation). Fails OPEN if Blobs is unavailable: a rate
   limiter that occasionally under-counts during a platform hiccup is far
   better than one that can accidentally block all checkouts. */
function getClientIp(event) {
  const headers = event.headers || {};
  const nfIp = headers['x-nf-client-connection-ip'] || headers['X-Nf-Client-Connection-Ip'];
  if (nfIp) return nfIp;
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

async function getRateLimitStore(event, storeName) {
  const { connectLambda, getStore } = require('@netlify/blobs');
  connectLambda(event);
  return getStore({ name: storeName });
}

/* Returns { limited, retryAfterSeconds } and, as a side effect, records this
   attempt — so every call both checks and counts in one round trip. */
async function checkAndRecordRateLimit(event, { storeName, maxAttempts, windowMs }) {
  const ip = getClientIp(event);
  try {
    const store = await getRateLimitStore(event, storeName);
    const { blobs } = await store.list({ prefix: `${ip}/` });
    const cutoff = Date.now() - windowMs;
    const recent = blobs
      .map((b) => Number(b.key.slice(ip.length + 1).split('-')[0]))
      .filter((ts) => Number.isFinite(ts) && ts > cutoff)
      .sort((a, b) => a - b);

    if (recent.length >= maxAttempts) {
      return { limited: true, retryAfterSeconds: Math.ceil((recent[0] + windowMs - Date.now()) / 1000) };
    }

    const key = `${ip}/${Date.now()}-${require('crypto').randomBytes(4).toString('hex')}`;
    await store.setJSON(key, { ts: Date.now() });
    return { limited: false };
  } catch (e) {
    console.error(`rate-limit (${storeName}): check failed, failing open`, e.message);
    return { limited: false };
  }
}

module.exports = { checkAndRecordRateLimit, getClientIp };
