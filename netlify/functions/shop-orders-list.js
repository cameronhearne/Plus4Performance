/* Lists completed, paid shop orders for the /shop-orders admin dashboard.
   Stripe is the source of truth — no database. Fulfilment fields come back
   from the PaymentIntent's metadata (see shop-orders-update.js for writes).

   This Stripe account also takes coaching subscriptions and one-off coaching
   payments through other code paths, so every Checkout Session is filtered
   down to shop orders only, by any of (in order checked):
     1. session.metadata.source === 'shop', or payment_intent.metadata.source
        === 'shop' — the tag create-checkout-session.js sets going forward
        (checked on the PaymentIntent too so a pre-tag order can be tagged
        retroactively there, since a *completed* Checkout Session's own
        metadata can no longer be edited via the Stripe API, but its
        PaymentIntent's can).
     2. mode === 'payment' AND success_url/cancel_url point at this shop's
        pages (/order-confirmed, /shop) — the two URLs create-checkout-
        session.js has always hardcoded, tag or no tag. Available on every
        session with no expand needed, so this is the primary signal for
        pre-tag orders.
     3. mode === 'payment' AND every line item's product metadata.product_id
        matches a slug in js/products.js — last-resort fallback for the rare
        case neither signal above applies (e.g. a future URL change).

   Note: an EXPAND of 'data.line_items.data.price.product' on the *list*
   call is NOT used here — Stripe's API rejects it outright (exceeds the
   4-level expand limit on list endpoints), so there's no "fast path" to
   attempt. Line items are fetched individually, but only for sessions
   already known to be shop orders (via signal 1 or 2), so this stays one
   call per shop order rather than one call per Stripe session overall. */
const Stripe = require('stripe');
const PRODUCTS = require('../../js/products.js');
const { getSessionUser, unauthorized } = require('./_shared/admin-auth');

const PRODUCT_SLUGS = new Set(PRODUCTS.map((p) => p.slug));
const SITE_URL = (process.env.SITE_URL || 'https://plus4performance.com').replace(/\/+$/, '');
const SHOP_URL_PREFIXES = [`${SITE_URL}/order-confirmed`, `${SITE_URL}/shop`];
// autoPagingToArray's hard ceiling (Stripe SDK throws above this) — far more
// than this shop will ever need, but exceeding it crashes the whole call.
const MAX_SESSIONS = 10000;

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function formatAddress(address) {
  if (!address) return null;
  return {
    line1: address.line1 || '',
    line2: address.line2 || '',
    city: address.city || '',
    state: address.state || '',
    postalCode: address.postal_code || '',
    country: address.country || ''
  };
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
      qty,
      price: (li.amount_total || 0) / 100 / qty
    };
  });
}

function matchesShopUrls(session) {
  const urls = [session.success_url, session.cancel_url].filter(Boolean);
  return urls.some((u) => SHOP_URL_PREFIXES.some((prefix) => u.startsWith(prefix)));
}

async function isShopByLineItems(stripe, sessionId) {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ['data.price.product']
  });
  const items = lineItems.data || [];
  if (!items.length) return { match: false, items };
  const match = items.every((li) => {
    const product = li.price && li.price.product;
    const pid = product && typeof product === 'object' && product.metadata && product.metadata.product_id;
    return !!pid && PRODUCT_SLUGS.has(pid);
  });
  return { match, items };
}

function derivePaymentStatus(charge) {
  if (charge && typeof charge === 'object') {
    if (charge.refunded) return 'refunded';
    if ((charge.amount_refunded || 0) > 0) return 'partially_refunded';
  }
  return 'paid';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const username = getSessionUser(event);
  if (!username) return unauthorized();

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('shop-orders-list: STRIPE_SECRET_KEY is not set');
    return json(500, { error: 'server_misconfigured' });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let sessions;
  try {
    sessions = await stripe.checkout.sessions
      .list({ status: 'complete', limit: 100, expand: ['data.payment_intent', 'data.payment_intent.latest_charge'] })
      .autoPagingToArray({ limit: MAX_SESSIONS });
  } catch (err) {
    console.error('shop-orders-list: failed to list sessions:', err.message);
    return json(502, { error: 'stripe_error' });
  }

  const diagnostics = {
    scanned: 0,
    excludedNotPaid: 0,
    excludedNotShop: 0,
    includedByTag: 0,
    includedByUrl: 0,
    includedByLineItems: 0
  };
  const orders = [];

  for (const session of sessions) {
    diagnostics.scanned++;

    if (session.payment_status !== 'paid') {
      diagnostics.excludedNotPaid++;
      continue;
    }

    const pi = session.payment_intent;
    let piObj = pi && typeof pi === 'object' ? pi : null;
    if (!piObj && pi) {
      try {
        piObj = await stripe.paymentIntents.retrieve(pi, { expand: ['latest_charge'] });
      } catch (e) {
        console.error('shop-orders-list: payment intent retrieve failed for', pi, e.message);
      }
    }

    const byTag = !!((session.metadata && session.metadata.source === 'shop') || (piObj && piObj.metadata && piObj.metadata.source === 'shop'));
    const byUrl = !byTag && session.mode === 'payment' && matchesShopUrls(session);

    let included = byTag || byUrl;
    let lineItemsData = null;
    let reason = byTag ? 'tag' : byUrl ? 'url' : null;

    if (!included && session.mode === 'payment') {
      try {
        const check = await isShopByLineItems(stripe, session.id);
        lineItemsData = check.items;
        if (check.match) {
          included = true;
          reason = 'lineItems';
        }
      } catch (e) {
        console.error('shop-orders-list: line items check failed for', session.id, e.message);
      }
    }

    if (!included) {
      diagnostics.excludedNotShop++;
      continue;
    }
    if (reason === 'tag') diagnostics.includedByTag++;
    else if (reason === 'url') diagnostics.includedByUrl++;
    else diagnostics.includedByLineItems++;

    if (!lineItemsData) {
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ['data.price.product'] });
        lineItemsData = lineItems.data;
      } catch (e) {
        console.error('shop-orders-list: line items fetch failed for', session.id, e.message);
        lineItemsData = [];
      }
    }

    let charge = piObj && piObj.latest_charge;
    if (charge && typeof charge !== 'object' && piObj) {
      try {
        const retrieved = await stripe.paymentIntents.retrieve(piObj.id, { expand: ['latest_charge'] });
        charge = retrieved.latest_charge;
      } catch (e) {
        console.error('shop-orders-list: charge retrieve failed for', piObj.id, e.message);
      }
    }

    const metadata = (piObj && piObj.metadata) || {};
    const customerDetails = session.customer_details || {};
    const shippingAddress = (session.shipping_details && session.shipping_details.address) || customerDetails.address;
    const items = lineItemsToItems(lineItemsData);
    const total = (session.amount_total || 0) / 100;
    const delivery = ((session.shipping_cost && session.shipping_cost.amount_total) || 0) / 100;
    const subtotal = session.amount_subtotal != null ? session.amount_subtotal / 100 : total - delivery;

    orders.push({
      orderRef: (session.metadata && session.metadata.order_ref) || session.id.slice(-8).toUpperCase(),
      sessionId: session.id,
      paymentIntentId: piObj ? piObj.id : typeof pi === 'string' ? pi : null,
      createdAt: new Date(session.created * 1000).toISOString(),
      customerName: customerDetails.name || '',
      customerEmail: customerDetails.email || '',
      customerPhone: customerDetails.phone || '',
      shippingAddress: formatAddress(shippingAddress),
      items,
      subtotal,
      delivery,
      total,
      paymentStatus: derivePaymentStatus(charge),
      fulfilmentStatus: metadata.fulfilment_status || 'New',
      tapstitchOrderRef: metadata.tapstitch_order_ref || '',
      trackingNumber: metadata.tracking_number || '',
      carrier: metadata.tracking_carrier || '',
      trackingUrl: metadata.tracking_url || '',
      shippedAt: metadata.shipped_at || '',
      shippedEmailSent: metadata.shipped_email_sent === 'true',
      shippedEmailSentAt: metadata.shipped_email_sent_at || '',
      adminNotes: metadata.admin_notes || '',
      updatedBy: metadata.updated_by || '',
      updatedAt: metadata.updated_at || ''
    });
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return json(200, { orders, diagnostics: Object.assign({ included: orders.length }, diagnostics) });
};
