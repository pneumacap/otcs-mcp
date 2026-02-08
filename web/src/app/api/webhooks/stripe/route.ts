import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getStripe } from '@/lib/stripe';
import { db } from '@/db';
import { subscriptions, auditLogs } from '@/db/schema';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        if (!orgId || !session.subscription) break;

        const subscription = await getStripe().subscriptions.retrieve(
          session.subscription as string,
          { expand: ['items.data'] },
        );

        const firstItem = subscription.items.data[0];
        await db
          .update(subscriptions)
          .set({
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: session.customer as string,
            plan: 'pro',
            status: 'active',
            periodStart: firstItem ? new Date(firstItem.current_period_start * 1000) : null,
            periodEnd: firstItem ? new Date(firstItem.current_period_end * 1000) : null,
          })
          .where(eq(subscriptions.orgId, orgId));

        await logWebhookEvent(orgId, 'subscription.activated', { plan: 'pro' });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.orgId;

        // Find sub by Stripe subscription ID if orgId not in metadata
        const [sub] = orgId
          ? await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1)
          : await db
              .select()
              .from(subscriptions)
              .where(eq(subscriptions.stripeSubscriptionId!, subscription.id))
              .limit(1);

        if (!sub) break;

        const status = mapStripeStatus(subscription.status);
        const firstItem = subscription.items?.data?.[0];
        await db
          .update(subscriptions)
          .set({
            status,
            periodStart: firstItem ? new Date(firstItem.current_period_start * 1000) : null,
            periodEnd: firstItem ? new Date(firstItem.current_period_end * 1000) : null,
          })
          .where(eq(subscriptions.id, sub.id));

        await logWebhookEvent(sub.orgId, 'subscription.updated', { status });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId!, subscription.id))
          .limit(1);

        if (!sub) break;

        // Downgrade to free
        await db
          .update(subscriptions)
          .set({
            plan: 'free',
            status: 'active',
            stripeSubscriptionId: null,
            periodStart: null,
            periodEnd: null,
          })
          .where(eq(subscriptions.id, sub.id));

        await logWebhookEvent(sub.orgId, 'subscription.canceled', { previousPlan: sub.plan });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeCustomerId!, customerId))
          .limit(1);

        if (!sub) break;

        await db
          .update(subscriptions)
          .set({ status: 'past_due' })
          .where(eq(subscriptions.id, sub.id));

        await logWebhookEvent(sub.orgId, 'payment.failed', {});
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeCustomerId!, customerId))
          .limit(1);

        if (!sub) break;

        await db
          .update(subscriptions)
          .set({ status: 'active' })
          .where(eq(subscriptions.id, sub.id));

        await logWebhookEvent(sub.orgId, 'payment.succeeded', {});
        break;
      }
    }
  } catch (err: any) {
    console.error('[STRIPE WEBHOOK] Handler error:', err.message);
    // Return 200 to prevent Stripe from retrying — log the error
    return NextResponse.json({ received: true, error: err.message });
  }

  return NextResponse.json({ received: true });
}

function mapStripeStatus(status: string): string {
  switch (status) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'trialing':
      return 'trialing';
    default:
      return 'active';
  }
}

async function logWebhookEvent(orgId: string, action: string, metadata: Record<string, unknown>) {
  await db.insert(auditLogs).values({
    orgId,
    action: `getStripe().${action}`,
    resourceType: 'subscription',
    metadata,
  });
}
