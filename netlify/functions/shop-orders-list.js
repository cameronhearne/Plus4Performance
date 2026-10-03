/* Lists completed, paid shop orders for the /shop-orders admin dashboard.
   Stripe is the source of truth — no database. Fulfilment fields come back
   from the PaymentIntent's metadata (see shop-orders-update.js for writes).

   This Stripe account also takes coaching subscriptions and one-off coaching
   payments through other code paths, so every Checkout Session is filtered
   down to shop orders only:
     - New sessions: create-checkout-session.js tags session.metadata.source
       = 'shop' going forward.
     - Older sessions created before that tag existed: treated as a shop
       order only if mode === 'payment' AND every line item's product
       metadata.product_id matches a slug in js/products.js (the shop's
       catalogue) — i.e. it could only have come from this checkout function.

   Performance: tries one bulk expand (line items + payment intent + latest
   charge) across the whole paginated list first, so the common case is one
   API call per 100 sessions rather than one call per order. Falls back to
   a per-session line-items call only if Stripe doesn't return the deep
   expansion (and even then, only for sessions that could plausibly be shop
   orders), so the dashboard stays correct even if that optimisation isn't
   available. */
const Stripe = require('stripe');
const PRODUCTS = require('../../js/products.js');
const { getSessionUser, unauthorized } = require('./_shared/admin-auth');

const PRODUCT_SLUGS = new Set(PRODUCTS.map((p) => p.slug));

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

function isShopByLineItems(lineItemsData) {
  const items = lineItemsData || [];
  if (!items.length) return false;
  return items.every((li) => {
    const product = li.price && li.price.product;
    const pid = product && typeof product === 'object' && product.metadata && product.metadata.product_id;
    return !!pid && PRODUCT_SLUGS.has(pid);
  });
}

function derivePaymentStatus(charge) {
  if (charge && typeof charge === 'object') {
    if (charge.refunded) return 'refunded';
    if ((charge.amount_refunded || 0) > 0) return 'partially_refunded';
  }
  return 'paid';
}

const LIST_PARAMS_BASE = { status: 'complete', limit: 100 };

async function fetchSessionsDeepExpand(stripe) {
  return stripe.checkout.sessions
    .list(
      Object.assign({}, LIST_PARAMS_BASE, {
        expand: ['data.line_items.data.price.product', 'data.payment_intent', 'data.payment_intent.latest_charge']
      })
    )
    .autoPagingToArray({ limit: 100000 });
}

async function fetchSessionsShallow(stripe) {
  const sessions = await stripe.checkout.sessions
    .list(Object.assign({}, LIST_PARAMS_BASE, { expand: ['data.payment_intent', 'data.payment_intent.latest_charge'] }))
    .autoPagingToArray({ limit: 100000 });

  for (const session of sessions) {
    if (session.payment_status !== 'paid') continue;
    const byTag = !!(session.metadata && session.metadata.source === 'shop');
    // Only sessions that could plausibly be a (legacy, untagged) shop order
    // need a line-items call — skips it for coaching subscriptions etc.
    if (!byTag && session.mode !== 'payment') continue;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ['data.price.product']
    });
    session.line_items = { data: lineItems.data };
  }
  return sessions;
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
  let expandMode = 'deep';
  try {
    sessions = await fetchSessionsDeepExpand(stripe);
    const expansionLooksReal = sessions.every((s) => {
      const items = s.line_items && s.line_items.data;
      if (!items || !items.length) return true;
      return items.every((li) => typeof (li.price && li.price.product) === 'object');
    });
    if (!expansionLooksReal) throw new Error('deep expand did not return product objects');
  } catch (err) {
    console.error('shop-orders-list: deep expand unavailable, falling back:', err.message);
    expandMode = 'fallback';
    sessions = await fetchSessionsShallow(stripe);
  }

  const diagnostics = { scanned: 0, excludedNotPaid: 0, excludedNotShop: 0, includedByTag: 0, includedByLegacy: 0 };
  const orders = [];

  for (const session of sessions) {
    diagnostics.scanned++;

    if (session.payment_status !== 'paid') {
      diagnostics.excludedNotPaid++;
      continue;
    }

    const byTag = !!(session.metadata && session.metadata.source === 'shop');
    const byLegacy = !byTag && session.mode === 'payment' && isShopByLineItems(session.line_items && session.line_items.data);

    if (!byTag && !byLegacy) {
      diagnostics.excludedNotShop++;
      continue;
    }
    if (byTag) diagnostics.includedByTag++;
    else diagnostics.includedByLegacy++;

    const pi = session.payment_intent;
    let piObj = pi && typeof pi === 'object' ? pi : null;
    if (!piObj && pi) {
      try {
        piObj = await stripe.paymentIntents.retrieve(pi, { expand: ['latest_charge'] });
      } catch (e) {
        console.error('shop-orders-list: payment intent retrieve failed for', pi, e.message);
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
    const items = lineItemsToItems(session.line_items && session.line_items.data);
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
      adminNotes: metadata.admin_notes || '',
      updatedBy: metadata.updated_by || '',
      updatedAt: metadata.updated_at || ''
    });
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return json(200, { orders, diagnostics: Object.assign({ expandMode, included: orders.length }, diagnostics) });
};
