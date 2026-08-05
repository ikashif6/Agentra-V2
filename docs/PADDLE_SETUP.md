# Paddle Billing setup (sandbox → live)

Agentra uses **Paddle Billing** as Merchant of Record. Checkout runs via Paddle.js; plan status is updated by webhooks.

## Sandbox (do this first)

1. Open [Paddle Sandbox](https://sandbox-vendors.paddle.com/) (or switch your vendor account to Sandbox).
2. Create product **Agentra Pro**.
3. Create two recurring prices:
   - **Monthly** — USD **$100** / month
   - **Yearly** — USD **$1,080** / year (= $90/mo, 10% off $1,200)
4. Developer tools → copy:
   - **Client-side token** → `PADDLE_CLIENT_TOKEN`
   - **API key** → `PADDLE_API_KEY`
5. Notifications → add destination:
   - URL: `https://api.agentraa.com/api/v1/webhooks/paddle`  
     (local: tunnel → `https://<tunnel>/api/v1/webhooks/paddle`)
   - Events: `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`, `transaction.completed`, `transaction.payment_failed`
   - Copy **endpoint secret** → `PADDLE_WEBHOOK_SECRET`
6. Set price IDs:
   - `PADDLE_PRICE_MONTHLY=pri_...`
   - `PADDLE_PRICE_YEARLY=pri_...`
7. Set `PADDLE_ENV=sandbox`.

## Live

Repeat product/prices in **Live**, then set `PADDLE_ENV=live` and swap all `PADDLE_*` values. Do not mix sandbox tokens with live prices.

## App behaviour

- Signup starts a **14-day Pro trial** (no card).
- Owner opens **Settings → Plan & billing** → Subscribe → Paddle Checkout.
- Cancel / Keep plan call the Paddle Subscriptions API; webhooks remain source of truth for status.
