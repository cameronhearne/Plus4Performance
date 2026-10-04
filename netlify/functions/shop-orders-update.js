/* Writes fulfilment fields onto a PaymentIntent's metadata — the only
   persistent store for admin edits (Stripe is the source of truth, so
   there's no separate orders database to keep in sync). Read-only for
   money: this never touches charges, refunds, or payment_intent amounts. */
const Stripe = require('stripe');
const { getSessionUser, unauthorized } = require('./_shared/admin-auth');
const { CARRIERS, buildTrackingUrl } = require('./_shared/tracking');

const FULFILMENT_STATUSES = ['New', 'Placed on Tapstitch', 'Shipped', 'Delivered', 'Cancelled'];
const MAX_NOTES_LENGTH = 500;
const MAX_FIELD_LENGTH = 200;
const MAX_URL_LENGTH = 500;
const URL_PATTERN = /^https?:\/\/.+/i;

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const username = getSessionUser(event);
  if (!username) return unauthorized();

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('shop-orders-update: STRIPE_SECRET_KEY is not set');
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

  const fulfilmentStatus = typeof payload.fulfilmentStatus === 'string' ? payload.fulfilmentStatus : '';
  if (!FULFILMENT_STATUSES.includes(fulfilmentStatus)) {
    return json(400, { error: 'invalid_fulfilment_status' });
  }

  const tapstitchOrderRef = typeof payload.tapstitchOrderRef === 'string' ? payload.tapstitchOrderRef.trim() : '';
  const trackingNumber = typeof payload.trackingNumber === 'string' ? payload.trackingNumber.trim() : '';
  const adminNotes = typeof payload.adminNotes === 'string' ? payload.adminNotes.trim() : '';
  const carrier = typeof payload.carrier === 'string' ? payload.carrier.trim() : '';
  const trackingUrlInput = typeof payload.trackingUrl === 'string' ? payload.trackingUrl.trim() : '';

  if (tapstitchOrderRef.length > MAX_FIELD_LENGTH || trackingNumber.length > MAX_FIELD_LENGTH) {
    return json(400, { error: 'field_too_long' });
  }
  if (adminNotes.length > MAX_NOTES_LENGTH) {
    return json(400, { error: 'notes_too_long' });
  }
  if (carrier && !CARRIERS.includes(carrier)) {
    return json(400, { error: 'invalid_carrier' });
  }
  if (trackingUrlInput) {
    if (trackingUrlInput.length > MAX_URL_LENGTH || !URL_PATTERN.test(trackingUrlInput)) {
      return json(400, { error: 'invalid_tracking_url' });
    }
  }

  // Marking an order Shipped without a carrier/tracking number leaves the
  // customer with no way to follow their parcel — require both up front
  // rather than letting the shipped email go out blank.
  if (fulfilmentStatus === 'Shipped' && (!carrier || !trackingNumber)) {
    return json(400, { error: 'missing_tracking_info' });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const updatedAt = new Date().toISOString();

  // Only blank when the carrier is 'Other' (no standard pattern) or no
  // carrier/tracking number is set yet — never guessed for a status other
  // than Shipped, since the field only becomes meaningful at that point.
  const trackingUrl = trackingUrlInput || buildTrackingUrl(carrier, trackingNumber);

  try {
    // Retrieved first (rather than blind-written) purely to read the
    // existing shipped_at / shipped_email_sent flags so this save can
    // decide whether to set a *new* ship date and so the response can tell
    // the dashboard whether a shipped email has already gone out — Stripe
    // merges metadata by key, so omitting a key here never erases it.
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId);
    const existingMeta = existing.metadata || {};
    const shippedAt = fulfilmentStatus === 'Shipped' ? (existingMeta.shipped_at || updatedAt) : existingMeta.shipped_at || '';

    const metadataUpdate = {
      // Only ever reached for an order shop-orders-list.js already
      // classified as a shop order, so this is a safe, authoritative
      // permanent tag — belt-and-suspenders for any pre-tag order that
      // only matched via a weaker signal (URL/line-items) at list time.
      source: 'shop',
      fulfilment_status: fulfilmentStatus,
      tapstitch_order_ref: tapstitchOrderRef,
      tracking_number: trackingNumber,
      tracking_carrier: carrier,
      tracking_url: trackingUrl,
      admin_notes: adminNotes,
      updated_by: username,
      updated_at: updatedAt
    };
    if (shippedAt) metadataUpdate.shipped_at = shippedAt;

    const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, { metadata: metadataUpdate });

    return json(200, {
      paymentIntentId: paymentIntent.id,
      fulfilmentStatus,
      tapstitchOrderRef,
      trackingNumber,
      carrier,
      trackingUrl,
      adminNotes,
      shippedAt,
      shippedEmailSent: existingMeta.shipped_email_sent === 'true',
      updatedBy: username,
      updatedAt
    });
  } catch (err) {
    console.error('shop-orders-update: Stripe error for', paymentIntentId, err.message);
    return json(502, { error: 'stripe_error' });
  }
};
