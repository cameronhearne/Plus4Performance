/* Stripe webhook for the shop. Verifies the signature against the raw
   body, then on a paid checkout.session.completed sends:
     a) an order alert to every ORDER_ALERT_EMAILS address
     b) a branded confirmation to the customer
   via Resend, using the session id as the base of the idempotency key
   (per email type) so a retried webhook delivery never double-sends. */
const Stripe = require('stripe');
const { Resend } = require('resend');

function formatMoney(n) {
  return `£${Number(n).toFixed(2)}`;
}

function formatAddress(address) {
  if (!address) return '';
  return [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
    .filter(Boolean)
    .join(', ');
}

function buildAlertText({ orderRef, orderDate, customerName, customerEmail, customerPhone, addressText, items, total }) {
  const itemLines = items
    .map((it) => `- ${it.name} / ${it.colour} / ${it.size} x${it.qty} - ${formatMoney(it.price * it.qty)}`)
    .join('\n');

  return [
    `Order #${orderRef}`,
    `Date: ${orderDate}`,
    '',
    `Customer: ${customerName || 'n/a'}`,
    `Email: ${customerEmail || 'n/a'}`,
    `Phone: ${customerPhone || 'n/a'}`,
    `Shipping address: ${addressText || 'n/a'}`,
    '',
    'Items:',
    itemLines,
    '',
    `Total paid: ${formatMoney(total)}`,
    '',
    'Place this on Tapstitch today (Special Line)'
  ].join('\n');
}

function buildCustomerHTML({ siteUrl, orderRef, items, total, addressText }) {
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #2a2a32;color:#ffffff;font-size:14px;font-family:Arial,Helvetica,sans-serif;">
          <div style="font-weight:700;">${it.name}</div>
          <div style="color:#9a9aa2;font-size:13px;margin-top:2px;">${it.colour} &middot; ${it.size} &middot; Qty ${it.qty}</div>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid #2a2a32;color:#ffffff;font-size:14px;font-family:Arial,Helvetica,sans-serif;text-align:right;white-space:nowrap;">
          ${formatMoney(it.price * it.qty)}
        </td>
      </tr>`
    )
    .join('');

  return `
  <div style="background:#f4f4f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#0a0a0c;border-radius:14px;overflow:hidden;">
      <div style="background:#0a0a0c;padding:32px 32px 24px;text-align:center;border-bottom:1px solid #2a2a32;">
        <img src="${siteUrl}/images/logo/p4-logo-full.png" alt="Plus 4 Performance" style="height:48px;width:auto;display:inline-block;">
      </div>
      <div style="padding:32px;">
        <h1 style="color:#ffffff;font-size:22px;margin:0 0 8px;">Order confirmed</h1>
        <p style="color:#9a9aa2;font-size:14px;margin:0 0 24px;">Order reference <strong style="color:#ffffff;">#${orderRef}</strong></p>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            ${rows}
            <tr>
              <td style="padding:18px 0 0;color:#ffffff;font-size:16px;font-weight:800;">Total</td>
              <td style="padding:18px 0 0;color:#ffffff;font-size:16px;font-weight:800;text-align:right;">${formatMoney(total)}</td>
            </tr>
          </tbody>
        </table>
        <p style="color:#9a9aa2;font-size:13px;line-height:1.6;margin:28px 0 0;">
          Shipping to<br>${addressText || ''}
        </p>
        <p style="color:#ffffff;font-size:14px;line-height:1.7;margin:24px 0 0;">
          Made to order. Usually arrives in 2 to 3 weeks.
        </p>
        <p style="color:#9a9aa2;font-size:13px;line-height:1.7;margin:24px 0 0;">
          Reply to this email with any questions.
        </p>
      </div>
    </div>
  </div>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('stripe-webhook: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set');
    return { statusCode: 500, body: 'server misconfigured' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'ignored' };
  }

  const session = stripeEvent.data.object;

  if (session.payment_status !== 'paid') {
    return { statusCode: 200, body: 'not paid yet' };
  }

  let lineItems;
  try {
    lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ['data.price.product']
    });
  } catch (err) {
    console.error('stripe-webhook: failed to fetch line items for', session.id, err.message);
    return { statusCode: 500, body: 'line item fetch failed' };
  }

  const items = lineItems.data.map((li) => {
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
  // derived from the session id, so it's the exact same ref the customer
  // already saw on the Stripe payment description and order-confirmed page.
  const orderRef = (session.metadata && session.metadata.order_ref) || session.id.slice(-8).toUpperCase();
  const customerDetails = session.customer_details || {};
  const customerName = customerDetails.name || '';
  const customerEmail = customerDetails.email || '';
  const customerPhone = customerDetails.phone || '';
  const shippingAddress = (session.shipping_details && session.shipping_details.address) || customerDetails.address;
  const addressText = formatAddress(shippingAddress);
  const orderDate = new Date(session.created * 1000).toLocaleString('en-GB', { timeZone: 'Europe/London' });
  const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.FROM_EMAIL;
  const alertEmails = (process.env.ORDER_ALERT_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    if (alertEmails.length) {
      await resend.emails.send(
        {
          from: fromEmail,
          to: alertEmails,
          subject: `NEW ORDER #${orderRef} - ${formatMoney(total)}`,
          text: buildAlertText({ orderRef, orderDate, customerName, customerEmail, customerPhone, addressText, items, total })
        },
        { idempotencyKey: `${session.id}:alert` }
      );
    }
  } catch (err) {
    console.error('stripe-webhook: order alert email failed for', session.id, err.message);
    return { statusCode: 500, body: 'alert email failed' };
  }

  try {
    if (customerEmail) {
      await resend.emails.send(
        {
          from: fromEmail,
          to: customerEmail,
          reply_to: process.env.REPLY_TO_EMAIL,
          subject: `Order confirmed - #${orderRef}`,
          html: buildCustomerHTML({ siteUrl, orderRef, items, total, addressText })
        },
        { idempotencyKey: `${session.id}:customer` }
      );
    }
  } catch (err) {
    console.error('stripe-webhook: customer confirmation email failed for', session.id, err.message);
    return { statusCode: 500, body: 'customer email failed' };
  }

  return { statusCode: 200, body: 'ok' };
};
