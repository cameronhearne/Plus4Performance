/* Returns only safe, display-only fields for a completed Checkout Session,
   for the /order-confirmed page. Never returns email, phone, or address. */
const Stripe = require('stripe');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('get-session: STRIPE_SECRET_KEY is not set');
    return json(500, { error: 'server_misconfigured' });
  }

  const sessionId = (event.queryStringParameters || {}).session_id;
  if (!sessionId || sessionId.indexOf('cs_') !== 0) {
    return json(400, { error: 'missing_session_id' });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product']
    });
  } catch (err) {
    console.error('get-session: retrieve failed', err.message);
    return json(404, { error: 'not_found' });
  }

  if (session.payment_status !== 'paid') {
    return json(409, { error: 'not_paid' });
  }

  const fullName = (session.customer_details && session.customer_details.name) || '';
  const firstName = fullName.trim().split(/\s+/)[0] || '';

  const items = ((session.line_items && session.line_items.data) || []).map((li) => {
    const product = li.price && li.price.product;
    const md = (product && product.metadata) || {};
    const qty = li.quantity || 1;
    return {
      name: md.name || (product && product.name) || 'Item',
      colour: md.colour || '',
      size: md.size || '',
      qty,
      price: (li.amount_total || 0) / 100 / qty
    };
  });

  const total = (session.amount_total || 0) / 100;
  // Fixed random ref set at creation (create-checkout-session.js), not
  // derived from the session id, so it's short and stable everywhere
  // it's shown. Falls back to the old derivation only for a session
  // created before this existed.
  const orderRef = (session.metadata && session.metadata.order_ref) || session.id.slice(-8).toUpperCase();

  return json(200, { firstName, items, total, orderRef });
};
