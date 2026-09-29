/* Creates a Stripe Checkout Session for the shop basket.
   Receives only { productId, colour, size, quantity } per line from the
   browser — every line is re-validated against js/products.js here, and
   price always comes from that server-side catalogue, never the browser.

   Gated by SHOP_LIVE: unless SHOP_LIVE=true, checkout is refused with
   { error: 'shop_not_live' } so the front end can show "Checkout launching
   soon" instead of redirecting. The one exception is ?preview=1 on the
   shop page, which the front end reads and passes through as
   body.preview so the site owner can run a real low-value test order
   before flipping SHOP_LIVE on. */
const crypto = require('crypto');
const Stripe = require('stripe');
const PRODUCTS = require('../../js/products.js');

const MAX_QTY = 10;
const MAX_LINES = 50;

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

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('create-checkout-session: STRIPE_SECRET_KEY is not set');
    return json(500, { error: 'server_misconfigured' });
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

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const orderRef = generateOrderRef();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      metadata: { order_ref: orderRef },
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
            fixed_amount: { amount: 0, currency: 'gbp' },
            display_name: 'Free UK delivery',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 10 },
              maximum: { unit: 'business_day', value: 21 }
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
