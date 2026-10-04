/* Carrier list + standard tracking link templates, shared by
   shop-orders-update.js (saves tracking info) and
   shop-orders-send-shipped-email.js (renders the tracking button).
   Single source of truth so the dropdown, validation and link-building
   never drift apart between the two functions. */

const CARRIERS = ['Royal Mail', 'Evri', 'DPD', 'Yodel', 'UPS', 'DHL', 'Other'];

// Best-effort standard tracking URL per carrier, only used when the admin
// leaves the Tracking URL field blank. These are the carriers' documented
// public tracking page patterns at time of writing — if a carrier changes
// its URL scheme, update the template here rather than per-order.
const TRACKING_URL_BUILDERS = {
  'Royal Mail': (ref) => `https://www.royalmail.com/track-your-item#/tracking-results/${ref}`,
  Evri: (ref) => `https://www.evri.com/track/parcel/${ref}/details`,
  DPD: (ref) => `https://track.dpd.co.uk/parcels/${ref}`,
  Yodel: (ref) => `https://www.yodel.co.uk/tracking/${ref}`,
  UPS: (ref) => `https://www.ups.com/track?loc=en_GB&tracknum=${ref}`,
  DHL: (ref) => `https://www.dhl.com/gb-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${ref}`
};

/* Builds the standard tracking link for a known carrier + tracking number.
   Returns '' for 'Other' (no standard pattern) or an unrecognised carrier,
   so the email/dashboard simply omit the link rather than guess. */
function buildTrackingUrl(carrier, trackingNumber) {
  const builder = TRACKING_URL_BUILDERS[carrier];
  if (!builder || !trackingNumber) return '';
  return builder(encodeURIComponent(trackingNumber));
}

module.exports = { CARRIERS, buildTrackingUrl };
