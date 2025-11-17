import type { SubscriptionTier } from './types';

export interface PricingTier {
  name: string;
  price: number; // USD per month
  minAlexaInterval: number; // minimum minutes between Amazon polls
  features: string[];
  stripePriceId?: string; // Stripe Price ID for checkout
}

export const PRICING_TIERS: Record<SubscriptionTier, PricingTier> = {
  free: {
    name: 'Free',
    price: 0,
    minAlexaInterval: 60, // Poll Amazon max once per hour
    features: [
      'syncs every hour (good enough for groceries)',
      'todoist → alexa happens instantly via webhooks',
      'email me at justin@jmitch.com if something breaks',
    ],
  },
  fast: {
    name: 'Fast',
    price: 1.99,
    minAlexaInterval: 30, // Poll Amazon every 30 minutes
    stripePriceId: 'price_1SUJjrGeJyJ0RJDUWZvryQV9',
    features: [
      'syncs every 30 minutes (getting fancy)',
      'todoist → alexa still instant',
      "i'll probably respond faster if you message me",
    ],
  },
  faster: {
    name: 'Faster',
    price: 5,
    minAlexaInterval: 5, // Poll Amazon every 5 minutes
    stripePriceId: 'price_1SUJkRGeJyJ0RJDURxul4fDG',
    features: [
      'syncs every 5 minutes (honestly overkill)',
      'todoist → alexa still instant',
      'want it to work with something other than todoist? ask me',
    ],
  },
};

/**
 * Validate if interval is allowed for subscription tier
 * Note: Todoist sync is now instant via webhooks, so only Alexa interval matters
 */
export function validateInterval(
  alexaInterval: number,
  tier: SubscriptionTier
): { valid: boolean; error?: string } {
  const limits = PRICING_TIERS[tier];

  if (alexaInterval < limits.minAlexaInterval) {
    return {
      valid: false,
      error: `Alexa sync interval must be at least ${limits.minAlexaInterval} minutes for ${limits.name} tier. Upgrade to sync more frequently.`,
    };
  }

  return { valid: true };
}

/**
 * Get recommended interval based on tier
 * Note: Todoist sync is instant via webhooks (no interval needed)
 */
export function getDefaultInterval(tier: SubscriptionTier): number {
  const limits = PRICING_TIERS[tier];
  return limits.minAlexaInterval;
}
