/* Sends the "your order has shipped" email for one shop order, triggered
   from the /shop-orders admin dashboard (either automatically right after
   an order is saved as "Shipped", or via the dashboard's "Resend shipping
   email" button).

   Stripe is the source of truth for everything in the email — the browser
   only ever sends a paymentIntentId; customer email, name, items and the
   saved tracking details are all re-fetched here, never trusted from the
   client. This mirrors the no-trust-the-browser pattern already used in
   create-checkout-session.js.

   Idempotency: a PaymentIntent with metadata.shipped_email_sent === 'true'
   is never emailed again unless the caller explicitly passes
   forceResend: true (the dashboard's confirm-gated "Resend" button). The
   Resend idempotencyKey below only guards against the dashboard's own
   double-click/network-retry of a single request — it is not what
   prevents a second, separate "Shipped" save from re-sending; that's the
   metadata flag's job. */
const Stripe = require('stripe');
const { Resend } = require('resend');
const { getSessionUser, unauthorized } = require('./_shared/admin-auth');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function firstName(fullName) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Order summary rows: items, sizes, colours, quantities — no prices, this
   email is about delivery, not payment (that's the confirmation email). */
function itemsToOrderSummaryRows(items) {
  return (items || [])
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a32;color:#ffffff;font-size:14px;font-family:Arial,Helvetica,sans-serif;">
          <div style="font-weight:700;">${escapeHtml(it.name)}</div>
          <div style="color:#9a9aa2;font-size:13px;margin-top:2px;">${escapeHtml(it.colour)} &middot; ${escapeHtml(it.size)} &middot; Qty ${escapeHtml(it.qty)}</div>
        </td>
      </tr>`
    )
    .join('');
}

/* Same dark-card branding and markup style as stripe-webhook.js's
   buildCustomerHTML (order confirmation), so the two emails read as one
   family. No em dashes anywhere in the copy, per the brand's plain-English
   tone. */
function buildShippedEmailHTML({ siteUrl, firstName: fname, carrier, trackingNumber, trackingUrl, items }) {
  const trackButtonHTML = trackingUrl
    ? `
        <div style="text-align:center;margin:28px 0 4px;">
          <a href="${trackingUrl}" style="display:inline-block;background:#ffffff;color:#0a0a0c;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Track your order</a>
        </div>`
    : '';

  return `
  <div style="background:#f4f4f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#0a0a0c;border-radius:14px;overflow:hidden;">
      <div style="background:#0a0a0c;padding:32px 32px 24px;text-align:center;border-bottom:1px solid #2a2a32;">
        <img src="${siteUrl}/images/logo/p4-logo-full.png" alt="Plus 4 Performance" style="height:48px;width:auto;display:inline-block;">
      </div>
      <div style="padding:32px;">
        <h1 style="color:#ffffff;font-size:22px;margin:0 0 16px;">Your order is on its way</h1>
        <p style="color:#ffffff;font-size:15px;line-height:1.7;margin:0 0 20px;">
          Hi ${escapeHtml(fname)},<br><br>
          Your order has left production and is on its way.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
          <tbody>
            <tr>
              <td style="padding:6px 0;color:#9a9aa2;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Carrier</td>
              <td style="padding:6px 0;color:#ffffff;font-size:13px;font-family:Arial,Helvetica,sans-serif;text-align:right;">${escapeHtml(carrier)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#9a9aa2;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Tracking number</td>
              <td style="padding:6px 0;color:#ffffff;font-size:13px;font-family:Arial,Helvetica,sans-serif;text-align:right;">${escapeHtml(trackingNumber)}</td>
            </tr>
          </tbody>
        </table>
        ${trackButtonHTML}
        <p style="color:#9a9aa2;font-size:13px;line-height:1.7;margin:28px 0 0;">
          Delivery usually takes 1 to 2 weeks from dispatch.
        </p>
        <p style="color:#9a9aa2;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:28px 0 6px;">Order summary</p>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            ${itemsToOrderSummaryRows(items)}
          </tbody>
        </table>
        <p style="color:#9a9aa2;font-size:13px;line-height:1.7;margin:28px 0 0;">
          Any questions, reply to this email or contact <a href="mailto:cameron@plus4performance.com" style="color:#9a9aa2;text-decoration:underline;">cameron@plus4performance.com</a>.
        </p>
        <p style="color:#ffffff;font-size:14px;margin:24px 0 0;">Plus 4 Performance</p>
      </div>
    </div>
  </div>`;
}

function lineItemsToItems(lineItemsData) {
  return (lineItemsData || []).map((li) => {
    const product = li.price && li.price.product;
    const md = (product && typeof product === 'object' && product.metadata) || {};
    const qty = li.quantity || 1;
    return {
      name: md.name || (product && typeof product === 'object' && product.name) || 'Item',
      colour: md.colour || '',
      size: md.size || '',
      qty
    };
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const username = getSessionUser(event);
  if (!username) return unauthorized();

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('shop-orders-send-shipped-email: STRIPE_SECRET_KEY is not set');
    return json(500, { error: 'server_misconfigured' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'invalid_json' });
  }

  const paymentIntentId = typeof payload.paymentIntentId === 'string' ? payload.paymentIntentId.trim() : '';
  if (!paymentIntentId.startsWith('pi_')) {
    return json(400, { error: 'invalid_payment_intent' });
  }
  const forceResend = payload.forceResend === true;
  // Admin-only, no-side-effect preview used for local testing (see Step 3
  // of the task this shipped from) — renders the email without calling
  // Resend or writing shipped_email_sent. Never exposed in the dashboard UI.
  const dryRun = payload.dryRun === true;

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    console.error('shop-orders-send-shipped-email: payment intent retrieve failed for', paymentIntentId, err.message);
    return json(404, { error: 'order_not_found' });
  }

  const metadata = paymentIntent.metadata || {};

  if (metadata.fulfilment_status !== 'Shipped') {
    return json(400, { error: 'not_shipped' });
  }

  const carrier = metadata.tracking_carrier || '';
  const trackingNumber = metadata.tracking_number || '';
  if (!carrier || !trackingNumber) {
    return json(400, { error: 'missing_tracking_info' });
  }

  if (metadata.shipped_email_sent === 'true' && !forceResend) {
    return json(200, { skipped: true, reason: 'already_sent', shippedEmailSentAt: metadata.shipped_email_sent_at || '' });
  }

  let session;
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
    session = sessions.data[0];
  } catch (err) {
    console.error('shop-orders-send-shipped-email: session lookup failed for', paymentIntentId, err.message);
    return json(502, { error: 'stripe_error' });
  }
  if (!session) {
    return json(404, { error: 'order_not_found' });
  }

  const customerDetails = session.customer_details || {};
  const customerEmail = customerDetails.email || '';
  if (!customerEmail) {
    return json(400, { error: 'no_customer_email' });
  }

  let lineItems;
  try {
    lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ['data.price.product'] });
  } catch (err) {
    console.error('shop-orders-send-shipped-email: line items fetch failed for', session.id, err.message);
    return json(502, { error: 'stripe_error' });
  }

  const items = lineItemsToItems(lineItems.data);
  const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');
  const subject = 'Your Plus 4 order is on its way';
  const html = buildShippedEmailHTML({
    siteUrl,
    firstName: firstName(customerDetails.name),
    carrier,
    trackingNumber,
    trackingUrl: metadata.tracking_url || '',
    items
  });

  if (dryRun) {
    return json(200, { dryRun: true, to: customerEmail, subject, html });
  }

  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    console.error('shop-orders-send-shipped-email: RESEND_API_KEY or FROM_EMAIL is not set');
    return json(500, { error: 'server_misconfigured' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send(
      {
        from: process.env.FROM_EMAIL,
        to: customerEmail,
        reply_to: process.env.REPLY_TO_EMAIL,
        subject,
        html
      },
      { idempotencyKey: `${paymentIntentId}:shipped:${Date.now()}` }
    );
  } catch (err) {
    console.error('shop-orders-send-shipped-email: Resend send failed for', paymentIntentId, err.message);
    return json(502, { error: 'email_failed' });
  }

  const sentAt = new Date().toISOString();
  try {
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { shipped_email_sent: 'true', shipped_email_sent_at: sentAt }
    });
  } catch (err) {
    // The email is already away at this point; failing to record the flag
    // just risks a future duplicate (the admin can still avoid that by not
    // re-saving "Shipped"), so this is logged but not surfaced as an error.
    console.error('shop-orders-send-shipped-email: metadata update failed for', paymentIntentId, err.message);
  }

  return json(200, { sent: true, shippedEmailSentAt: sentAt });
};
