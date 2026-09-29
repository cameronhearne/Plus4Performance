# Shop Setup

The shop (basket + Stripe Checkout + order emails) runs on Netlify
Functions. Stripe is in **LIVE mode only** — there is no test mode, so
be deliberate when testing.

## 1. Environment variables

Set these in Netlify: **Site configuration → Environment variables**.
See `.env.example` for the full list with placeholder values. In short:

| Variable | Where it comes from |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys (LIVE secret key, `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Created in step 2 below (`whsec_...`) |
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `FROM_EMAIL` | A verified sending address on your Resend domain |
| `REPLY_TO_EMAIL` | A real inbox you want customer replies to land in |
| `ORDER_ALERT_EMAILS` | Comma-separated addresses that get the "new order" alert |
| `SITE_URL` | `https://plus4performance.com` (no trailing slash) |
| `SHOP_LIVE` | `false` until you're ready to take real orders (see step 4) |

For local testing with `netlify dev`, copy `.env.example` to `.env` at the
project root and fill in real values there — `.env` is already in
`.gitignore` so it never gets committed.

## 2. Create the LIVE webhook endpoint

1. In the Stripe dashboard, make sure you're in **Live mode** (top left).
2. Go to Developers → Webhooks → Add endpoint.
3. Endpoint URL: `https://plus4performance.com/.netlify/functions/stripe-webhook`
   (swap in your real `SITE_URL` if different).
4. Select event: `checkout.session.completed`.
5. Create the endpoint, then click into it and reveal the **Signing
   secret** (`whsec_...`).
6. Put that value in Netlify's `STRIPE_WEBHOOK_SECRET` environment
   variable and redeploy.

## 3. Run a real test order

Because this Stripe account has no test mode, testing means placing a
real, low-value order with a real card.

1. Deploy with `SHOP_LIVE` set to anything other than `true` (e.g. `false`).
2. Visit `https://plus4performance.com/shop?preview=1` — the `?preview=1`
   flag lets checkout run even while `SHOP_LIVE` is off, just for you.
3. Add a cheap item to the basket and check out with a real card.
4. Confirm:
   - You land on `/order-confirmed` with the right order summary.
   - The order alert email arrives at every `ORDER_ALERT_EMAILS` address.
   - The branded confirmation email arrives at the email you checked out
     with.
5. In the Stripe dashboard (Live mode), find the payment and **refund it**
   (Payments → find the charge → Refund).

Without `?preview=1`, `/shop` shows "Checkout launching soon" instead of
redirecting to Stripe, so the site stays safe to browse publicly while
you're still testing.

## 4. Go live

Once the test order and both emails look right:

1. Set `SHOP_LIVE=true` in Netlify's environment variables.
2. Redeploy.

Checkout now works for every visitor, not just `?preview=1`.
