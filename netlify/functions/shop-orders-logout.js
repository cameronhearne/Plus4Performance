/* Clears the admin session cookie. Does not require a valid session —
   logging out when already logged out (or with an expired cookie) is a
   no-op and should still succeed. */
const { buildClearCookie } = require('./_shared/admin-auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': buildClearCookie() },
    body: JSON.stringify({ ok: true })
  };
};
