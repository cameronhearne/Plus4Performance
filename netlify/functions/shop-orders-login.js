/* Login for the private /shop-orders admin dashboard. Checks the submitted
   username/password against ADMIN_USERS (bcrypt hashes in an env var — no
   database), rate-limits repeated failures, and on success sets a signed,
   httpOnly, Secure, SameSite=Strict session cookie good for 7 days. */
const { getAdminUsers, comparePassword, buildSessionCookie, checkLockout, recordFailedAttempt, clearAttempts } = require('./_shared/admin-auth');

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {}),
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.SESSION_SECRET || !process.env.ADMIN_USERS) {
    console.error('shop-orders-login: SESSION_SECRET or ADMIN_USERS is not set');
    return json(500, { error: 'server_misconfigured' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'invalid_json' });
  }

  const username = typeof payload.username === 'string' ? payload.username.trim().toLowerCase() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!username || !password) {
    return json(400, { error: 'missing_credentials' });
  }

  const lockout = await checkLockout(event, username);
  if (lockout.locked) {
    return json(429, { error: 'locked_out', retryAfterSeconds: lockout.retryAfterSeconds });
  }

  const users = getAdminUsers();
  const hash = users[username];
  const ok = await comparePassword(password, hash);

  if (!ok) {
    await recordFailedAttempt(event, username);
    return json(401, { error: 'invalid_credentials' });
  }

  await clearAttempts(event, username);

  return json(200, { username }, { 'Set-Cookie': buildSessionCookie(username) });
};
