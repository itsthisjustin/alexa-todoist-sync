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
      'Sync Alexa Shopping List to Todoist every hour',
      'Automatically mark Alexa Shopping List items as done from Todoist',
      'Basic email support at justin@jmitch.com',
    ],
  },
  fast: {
    name: 'Fast',
    price: 1.99,
    minAlexaInterval: 30, // Poll Amazon every 30 minutes
    stripePriceId: 'price_1SUJjrGeJyJ0RJDUWZvryQV9',
    features: [
      'Sync Alexa Shopping List to Todoist every 30 min',
      'Automatically mark Alexa Shopping List items as done from Todoist',
      'Priority support via some chat app you find me on',
    ],
  },
  faster: {
    name: 'Faster',
    price: 5,
    minAlexaInterval: 5, // Poll Amazon every 5 minutes
    stripePriceId: 'price_1SUJkRGeJyJ0RJDURxul4fDG',
    features: [
      'Sync Alexa Shopping List to Todoist every 5 minutes',
      'Automatically mark Alexa Shopping List items as done from Todoist',
      'Request custom integrations for other todo apps',
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
