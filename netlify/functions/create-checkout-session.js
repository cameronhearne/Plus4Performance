/* Creates a Stripe Checkout Session for the shop basket.
   Receives only { productId, colour, size, quantity } per line from the
   browser — every line is re-validated against js/products.js here, and
   price always comes from that server-side catalogue, never the browser.
   Delivery is likewise computed here from the validated basket (see
   calculateDelivery below) and never trusts a browser-supplied amount.

   Gated by SHOP_LIVE: unless SHOP_LIVE=true, checkout is refused with
   { error: 'shop_not_live' } so the front end can show "Checkout launching
   soon" instead of redirecting. The one exception is ?preview=1 on the
   shop page, which the front end reads and passes through as
   body.preview so the site owner can run a real low-value test order
   before flipping SHOP_LIVE on. */
const crypto = require('crypto');
const Stripe = require('stripe');
const PRODUCTS = require('../../js/products.js');
const { checkAndRecordRateLimit } = require('./_shared/rate-limit');

const MAX_QTY = 10;
const MAX_LINES = 20;
const MAX_TOTAL_QTY = 20;
const MAX_BODY_BYTES = 20 * 1024; // basket payloads are small; this is generous
const RATE_LIMIT = { storeName: 'checkout-rate-limit', maxAttempts: 10, windowMs: 10 * 60 * 1000 };

// Delivery rules — mirrored (not shared) in js/basket.js for the client-side
// display hint, which is cosmetic only. This copy is the one that's charged.
const FREE_DELIVERY_THRESHOLD = 50;
const SINGLE_TEE_DELIVERY = 2.99;
const STANDARD_DELIVERY = 3.99;

/* items: [{ price, qty, isTee }], built from the server-validated basket
   below — never from anything the browser sent directly. */
function calculateDelivery(items) {
  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  const totalQty = items.reduce((sum, it) => sum + it.qty, 0);
  if (items.length === 1 && totalQty === 1 && items[0].isTee) return SINGLE_TEE_DELIVERY;
  return STANDARD_DELIVERY;
}

// Excludes 0/O and 1/I so a customer or staff member reading it back
// off an email or a screen can't confuse characters.
const ORDER_REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOrderRef() {
  const bytes = crypto.randomBytes(8);
  let ref = '';
  for (let i = 0; i < 8; i++) {
    ref += ORDER_REF_CHARS[bytes[i] % ORDER_REF_CHARS.length];
  }
  return ref;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const rateLimit = await checkAndRecordRateLimit(event, RATE_LIMIT);
  if (rateLimit.limited) {
    return json(429, { error: 'too_many_requests', retryAfterSeconds: rateLimit.retryAfterSeconds });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('create-checkout-session: STRIPE_SECRET_KEY is not set');
    return json(500, { error: 'server_misconfigured' });
  }

  const bodyBytes = Buffer.byteLength(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
  if (bodyBytes > MAX_BODY_BYTES) {
    return json(413, { error: 'payload_too_large' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'invalid_json' });
  }

  const live = process.env.SHOP_LIVE === 'true';
  if (!live && payload.preview !== true) {
    return json(403, { error: 'shop_not_live' });
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (!rawItems.length) {
    return json(400, { error: 'empty_basket' });
  }
  if (rawItems.length > MAX_LINES) {
    return json(400, { error: 'too_many_lines' });
  }

  const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');
  if (!siteUrl) {
    console.error('create-checkout-session: SITE_URL is not set');
    return json(500, { error: 'server_misconfigured' });
  }

  const lineItems = [];
  const deliveryItems = [];
  for (const raw of rawItems) {
    const productId = raw && raw.productId;
    const colour = raw && raw.colour;
    const size = raw && raw.size;
    const quantity = raw && Number(raw.quantity);

    if (!productId || !colour || !size || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      return json(400, { error: 'invalid_line' });
    }

    const product = PRODUCTS.find((p) => p.slug === productId);
    if (!product || product.price === null || product.price === undefined) {
      return json(400, { error: 'invalid_product' });
    }

    const colourObj = product.colours.find((c) => c.name === colour);
    if (!colourObj) {
      return json(400, { error: 'invalid_colour' });
    }

    if (product.sizes.indexOf(size) === -1) {
      return json(400, { error: 'invalid_size' });
    }

    const image = colourObj.images && colourObj.images[0];

    deliveryItems.push({ price: product.price, qty: quantity, isTee: !!product.isTee });

    lineItems.push({
      quantity,
      price_data: {
        currency: 'gbp',
        unit_amount: Math.round(product.price * 100),
        product_data: {
          name: `${product.name} (${colour} / ${size})`,
          images: image ? [`${siteUrl}${image}`] : undefined,
          metadata: {
            product_id: product.slug,
            name: product.name,
            colour,
            size
          }
        }
      }
    });
  }

  const totalQty = deliveryItems.reduce((sum, it) => sum + it.qty, 0);
  if (totalQty > MAX_TOTAL_QTY) {
    return json(400, { error: 'too_many_items' });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const orderRef = generateOrderRef();
  const deliveryAmount = calculateDelivery(deliveryItems);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      // 'source: shop' lets the admin orders dashboard (netlify/functions/
      // shop-orders-list.js) tell these sessions apart from coaching
      // subscriptions/payments in the same Stripe account.
      metadata: { order_ref: orderRef, source: 'shop' },
      payment_intent_data: {
        description: `Order #${orderRef}`,
        metadata: { order_ref: orderRef }
      },
      shipping_address_collection: { allowed_countries: ['GB'] },
      phone_number_collection: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: Math.round(deliveryAmount * 100), currency: 'gbp' },
            display_name: deliveryAmount === 0 ? 'Free UK Delivery' : 'Standard UK Delivery',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 17 }
            }
          }
        }
      ],
      success_url: `${siteUrl}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/shop`
    });

    return json(200, { url: session.url });
  } catch (err) {
    console.error('create-checkout-session: Stripe error', err.message);
    return json(500, { error: 'stripe_error' });
  }
};
