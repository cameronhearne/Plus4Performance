/* Tells the dashboard whether the current cookie is a valid admin session,
   and who it belongs to. Used on page load before showing the dashboard
   instead of the login form. */
const { getSessionUser, unauthorized } = require('./_shared/admin-auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const username = getSessionUser(event);
  if (!username) return unauthorized();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  };
};
