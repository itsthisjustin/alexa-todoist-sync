# Stripe Integration Setup Guide

This guide walks you through setting up Stripe payments for the tiered pricing model.

## Overview

The app uses Stripe Checkout for upgrades with three tiers:
- **Free**: $0/month - 1hr Alexa sync, 24hr Todoist sync
- **Fast**: $1.99/month - 30min Alexa sync, 1hr Todoist sync
- **Faster**: $5/month - 5min Alexa sync, 5min Todoist sync

## Step 1: Create a Stripe Account

1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete account verification
3. Switch to **Test Mode** for development (toggle in top right)

## Step 2: Create Products and Prices

### Create "Fast" Product ($1.99/month)

1. In Stripe Dashboard, go to **Products** → **Add product**
2. Fill in:
   - **Name**: Fast Plan
   - **Description**: 30-minute Alexa syncs, hourly Todoist syncs
   - **Pricing model**: Standard pricing
   - **Price**: $1.99 USD
   - **Billing period**: Monthly
   - **Payment type**: Recurring
3. Click **Save product**
4. Copy the **Price ID** (starts with `price_...`)

### Create "Faster" Product ($5/month)

1. In Stripe Dashboard, go to **Products** → **Add product**
2. Fill in:
   - **Name**: Faster Plan
   - **Description**: 5-minute syncs for both Alexa and Todoist
   - **Pricing model**: Standard pricing
   - **Price**: $5.00 USD
   - **Billing period**: Monthly
   - **Payment type**: Recurring
3. Click **Save product**
4. Copy the **Price ID** (starts with `price_...`)

## Step 3: Update Price IDs in Code

Edit `cloudflare/shared/pricing.ts` and replace the placeholder price IDs:

```typescript
fast: {
  // ...
  stripePriceId: 'price_XXXXXXXXX', // Replace with your Fast plan Price ID
},
faster: {
  // ...
  stripePriceId: 'price_XXXXXXXXX', // Replace with your Faster plan Price ID
},
```

## Step 4: Get API Keys

### Get Secret Key

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Copy the **Secret key** (starts with `sk_test_...` in test mode)
3. Store it securely - you'll add it to Cloudflare in the next step

### Get Webhook Signing Secret

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Fill in:
   - **Endpoint URL**: `https://your-worker.workers.dev/api/stripe/webhook`
   - **Events to send**: Select:
     - `checkout.session.completed`
     - `customer.subscription.deleted`
4. Click **Add endpoint**
5. Copy the **Signing secret** (starts with `whsec_...`)

## Step 5: Add Secrets to Cloudflare

Run these commands to add your Stripe keys to Cloudflare Workers:

```bash
# Add Stripe secret key
wrangler secret put STRIPE_SECRET_KEY
# Paste your sk_test_... or sk_live_... key when prompted

# Add webhook signing secret
wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste your whsec_... key when prompted
```

## Step 6: Test the Integration

### Test Mode

1. Deploy your worker: `wrangler deploy`
2. Sign up for a new account in your app
3. Click "Upgrade" on the Fast or Faster tier
4. Use Stripe's test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
5. Complete checkout
6. Verify your subscription tier updated in the app

### Check Webhook Logs

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click on your endpoint
3. Check the **Events** tab to see if webhooks are being received
4. Check your Cloudflare Worker logs: `wrangler tail`

## Step 7: Go Live

### Switch to Production

1. In Stripe Dashboard, toggle from **Test mode** to **Live mode**
2. Create the same products and prices in live mode
3. Get new **live** API keys (`sk_live_...`)
4. Create a new webhook endpoint for your production URL
5. Update secrets in Cloudflare:

```bash
wrangler secret put STRIPE_SECRET_KEY
# Paste your sk_live_... key

wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste your whsec_... key from live webhook
```

6. Update price IDs in `pricing.ts` with live price IDs
7. Deploy: `wrangler deploy`

## Webhook Events Handled

The app handles these Stripe webhook events:

### `checkout.session.completed`
- Triggered when a user successfully completes payment
- Updates user's `subscriptionTier` to 'fast' or 'faster'
- Automatically adjusts sync intervals to match the new tier

### `customer.subscription.deleted`
- Triggered when a subscription is cancelled
- Downgrades user back to 'free' tier
- Resets sync intervals to free tier limits (60min/1440min)

## Customer Portal (Optional)

To allow users to manage their subscriptions (cancel, update payment method):

1. In Stripe Dashboard, go to **Settings** → **Billing** → **Customer portal**
2. Enable the portal and configure allowed actions
3. Add a "Manage subscription" link in your app that redirects to:
   ```
   https://billing.stripe.com/p/login/...
   ```

## Testing Webhooks Locally

For local development, use the Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to your local worker
stripe listen --forward-to http://localhost:8787/api/stripe/webhook

# This will output a webhook signing secret (whsec_...)
# Use this for local development
```

## Troubleshooting

### Webhook not working
- Check the endpoint URL is correct
- Verify webhook secret matches
- Check Cloudflare Worker logs: `wrangler tail`
- Look at webhook attempts in Stripe Dashboard

### Checkout not redirecting
- Ensure success_url and cancel_url are correct
- Check browser console for errors
- Verify API_URL is set correctly in frontend

### Subscription not updating
- Check webhook events in Stripe Dashboard
- Verify metadata is being passed correctly (userId, tier)
- Check Cloudflare Worker logs for errors

## Cost Estimates

With the new pricing tiers:

### Per-User Costs (Cloudflare Browser Hours)

| Tier | Alexa Syncs/mo | Todoist Syncs/mo | Browser Hours | Cost/user |
|------|----------------|------------------|---------------|-----------|
| Free | 720 (1hr) | 30 (24hr) | ~2.1h | $0.09 |
| Fast | 1,440 (30min) | 720 (1hr) | ~6.0h | $0.27 |
| Faster | 8,640 (5min) | 8,640 (5min) | ~48h | $2.16 |

*Assumes 10 seconds per sync*

### Revenue Projections (1,000 users)

| Distribution | Free | Fast | Faster | Revenue | Costs | Profit |
|--------------|------|------|--------|---------|-------|--------|
| Conservative | 700 | 250 | 50 | $750 | $171 | $579 |
| Realistic | 500 | 400 | 100 | $1,336 | $252 | $1,084 |
| Optimistic | 300 | 500 | 200 | $2,427 | $333 | $2,094 |

## Next Steps

1. Set up products in Stripe ✓
2. Configure webhooks ✓
3. Add secrets to Cloudflare ✓
4. Test with test card ✓
5. Go live with production keys ✓
6. Monitor webhook delivery and subscription changes ✓
