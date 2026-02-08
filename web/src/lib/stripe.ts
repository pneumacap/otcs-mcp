import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });
  }
  return _stripe;
}

export const PLANS = {
  free: {
    name: 'Free',
    messagesPerMonth: 50,
    maxConnections: 5,
    toolProfile: 'core' as const,
  },
  pro: {
    name: 'Pro',
    messagesPerMonth: Infinity,
    maxConnections: 25,
    toolProfile: 'full' as const,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  enterprise: {
    name: 'Enterprise',
    messagesPerMonth: Infinity,
    maxConnections: Infinity,
    toolProfile: 'full' as const,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
  },
} as const;

export type PlanName = keyof typeof PLANS;
