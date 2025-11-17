import { Context } from 'hono';
import type { Env, User, UserConfig, SubscriptionTier } from '../../shared/types';
import { verifyToken, extractToken } from '../../shared/auth';
import { PRICING_TIERS, getDefaultInterval } from '../../shared/pricing';

/**
 * Create Stripe Checkout Session
 */
export async function createCheckoutSession(c: Context<{ Bindings: Env }>) {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { tier } = await c.req.json();

  if (!tier || !['fast', 'faster'].includes(tier)) {
    return c.json({ error: 'Invalid tier' }, 400);
  }

  const pricingTier = PRICING_TIERS[tier as SubscriptionTier];
  if (!pricingTier.stripePriceId) {
    return c.json({ error: 'Stripe price not configured' }, 500);
  }

  // Get user email for Stripe customer
  const userData = await c.env.USERS.get(`user:${payload.userId}`);
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  const user: User = JSON.parse(userData);

  // Create Stripe Checkout Session
  const checkoutSession = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'mode': 'subscription',
      'customer_email': user.email,
      'line_items[0][price]': pricingTier.stripePriceId,
      'line_items[0][quantity]': '1',
      'success_url': `https://alexatodoist.com/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `https://alexatodoist.com/dashboard`,
      'client_reference_id': payload.userId,
      'metadata[userId]': payload.userId,
      'metadata[tier]': tier,
      'subscription_data[metadata][userId]': payload.userId,
    }),
  });

  if (!checkoutSession.ok) {
    const error = await checkoutSession.text();
    console.error('Stripe checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }

  const session = await checkoutSession.json() as any;

  return c.json({ url: session.url });
}

/**
 * Cancel Stripe Subscription
 */
export async function cancelSubscription(c: Context<{ Bindings: Env }>) {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get user
  const userData = await c.env.USERS.get(`user:${payload.userId}`);
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }

  const user: User = JSON.parse(userData);

  if (!user.stripeSubscriptionId) {
    return c.json({ error: 'No active subscription' }, 400);
  }

  // Cancel subscription at period end
  const cancelResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${user.stripeSubscriptionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
    },
  });

  if (!cancelResponse.ok) {
    const error = await cancelResponse.text();
    console.error('Stripe cancellation error:', error);
    return c.json({ error: 'Failed to cancel subscription' }, 500);
  }

  // The webhook will handle downgrading the user to free tier
  return c.json({ success: true, message: 'Subscription cancelled successfully' });
}

/**
 * Handle Stripe Webhook
 */
export async function handleStripeWebhook(c: Context<{ Bindings: Env }>) {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  const body = await c.req.text();

  // Verify webhook signature
  const verified = await verifyStripeSignature(
    body,
    signature,
    c.env.STRIPE_WEBHOOK_SECRET
  );

  if (!verified) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const event = JSON.parse(body);

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId || session.client_reference_id;
    const tier = session.metadata?.tier as SubscriptionTier;

    if (!userId || !tier) {
      console.error('Missing userId or tier in webhook metadata');
      return c.json({ error: 'Missing metadata' }, 400);
    }

    // Update user's subscription tier
    const userData = await c.env.USERS.get(`user:${userId}`);
    if (!userData) {
      console.error(`User ${userId} not found`);
      return c.json({ error: 'User not found' }, 404);
    }

    const user: User = JSON.parse(userData);
    user.subscriptionTier = tier;
    user.stripeCustomerId = session.customer;
    user.stripeSubscriptionId = session.subscription;
    await c.env.USERS.put(`user:${userId}`, JSON.stringify(user));

    // Update config with new default interval for the tier
    const configData = await c.env.USERS.get(`config:${userId}`);
    if (configData) {
      const config: UserConfig = JSON.parse(configData);
      const defaultInterval = getDefaultInterval(tier);
      config.alexaToTodoistInterval = defaultInterval;
      await c.env.USERS.put(`config:${userId}`, JSON.stringify(config));
    }

    console.log(`Updated user ${userId} to ${tier} tier`);
  }

  // Handle subscription.deleted event (cancellation)
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const userId = subscription.metadata?.userId;

    if (userId) {
      const userData = await c.env.USERS.get(`user:${userId}`);
      if (userData) {
        const user: User = JSON.parse(userData);
        user.subscriptionTier = 'free';
        delete user.stripeCustomerId;
        delete user.stripeSubscriptionId;
        await c.env.USERS.put(`user:${userId}`, JSON.stringify(user));

        // Reset to free tier interval
        const configData = await c.env.USERS.get(`config:${userId}`);
        if (configData) {
          const config: UserConfig = JSON.parse(configData);
          const defaultInterval = getDefaultInterval('free');
          config.alexaToTodoistInterval = defaultInterval;
          await c.env.USERS.put(`config:${userId}`, JSON.stringify(config));
        }

        console.log(`Downgraded user ${userId} to free tier`);
      }
    }
  }

  return c.json({ received: true });
}

/**
 * Verify Stripe webhook signature using Web Crypto API
 */
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Extract timestamp and signatures from header
    const parts = signature.split(',');
    const timestamp = parts.find((p) => p.startsWith('t='))?.substring(2);
    const expectedSignature = parts.find((p) => p.startsWith('v1='))?.substring(3);

    if (!timestamp || !expectedSignature) {
      return false;
    }

    // Create signed payload
    const signedPayload = `${timestamp}.${payload}`;

    // Compute HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    );

    // Convert to hex
    const computedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Compare signatures (timing-safe comparison)
    return computedSignature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}
